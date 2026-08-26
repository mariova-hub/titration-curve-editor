import { describe, expect, it, vi } from "vitest";

import { calculateTitrationCurve } from "../../src/calculation";
import {
  convertSvgToPngBlob,
  createSvgExportArtifact,
  PNG_MIME_TYPE,
  type PngCanvasContext,
  type PngRasterizationAdapter,
} from "../../src/export";
import {
  createTeachingGraphStyle,
  renderTitrationSvg,
} from "../../src/rendering";
import { applyPresetToState, createAppState } from "../../src/ui";
import { exportPngFromState } from "../../src/ui/png-export-action";
import { V12_CONTRACT_FIXTURES } from "../fixtures/titration-fixtures";

function occurrences(value: string, fragment: string): number {
  return value.split(fragment).length - 1;
}

function rasterizationAdapter(): PngRasterizationAdapter {
  const context: PngCanvasContext = {
    fillStyle: "",
    fillRect: vi.fn(),
    drawImage: vi.fn(),
  };
  return {
    objectUrls: {
      createObjectURL: vi.fn(() => "blob:v1.2-fixture-k-svg"),
      revokeObjectURL: vi.fn(),
    },
    waitForFonts: vi.fn(async () => undefined),
    loadImage: vi.fn(async () => ({ image: true })),
    createCanvas: vi.fn(() => ({
      getContext: vi.fn(() => context),
      toBlob: vi.fn((callback: (blob: Blob | null) => void) =>
        callback(new Blob(["png"], { type: PNG_MIME_TYPE }))
      ),
    })),
  };
}

describe("Fixture K rendering and export", () => {
  const fixture = V12_CONTRACT_FIXTURES.K;
  const result = calculateTitrationCurve(fixture.input);
  const svg = renderTitrationSvg(
    result,
    createTeachingGraphStyle(fixture.expectedAutoRangeMl),
  );

  it("renders both equivalence guides and markers with a finite curve", () => {
    expect(result.equivalencePoints.map(({ volumeMl }) => volumeMl)).toEqual([
      15,
      25,
    ]);
    expect(occurrences(svg, 'data-role="equivalence-guide"')).toBe(2);
    expect(occurrences(svg, 'data-role="equivalence-marker"')).toBe(2);
    expect(svg).toContain('data-id="equivalence-1"');
    expect(svg).toContain('data-id="equivalence-2"');
    expect(svg).toContain('data-role="titration-curve"');
    expect(svg).not.toContain("NaN");
    expect(svg).not.toContain("Infinity");
    expect(svg.trimStart().startsWith("<svg")).toBe(true);
    expect(svg.endsWith("</svg>")).toBe(true);
  });

  it("creates a non-empty SVG export containing both guides", async () => {
    const artifact = createSvgExportArtifact(svg, "fixture-k");
    const exported = await artifact.blob.text();

    expect(artifact.filename).toBe("fixture-k.svg");
    expect(artifact.blob.size).toBeGreaterThan(0);
    expect(occurrences(exported, 'data-role="equivalence-guide"')).toBe(2);
  });

  it("rasterizes the same finite two-guide SVG through the PNG pipeline", async () => {
    const adapter = rasterizationAdapter();
    const png = await convertSvgToPngBlob(
      svg,
      { scale: 2, background: "preserve" },
      adapter,
    );
    const rasterSource = vi.mocked(
      adapter.objectUrls.createObjectURL,
    ).mock.calls[0]?.[0];

    expect(png.type).toBe(PNG_MIME_TYPE);
    expect(png.size).toBeGreaterThan(0);
    expect(rasterSource).toBeInstanceOf(Blob);
    const rasterSvg = await (rasterSource as Blob).text();
    expect(occurrences(rasterSvg, 'data-role="equivalence-guide"')).toBe(2);
    expect(rasterSvg).not.toContain("NaN");
    expect(rasterSvg).not.toContain("Infinity");
  });

  it("connects the mixed UI state to full Preview, SVG, and PNG export", async () => {
    const state = applyPresetToState(createAppState({
      analyteSubstanceId: "na2co3",
      analyteConcentrationMolL: "0.0500",
      analyteVolumeMl: "20.0",
      analyteComponent2SubstanceId: "naoh",
      analyteComponent2ConcentrationMolL: "0.0250",
      titrantSubstanceId: "hcl",
      titrantConcentrationMolL: "0.100",
    }), "teaching");
    const convert = vi.fn(async (sourceSvg: string) => {
      expect(occurrences(sourceSvg, 'data-role="equivalence-guide"')).toBe(2);
      return new Blob(["png"], { type: PNG_MIME_TYPE });
    });
    const download = vi.fn();

    expect(state.chemical.result?.points.length).toBeGreaterThan(5);
    expect(state.rendering.graphStyle.xMax).toBe(fixture.expectedAutoRangeMl);
    expect(state.rendering.svgString).not.toBeNull();
    expect(
      occurrences(state.rendering.svgString ?? "", 'data-role="equivalence-guide"'),
    ).toBe(2);
    const svgArtifact = createSvgExportArtifact(
      state.rendering.svgString ?? "",
      "fixture-k-ui.svg",
    );
    expect(svgArtifact.blob.size).toBeGreaterThan(0);

    await exportPngFromState(
      state,
      "fixture-k-ui.png",
      { convert, download },
    );
    expect(convert).toHaveBeenCalledOnce();
    expect(download).toHaveBeenCalledWith(
      expect.objectContaining({ type: PNG_MIME_TYPE }),
      "fixture-k-ui.png",
    );
  });
});
