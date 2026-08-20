import { createObjectUrlLease, type ObjectUrlApi } from "./svg-export";

export const DEFAULT_PNG_FILENAME = "titration-curve.png";
export const PNG_MIME_TYPE = "image/png";
export const PNG_EXPORT_SCALES = [1, 2, 4] as const;
export const MAX_PNG_DIMENSION = 16_384;
export const MAX_PNG_PIXELS = 100_000_000;

const SVG_MIME_TYPE = "image/svg+xml;charset=utf-8";
const IMAGE_LOAD_TIMEOUT_MS = 15_000;

export type PngExportScale = (typeof PNG_EXPORT_SCALES)[number];
export type PngBackgroundMode = "preserve" | "white" | "transparent";

export interface PngExportOptions {
  scale: number;
  background: PngBackgroundMode;
}

export interface PngDimensions {
  sourceWidth: number;
  sourceHeight: number;
  width: number;
  height: number;
  pixelCount: number;
}

export interface PngCanvasContext {
  fillStyle: string;
  fillRect(x: number, y: number, width: number, height: number): void;
  drawImage(image: unknown, x: number, y: number, width: number, height: number): void;
}

export interface PngCanvas {
  getContext(contextId: "2d"): PngCanvasContext | null;
  toBlob(callback: (blob: Blob | null) => void, type: string): void;
}

export interface PngRasterizationAdapter {
  objectUrls: ObjectUrlApi;
  waitForFonts(): Promise<void>;
  loadImage(url: string): Promise<unknown>;
  createCanvas(width: number, height: number): PngCanvas;
}

export interface PngDownloadLink {
  href: string;
  download: string;
  hidden: boolean;
  click(): void;
  remove(): void;
}

export interface PngDownloadAdapter {
  objectUrls: ObjectUrlApi;
  createLink(): PngDownloadLink;
  appendLink(link: PngDownloadLink): void;
  scheduleCleanup(callback: () => void): void;
}

function normalizeScale(scale: number): PngExportScale {
  if (!Number.isFinite(scale) || !PNG_EXPORT_SCALES.includes(scale as PngExportScale)) {
    throw new RangeError("PNG scale must be one of 1, 2, or 4.");
  }
  return scale as PngExportScale;
}

function svgRoot(svg: string): string {
  const root = svg.trimStart().match(/^<svg\b[^>]*>/)?.[0];
  if (root === undefined) throw new TypeError("PNG export requires a serialized SVG root.");
  return root;
}

function svgDimension(root: string, attribute: "width" | "height"): number {
  const value = root.match(new RegExp(`\\b${attribute}="([^"]+)"`))?.[1];
  const dimension = value === undefined ? Number.NaN : Number(value);
  if (!Number.isFinite(dimension) || dimension <= 0) {
    throw new RangeError(`SVG ${attribute} must be a positive finite number.`);
  }
  return dimension;
}

export function calculatePngDimensions(svg: string, scale: number): PngDimensions {
  const normalizedScale = normalizeScale(scale);
  const root = svgRoot(svg);
  const sourceWidth = svgDimension(root, "width");
  const sourceHeight = svgDimension(root, "height");
  const width = Math.round(sourceWidth * normalizedScale);
  const height = Math.round(sourceHeight * normalizedScale);
  const pixelCount = width * height;
  if (
    width <= 0 ||
    height <= 0 ||
    width > MAX_PNG_DIMENSION ||
    height > MAX_PNG_DIMENSION ||
    !Number.isSafeInteger(pixelCount) ||
    pixelCount > MAX_PNG_PIXELS
  ) {
    throw new RangeError("PNG画像の寸法が安全上限を超えています。");
  }
  return { sourceWidth, sourceHeight, width, height, pixelCount };
}

export function prepareSvgForPngBackground(
  svg: string,
  background: PngBackgroundMode,
): string {
  if (!(["preserve", "white", "transparent"] as const).includes(background)) {
    throw new TypeError("Unsupported PNG background mode.");
  }
  return background === "transparent"
    ? svg.replace(/<rect\s+data-role="background"[^>]*\/>/g, "")
    : svg;
}

function canvasToPngBlob(canvas: PngCanvas): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob === null) {
        reject(new Error("Canvas returned no PNG Blob."));
        return;
      }
      if (blob.size <= 0 || blob.type !== PNG_MIME_TYPE) {
        reject(new Error("Canvas returned an invalid PNG Blob."));
        return;
      }
      resolve(blob);
    }, PNG_MIME_TYPE);
  });
}

function loadBrowserImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const timeout = window.setTimeout(() => {
      image.onload = null;
      image.onerror = null;
      reject(new Error("SVG image loading timed out."));
    }, IMAGE_LOAD_TIMEOUT_MS);
    image.onload = () => {
      window.clearTimeout(timeout);
      image.onload = null;
      image.onerror = null;
      resolve(image);
    };
    image.onerror = () => {
      window.clearTimeout(timeout);
      image.onload = null;
      image.onerror = null;
      reject(new Error("SVG image loading failed."));
    };
    image.src = url;
  });
}

function browserRasterizationAdapter(): PngRasterizationAdapter {
  return {
    objectUrls: URL,
    waitForFonts: async () => {
      if (document.fonts !== undefined) await document.fonts.ready;
    },
    loadImage: loadBrowserImage,
    createCanvas: (width, height) => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      return canvas as PngCanvas;
    },
  };
}

export async function convertSvgToPngBlob(
  svg: string,
  options: PngExportOptions,
  adapter: PngRasterizationAdapter = browserRasterizationAdapter(),
): Promise<Blob> {
  const dimensions = calculatePngDimensions(svg, options.scale);
  const rasterSvg = prepareSvgForPngBackground(svg, options.background);
  await adapter.waitForFonts();
  const svgLease = createObjectUrlLease(
    new Blob([rasterSvg], { type: SVG_MIME_TYPE }),
    adapter.objectUrls,
  );
  try {
    const image = await adapter.loadImage(svgLease.url);
    const canvas = adapter.createCanvas(dimensions.width, dimensions.height);
    const context = canvas.getContext("2d");
    if (context === null) throw new Error("Canvas 2D context is unavailable.");
    if (options.background === "white") {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, dimensions.width, dimensions.height);
    }
    context.drawImage(image, 0, 0, dimensions.width, dimensions.height);
    return await canvasToPngBlob(canvas);
  } finally {
    svgLease.revoke();
  }
}

export function normalizePngFilename(filename: string): string {
  const trimmed = filename.trim();
  if (trimmed.length === 0) return DEFAULT_PNG_FILENAME;
  return trimmed.toLowerCase().endsWith(".png") ? trimmed : `${trimmed}.png`;
}

function browserDownloadAdapter(): PngDownloadAdapter {
  return {
    objectUrls: URL,
    createLink: () => document.createElement("a"),
    appendLink: (link) => document.body.append(link as HTMLAnchorElement),
    scheduleCleanup: (callback) => window.setTimeout(callback, 1_000),
  };
}

export function downloadPngBlob(
  blob: Blob,
  filename = DEFAULT_PNG_FILENAME,
  adapter: PngDownloadAdapter = browserDownloadAdapter(),
): void {
  if (blob.size <= 0 || blob.type !== PNG_MIME_TYPE) {
    throw new TypeError("PNG download requires a non-empty image/png Blob.");
  }
  const lease = createObjectUrlLease(blob, adapter.objectUrls);
  let cleanupScheduled = false;
  try {
    const link = adapter.createLink();
    link.href = lease.url;
    link.download = normalizePngFilename(filename);
    link.hidden = true;
    adapter.appendLink(link);
    link.click();
    link.remove();
    adapter.scheduleCleanup(() => lease.revoke());
    cleanupScheduled = true;
  } finally {
    if (!cleanupScheduled) lease.revoke();
  }
}
