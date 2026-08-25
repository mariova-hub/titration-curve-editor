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
import { V11_CONTRACT_FIXTURES } from "../fixtures/titration-fixtures";

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
      createObjectURL: vi.fn(() => "blob:v1.1-svg"),
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

describe("v1.1 salt rendering and export", () => {
  it.each([
    ["H", 2, 2],
    ["I", 1, 1],
    ["J", 1, 1],
  ] as const)(
    "renders and exports Fixture %s with %s equivalence guide(s)",
    async (fixtureId, equivalenceGuideCount, characteristicGuideCount) => {
      const fixture = V11_CONTRACT_FIXTURES[fixtureId];
      const result = calculateTitrationCurve(fixture.input);
      const xMax = result.points.at(-1)?.addedVolumeMl;
      if (xMax === undefined) throw new Error("Missing curve endpoint.");
      const svg = renderTitrationSvg(
        result,
        createTeachingGraphStyle(xMax),
      );

      expect(result.equivalencePoints.map(({ volumeMl }) => volumeMl)).toEqual(
        fixture.equivalenceVolumesMl,
      );
      expect(occurrences(svg, 'data-role="equivalence-guide"')).toBe(
        equivalenceGuideCount,
      );
      expect(occurrences(svg, 'data-role="equivalence-marker"')).toBe(
        equivalenceGuideCount,
      );
      expect(occurrences(svg, 'data-role="characteristic-guide"')).toBe(
        characteristicGuideCount,
      );
      expect(svg).toContain('data-role="titration-curve"');
      expect(svg).not.toContain("NaN");
      expect(svg).not.toContain("Infinity");
      expect(svg.endsWith("</svg>")).toBe(true);

      const svgArtifact = createSvgExportArtifact(svg, `fixture-${fixtureId}`);
      expect(svgArtifact.blob.size).toBeGreaterThan(0);
      expect(
        occurrences(await svgArtifact.blob.text(), 'data-role="equivalence-guide"'),
      ).toBe(equivalenceGuideCount);

      const adapter = rasterizationAdapter();
      const png = await convertSvgToPngBlob(
        svg,
        { scale: 2, background: "preserve" },
        adapter,
      );
      expect(png.type).toBe(PNG_MIME_TYPE);
      expect(png.size).toBeGreaterThan(0);
      expect(adapter.loadImage).toHaveBeenCalledOnce();
      const rasterSource = vi.mocked(
        adapter.objectUrls.createObjectURL,
      ).mock.calls[0]?.[0];
      expect(rasterSource).toBeInstanceOf(Blob);
      expect(
        occurrences(
          await (rasterSource as Blob).text(),
          'data-role="equivalence-guide"',
        ),
      ).toBe(equivalenceGuideCount);
    },
  );
});
