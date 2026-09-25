/* DOM layer: image load, k-means palette extraction, swatch grid with
 * WCAG contrast badges, copyable formats, CSS variables output. */

import {
  cssVariables,
  extractPalette,
  formats,
  readableOn,
  type PaletteColor,
} from "./core.ts";

const $ = (id: string): HTMLElement => document.getElementById(id) as HTMLElement;

function renderPalette(palette: PaletteColor[]): void {
  const grid = $("swatches");
  grid.innerHTML = "";
  for (const color of palette) {
    const swatch = document.createElement("div");
    swatch.className = "swatch";
    swatch.style.background = color.hex;
    swatch.style.color = color.readable;
    const percent = (color.share * 100).toFixed(1);
    const contrast = color.readable === "#000000" ? "dark text" : "light text";
    swatch.innerHTML = `<strong>${color.hex}</strong><small>${percent}% · ${contrast}</small>`;
    swatch.addEventListener("click", () => {
      navigator.clipboard?.writeText(formats(color));
      swatch.dataset.copied = "copied!";
      setTimeout(() => delete swatch.dataset.copied, 800);
    });
    grid.appendChild(swatch);
  }
  $("css-vars").textContent = cssVariables(palette);
}

function extractFromImage(img: HTMLImageElement, clusters: number): void {
  const canvas = document.createElement("canvas");
  const scale = Math.min(1, 200 / Math.max(img.naturalWidth, img.naturalHeight));
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  const rng = (() => {
    let state = 12345;
    return () => {
      state ^= state << 13;
      state ^= state >>> 17;
      state ^= state << 5;
      state >>>= 0;
      return state / 4294967296;
    };
  })();
  renderPalette(extractPalette(pixels, clusters, rng));
}

function setup(): void {
  const load = (file: File | undefined) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      extractFromImage(img, Number(($("clusters") as HTMLSelectElement).value));
      URL.revokeObjectURL(url);
    };
    img.src = url;
  };
  $("file").addEventListener("change", () => load(($("file") as HTMLInputElement).files?.[0]));
  $("clusters").addEventListener("change", () => {
    const file = ($("file") as HTMLInputElement).files?.[0];
    load(file);
  });
  $("copy-css")?.addEventListener("click", () => {
    navigator.clipboard?.writeText($("css-vars").textContent ?? "");
  });
}

setup();
