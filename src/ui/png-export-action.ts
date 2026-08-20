import {
  convertSvgToPngBlob,
  downloadPngBlob,
  type PngExportOptions,
} from "../export";
import { canExportPng, type AppState } from "./state";

export interface PngExportActionDependencies {
  convert(svg: string, options: PngExportOptions): Promise<Blob>;
  download(blob: Blob, filename: string): void;
}

const DEFAULT_PNG_EXPORT_ACTION_DEPENDENCIES: PngExportActionDependencies = {
  convert: convertSvgToPngBlob,
  download: downloadPngBlob,
};

export async function exportPngFromState(
  state: AppState,
  filename: string,
  dependencies: PngExportActionDependencies = DEFAULT_PNG_EXPORT_ACTION_DEPENDENCIES,
): Promise<void> {
  if (!canExportPng(state) || state.rendering.svgString === null) {
    throw new Error("PNG export requires a current valid preview.");
  }
  const blob = await dependencies.convert(
    state.rendering.svgString,
    state.rendering.pngExportOptions,
  );
  dependencies.download(blob, filename);
}
