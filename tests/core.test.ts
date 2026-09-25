import { test } from "node:test";
import assert from "node:assert/strict";
import {
  contrastRatio,
  cssVariables,
  extractPalette,
  formats,
  kmeans,
  luminance,
  readableOn,
  rgbToHsl,
  toHex,
} from "../src/core.ts";

test("toHex pads and clamps", () => {
  assert.equal(toHex({ r: 0, g: 255, b: 16 }), "#00ff10");
  assert.equal(toHex({ r: 300, g: -5, b: 12.4 }), "#ff000c");
});

test("rgbToHsl known values", () => {
  assert.deepEqual(rgbToHsl({ r: 255, g: 0, b: 0 }), { h: 0, s: 100, l: 50 });
  assert.deepEqual(rgbToHsl({ r: 0, g: 0, b: 0 }), { h: 0, s: 0, l: 0 });
  const white = rgbToHsl({ r: 255, g: 255, b: 255 });
  assert.equal(white.l, 100);
});

test("luminance: white 1, black 0", () => {
  assert.equal(luminance({ r: 255, g: 255, b: 255 }), 1);
  assert.equal(luminance({ r: 0, g: 0, b: 0 }), 0);
});

test("contrastRatio known values", () => {
  assert.equal(contrastRatio({ r: 255, g: 255, b: 255 }, { r: 0, g: 0, b: 0 }), 21);
  assert.ok(
    Math.abs(contrastRatio({ r: 255, g: 255, b: 255 }, { r: 119, g: 119, b: 119 }) - 4.48) < 0.05,
  );
});

test("readableOn picks the higher-contrast text color", () => {
  assert.equal(readableOn({ r: 255, g: 255, b: 255 }), "#000000");
  assert.equal(readableOn({ r: 0, g: 0, b: 0 }), "#ffffff");
});

test("kmeans converges on two obvious clusters", () => {
  const pixels: number[] = [];
  for (let i = 0; i < 200; i++) pixels.push(10, 10, 240, 255); // blue-ish cluster
  for (let i = 0; i < 200; i++) pixels.push(240, 240, 10, 255); // yellow-ish cluster
  const clusters = kmeans(pixels, 2, 10, () => 0.5);
  assert.equal(clusters.length, 2);
  // each cluster center must be near one of the two seed colors
  for (const { center } of clusters) {
    const nearBlue = Math.abs(center.b - 240) < 20 && center.r < 60;
    const nearYellow = center.r > 200 && center.g > 200 && center.b < 60;
    assert.ok(nearBlue || nearYellow, `center off target: ${JSON.stringify(center)}`);
  }
});

test("extractPalette dedupes near-identical centers", () => {
  const pixels: number[] = [];
  for (let i = 0; i < 300; i++) pixels.push(100, 120, 140, 255);
  for (let i = 0; i < 300; i++) pixels.push(102, 118, 142, 255); // same color ±2
  const palette = extractPalette(pixels, 4, () => 0.5);
  // near-identical centers must collapse to few swatches
  assert.ok(palette.length <= 3, `expected dedupe, got ${palette.length}`);
  const totalShare = palette.reduce((sum, c) => sum + c.share, 0);
  assert.ok(Math.abs(totalShare - 1) < 0.01, "shares must sum to ~1");
});

test("cssVariables format", () => {
  const palette = extractPalette(
    (() => {
      const px: number[] = [];
      for (let i = 0; i < 100; i++) px.push(255, 0, 0, 255);
      return px;
    })(),
    2,
  );
  const css = cssVariables(palette);
  assert.ok(css.startsWith(":root {"));
  assert.ok(css.includes("--palette-1: #ff0000;"));
});

test("formats line contains all three notations", () => {
  const palette = extractPalette(
    (() => {
      const px: number[] = [];
      for (let i = 0; i < 50; i++) px.push(255, 255, 255, 255);
      return px;
    })(),
    1,
  );
  const line = formats(palette[0] as never);
  assert.ok(line.includes("hex #ffffff"));
  assert.ok(line.includes("rgb(255, 255, 255)"));
  assert.ok(line.includes("hsl("));
});
