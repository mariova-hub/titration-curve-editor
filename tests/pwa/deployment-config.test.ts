/// <reference types="vite/client" />

import { describe, expect, it } from "vitest";
import packageSource from "../../package.json?raw";
import icon192Url from "../../public/app-icon-192.png?url";
import icon512Url from "../../public/app-icon-512.png?url";
import workflowSource from "../../.github/workflows/deploy-pages.yml?raw";
import { PWA_BASE, PWA_MANIFEST, PWA_OPTIONS } from "../../vite.config";

describe("GitHub Pages and PWA configuration", () => {
  it("uses the repository project-site base path", () => {
    expect(PWA_BASE).toBe("/titration-curve-editor/");
    expect(PWA_MANIFEST.start_url).toBe(PWA_BASE);
    expect(PWA_MANIFEST.scope).toBe(PWA_BASE);
  });

  it("defines the installable Japanese manifest", () => {
    expect(PWA_MANIFEST).toMatchObject({
      name: "Titration Curve Editor",
      short_name: "滴定曲線",
      display: "standalone",
      lang: "ja",
      background_color: "#ffffff",
      theme_color: "#17365f",
      prefer_related_applications: false,
    });
  });

  it("registers the 192px and 512px application icons", () => {
    expect(icon192Url).toContain("app-icon-192.png");
    expect(icon512Url).toContain("app-icon-512.png");
    expect(PWA_MANIFEST.icons).toEqual([
      expect.objectContaining({ src: "app-icon-192.png", sizes: "192x192", purpose: "any" }),
      expect.objectContaining({ src: "app-icon-512.png", sizes: "512x512", purpose: "any" }),
    ]);
  });

  it("uses generateSW auto-update with offline precache patterns", () => {
    expect(PWA_OPTIONS.strategies).toBe("generateSW");
    expect(PWA_OPTIONS.registerType).toBe("autoUpdate");
    expect(PWA_OPTIONS.devOptions?.enabled).toBe(false);
    expect(PWA_OPTIONS.includeManifestIcons).toBe(false);
    expect(PWA_OPTIONS.workbox?.globPatterns).toContain("**/*.{js,css,html,ico,png,svg}");
  });

  it("keeps preview and the direct PWA dependency in package configuration", () => {
    const packageJson = JSON.parse(packageSource) as {
      scripts: Record<string, string>;
      devDependencies: Record<string, string>;
    };
    expect(packageJson.scripts.preview).toBe("vite preview");
    expect(packageJson.scripts.build).toContain("verify:pwa");
    expect(packageJson.devDependencies["vite-plugin-pwa"]).toBe("^1.3.0");
  });

  it("defines the official Pages build and deployment workflow", () => {
    expect(workflowSource).toContain("branches: [main]");
    expect(workflowSource).toContain("workflow_dispatch:");
    expect(workflowSource).toContain("contents: read");
    expect(workflowSource).toContain("pages: write");
    expect(workflowSource).toContain("id-token: write");
    expect(workflowSource).toContain("run: npm ci");
    expect(workflowSource).toContain("run: npm run typecheck");
    expect(workflowSource).toContain("run: npm test");
    expect(workflowSource).toContain("run: npm run build");
    expect(workflowSource).toContain("path: ./dist");
    expect(workflowSource).toContain("name: github-pages");
    expect(workflowSource).toContain("actions/deploy-pages@");
  });
});
