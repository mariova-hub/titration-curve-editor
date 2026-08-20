import { describe, expect, it, vi } from "vitest";

import { calculateTitrationCurve } from "../../src/calculation";
import {
  calculatePngDimensions,
  convertSvgToPngBlob,
  DEFAULT_PNG_FILENAME,
  downloadPngBlob,
  MAX_PNG_DIMENSION,
  MAX_PNG_PIXELS,
  normalizePngFilename,
  PNG_MIME_TYPE,
  prepareSvgForPngBackground,
  type PngCanvasContext,
  type PngRasterizationAdapter,
} from "../../src/export";
import { createTeachingGraphStyle, renderTitrationSvg } from "../../src/rendering";

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" width="720" height="480" viewBox="0 0 720 480"><rect data-role="background" x="0" y="0" width="720" height="480" fill="#ffffff" /><text font-size="9pt">0</text></svg>';

function rasterizationAdapter(outputBlob: Blob | null = new Blob(["png"], { type: PNG_MIME_TYPE })) {
  const context: PngCanvasContext = {
    fillStyle: "",
    fillRect: vi.fn(),
    drawImage: vi.fn(),
  };
  const canvas = {
    getContext: vi.fn(() => context),
    toBlob: vi.fn((callback: (blob: Blob | null) => void) => callback(outputBlob)),
  };
  const adapter: PngRasterizationAdapter = {
    objectUrls: {
      createObjectURL: vi.fn(() => "blob:source-svg"),
      revokeObjectURL: vi.fn(),
    },
    waitForFonts: vi.fn(async () => undefined),
    loadImage: vi.fn(async () => ({ image: true })),
    createCanvas: vi.fn(() => canvas),
  };
  return { adapter, canvas, context };
}

describe("PNG export dimensions and validation", () => {
  it.each([
    [1, 720, 480],
    [2, 1440, 960],
    [4, 2880, 1920],
  ])("calculates %sx dimensions", (scale, width, height) => {
    expect(calculatePngDimensions(SVG, scale)).toMatchObject({ width, height });
  });

  it.each([0, -1, 3, Number.NaN, Number.POSITIVE_INFINITY])(
    "rejects invalid scale %s",
    (scale) => expect(() => calculatePngDimensions(SVG, scale)).toThrow(RangeError),
  );

  it("allows the current maximum figure at 4x", () => {
    const svg = '<svg width="2400" height="1800"></svg>';
    expect(calculatePngDimensions(svg, 4)).toMatchObject({
      width: 9600,
      height: 7200,
      pixelCount: 69_120_000,
    });
  });

  it("rejects unsafe canvas dimensions and pixel counts", () => {
    expect(() => calculatePngDimensions(`<svg width="${MAX_PNG_DIMENSION + 1}" height="10"></svg>`, 1)).toThrow(RangeError);
    expect(() => calculatePngDimensions('<svg width="10001" height="10000"></svg>', 1)).toThrow(RangeError);
    expect(MAX_PNG_PIXELS).toBe(100_000_000);
  });

  it("rejects malformed or dimensionless SVG", () => {
    expect(() => calculatePngDimensions("<html></html>", 2)).toThrow(TypeError);
    expect(() => calculatePngDimensions("<svg></svg>", 2)).toThrow(RangeError);
  });
});

describe("SVG to PNG rasterization", () => {
  it("creates a non-empty image/png Blob at the scaled dimensions", async () => {
    const { adapter, canvas, context } = rasterizationAdapter();
    const blob = await convertSvgToPngBlob(
      SVG,
      { scale: 2, background: "preserve" },
      adapter,
    );

    expect(blob.type).toBe(PNG_MIME_TYPE);
    expect(blob.size).toBeGreaterThan(0);
    expect(adapter.waitForFonts).toHaveBeenCalledOnce();
    expect(adapter.createCanvas).toHaveBeenCalledWith(1440, 960);
    expect(context.drawImage).toHaveBeenCalledWith(expect.anything(), 0, 0, 1440, 960);
    expect(canvas.toBlob).toHaveBeenCalledWith(expect.any(Function), PNG_MIME_TYPE);
  });

  it("preserves, forces white, or removes the SVG background", async () => {
    expect(prepareSvgForPngBackground(SVG, "preserve")).toContain('data-role="background"');
    expect(prepareSvgForPngBackground(SVG, "transparent")).not.toContain('data-role="background"');

    const white = rasterizationAdapter();
    await convertSvgToPngBlob(SVG, { scale: 1, background: "white" }, white.adapter);
    expect(white.context.fillStyle).toBe("#ffffff");
    expect(white.context.fillRect).toHaveBeenCalledWith(0, 0, 720, 480);

    const transparent = rasterizationAdapter();
    await convertSvgToPngBlob(
      SVG,
      { scale: 1, background: "transparent" },
      transparent.adapter,
    );
    const sourceBlob = vi.mocked(transparent.adapter.objectUrls.createObjectURL).mock.calls[0]?.[0];
    expect(sourceBlob).toBeInstanceOf(Blob);
    expect(await sourceBlob?.text()).not.toContain('data-role="background"');
    expect(transparent.context.fillRect).not.toHaveBeenCalled();
  });

  it("rejects a null Canvas Blob and revokes the SVG URL", async () => {
    const { adapter } = rasterizationAdapter(null);
    await expect(
      convertSvgToPngBlob(SVG, { scale: 2, background: "preserve" }, adapter),
    ).rejects.toThrow("no PNG Blob");
    expect(adapter.objectUrls.revokeObjectURL).toHaveBeenCalledOnce();
    expect(adapter.objectUrls.revokeObjectURL).toHaveBeenCalledWith("blob:source-svg");
  });

  it("revokes the SVG URL when image loading fails", async () => {
    const { adapter } = rasterizationAdapter();
    adapter.loadImage = vi.fn(async () => { throw new Error("image error"); });
    await expect(
      convertSvgToPngBlob(SVG, { scale: 1, background: "preserve" }, adapter),
    ).rejects.toThrow("image error");
    expect(adapter.objectUrls.revokeObjectURL).toHaveBeenCalledWith("blob:source-svg");
  });

  it("rasterizes a multi-equivalence oxalic-acid SVG without chemical branching", async () => {
    const result = calculateTitrationCurve({
      analyteSubstanceId: "h2c2o4",
      analyteConcentrationMolL: 0.05,
      analyteVolumeMl: 20,
      titrantSubstanceId: "naoh",
      titrantConcentrationMolL: 0.1,
    });
    const style = createTeachingGraphStyle(result.points.at(-1)?.addedVolumeMl ?? 30);
    const svg = renderTitrationSvg(result, style);
    const { adapter } = rasterizationAdapter();
    const blob = await convertSvgToPngBlob(
      svg,
      { scale: 2, background: "preserve" },
      adapter,
    );
    expect(result.equivalencePoints).toHaveLength(2);
    expect(blob.type).toBe(PNG_MIME_TYPE);
    expect(adapter.loadImage).toHaveBeenCalledOnce();
  });
});

describe("PNG download", () => {
  it("normalizes filenames", () => {
    expect(normalizePngFilename("")).toBe(DEFAULT_PNG_FILENAME);
    expect(normalizePngFilename("curve")).toBe("curve.png");
    expect(normalizePngFilename("curve.PNG")).toBe("curve.PNG");
  });

  it("downloads through a temporary URL and cleans it up", () => {
    const link = { href: "", download: "", hidden: false, click: vi.fn(), remove: vi.fn() };
    const objectUrls = {
      createObjectURL: vi.fn(() => "blob:png-download"),
      revokeObjectURL: vi.fn(),
    };
    const appendLink = vi.fn();
    downloadPngBlob(new Blob(["png"], { type: PNG_MIME_TYPE }), "lesson", {
      objectUrls,
      createLink: () => link,
      appendLink,
      scheduleCleanup: (callback) => callback(),
    });
    expect(link.download).toBe("lesson.png");
    expect(link.click).toHaveBeenCalledOnce();
    expect(link.remove).toHaveBeenCalledOnce();
    expect(objectUrls.revokeObjectURL).toHaveBeenCalledWith("blob:png-download");
  });
});
