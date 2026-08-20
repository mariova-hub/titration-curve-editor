import { defineConfig } from "vite";
import { VitePWA, type ManifestOptions, type VitePWAOptions } from "vite-plugin-pwa";

export const PWA_BASE = "/titration-curve-editor/";

export const PWA_MANIFEST = {
  name: "Titration Curve Editor",
  short_name: "滴定曲線",
  description: "高校化学の試験問題・教材向けに理論滴定曲線を作成し、SVG・PNGで出力できるアプリ",
  start_url: PWA_BASE,
  scope: PWA_BASE,
  display: "standalone",
  background_color: "#ffffff",
  theme_color: "#17365f",
  lang: "ja",
  prefer_related_applications: false,
  icons: [
    {
      src: "app-icon-192.png",
      sizes: "192x192",
      type: "image/png",
      purpose: "any",
    },
    {
      src: "app-icon-512.png",
      sizes: "512x512",
      type: "image/png",
      purpose: "any",
    },
  ],
} satisfies Partial<ManifestOptions>;

export const PWA_OPTIONS = {
  strategies: "generateSW",
  registerType: "autoUpdate",
  injectRegister: "auto",
  includeManifestIcons: false,
  manifest: PWA_MANIFEST,
  workbox: {
    cleanupOutdatedCaches: true,
    globPatterns: ["**/*.{js,css,html,ico,png,svg}"],
  },
  devOptions: {
    enabled: false,
  },
} satisfies Partial<VitePWAOptions>;

export default defineConfig({
  base: PWA_BASE,
  plugins: [VitePWA(PWA_OPTIONS)],
});
