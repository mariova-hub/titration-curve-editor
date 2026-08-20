import { describe, expect, it, vi } from "vitest";
import {
  createObjectUrlLease,
  createSvgExportArtifact,
  DEFAULT_SVG_FILENAME,
  SVG_MIME_TYPE,
} from "../../src/export";

describe("SVG export utility", () => {
  it("creates a UTF-8 SVG Blob with the default filename", async () => {
    const svg = '<svg xmlns="http://www.w3.org/2000/svg"><path /></svg>';
    const artifact = createSvgExportArtifact(svg);

    expect(artifact.filename).toBe(DEFAULT_SVG_FILENAME);
    expect(artifact.blob.type).toBe(SVG_MIME_TYPE);
    expect(await artifact.blob.text()).toBe(svg);
  });

  it("normalizes a custom filename to an SVG extension", () => {
    expect(createSvgExportArtifact("<svg></svg>", "lesson-figure").filename).toBe("lesson-figure.svg");
    expect(createSvgExportArtifact("<svg></svg>", "curve.SVG").filename).toBe("curve.SVG");
    expect(createSvgExportArtifact("<svg></svg>", "   ").filename).toBe(DEFAULT_SVG_FILENAME);
  });

  it("rejects content that is not a serialized SVG root", () => {
    expect(() => createSvgExportArtifact("<html></html>")).toThrow(TypeError);
  });

  it("creates and revokes an object URL exactly once", () => {
    const api = {
      createObjectURL: vi.fn(() => "blob:curve"),
      revokeObjectURL: vi.fn(),
    };
    const lease = createObjectUrlLease(new Blob(["<svg></svg>"]), api);

    expect(lease.url).toBe("blob:curve");
    lease.revoke();
    lease.revoke();
    expect(api.createObjectURL).toHaveBeenCalledTimes(1);
    expect(api.revokeObjectURL).toHaveBeenCalledOnce();
    expect(api.revokeObjectURL).toHaveBeenCalledWith("blob:curve");
  });
});
