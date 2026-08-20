export const DEFAULT_SVG_FILENAME = "titration-curve.svg";
export const SVG_MIME_TYPE = "image/svg+xml;charset=utf-8";

export interface SvgExportArtifact {
  filename: string;
  blob: Blob;
}

export interface ObjectUrlLease {
  url: string;
  revoke(): void;
}

export interface ObjectUrlApi {
  createObjectURL(blob: Blob): string;
  revokeObjectURL(url: string): void;
}

function normalizeFilename(filename: string): string {
  const trimmed = filename.trim();
  if (trimmed.length === 0) return DEFAULT_SVG_FILENAME;
  return trimmed.toLowerCase().endsWith(".svg") ? trimmed : `${trimmed}.svg`;
}

export function createSvgExportArtifact(
  svgString: string,
  filename = DEFAULT_SVG_FILENAME,
): SvgExportArtifact {
  if (!svgString.trimStart().startsWith("<svg")) {
    throw new TypeError("SVG export requires a serialized SVG root.");
  }
  return {
    filename: normalizeFilename(filename),
    blob: new Blob([svgString], { type: SVG_MIME_TYPE }),
  };
}

export function createObjectUrlLease(
  blob: Blob,
  api: ObjectUrlApi = URL,
): ObjectUrlLease {
  const url = api.createObjectURL(blob);
  let active = true;
  return {
    url,
    revoke(): void {
      if (!active) return;
      active = false;
      api.revokeObjectURL(url);
    },
  };
}

export function downloadSvg(
  svgString: string,
  filename = DEFAULT_SVG_FILENAME,
): void {
  const artifact = createSvgExportArtifact(svgString, filename);
  const lease = createObjectUrlLease(artifact.blob);
  let cleanupScheduled = false;
  try {
    const link = document.createElement("a");
    link.href = lease.url;
    link.download = artifact.filename;
    link.hidden = true;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => lease.revoke(), 1_000);
    cleanupScheduled = true;
  } finally {
    if (!cleanupScheduled) lease.revoke();
  }
}
