/* Palette core: RGB→HEX/HSL, WCAG contrast ratios, k-means clustering
 * over pixel data and CSS variable generation. Pure logic — no canvas. */

export interface RGB {
  r: number;
  g: number;
  b: number;
}

export interface PaletteColor extends RGB {
  hex: string;
  hsl: { h: number; s: number; l: number };
  share: number; // fraction of pixels in this cluster, 0..1
  /** best readable text color on top of this swatch */
  readable: "#000000" | "#ffffff";
}

export function toHex({ r, g, b }: RGB): string {
  const to2 = (v: number) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, "0");
  return `#${to2(r)}${to2(g)}${to2(b)}`;
}

export function rgbToHsl({ r, g, b }: RGB): { h: number; s: number; l: number } {
  const rn = r / 255;
  const gn = g / 255;
  const bn = b / 255;
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  if (max === min) return { h: 0, s: 0, l: Math.round(l * 100) };
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h = 0;
  if (max === rn) h = ((gn - bn) / d + (gn < bn ? 6 : 0)) / 6;
  else if (max === gn) h = ((bn - rn) / d + 2) / 6;
  else h = ((rn - gn) / d + 4) / 6;
  return { h: Math.round(h * 360), s: Math.round(s * 100), l: Math.round(l * 100) };
}

/** WCAG relative luminance. */
export function luminance({ r, g, b }: RGB): number {
  const channel = (v: number) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** WCAG contrast ratio between two colors, 1..21. */
export function contrastRatio(a: RGB, b: RGB): number {
  const la = luminance(a);
  const lb = luminance(b);
  const ratio = (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  return Math.round(ratio * 100) / 100;
}

export function readableOn(color: RGB): "#000000" | "#ffffff" {
  return contrastRatio(color, { r: 0, g: 0, b: 0 }) >=
    contrastRatio(color, { r: 255, g: 255, b: 255 })
    ? "#000000"
    : "#ffffff";
}

/** k-means over RGB pixels. `pixels` is RGBA (alpha ignored). */
export function kmeans(
  pixels: Uint8Array | number[],
  clusters: number,
  iterations = 12,
  rng: () => number = Math.random,
): Array<{ center: RGB; share: number }> {
  const points: RGB[] = [];
  for (let i = 0; i < pixels.length; i += 4) {
    points.push({ r: pixels[i] as number, g: pixels[i + 1] as number, b: pixels[i + 2] as number });
  }
  if (points.length === 0) return [];
  const k = Math.min(clusters, points.length);

  // init: k distinct points; random picks with a linear fallback so a
  // constant rng cannot loop forever
  const centers: RGB[] = [];
  const used = new Set<number>();
  let fallback = 0;
  while (centers.length < k && fallback < points.length) {
    const index = used.size < 1 ? Math.floor(rng() * points.length) % points.length : fallback;
    if (used.has(index)) {
      fallback++;
      continue;
    }
    used.add(index);
    centers.push({ ...(points[index] as RGB) });
    fallback++;
  }

  const assignments = new Array<number>(points.length).fill(0);
  for (let iter = 0; iter < iterations; iter++) {
    // assign
    for (let p = 0; p < points.length; p++) {
      let best = 0;
      let bestDist = Infinity;
      for (let c = 0; c < centers.length; c++) {
        const dr = points[p]!.r - centers[c]!.r;
        const dg = points[p]!.g - centers[c]!.g;
        const db = points[p]!.b - centers[c]!.b;
        const dist = dr * dr + dg * dg + db * db;
        if (dist < bestDist) {
          bestDist = dist;
          best = c;
        }
      }
      assignments[p] = best;
    }
    // update
    const sums = centers.map(() => ({ r: 0, g: 0, b: 0, n: 0 }));
    for (let p = 0; p < points.length; p++) {
      const sum = sums[assignments[p] as number];
      sum.r += points[p]!.r;
      sum.g += points[p]!.g;
      sum.b += points[p]!.b;
      sum.n++;
    }
    for (let c = 0; c < centers.length; c++) {
      if (sums[c]!.n === 0) {
        centers[c] = { ...(points[Math.floor(rng() * points.length)] as RGB) };
        continue;
      }
      centers[c] = {
        r: Math.round(sums[c]!.r / sums[c]!.n),
        g: Math.round(sums[c]!.g / sums[c]!.n),
        b: Math.round(sums[c]!.b / sums[c]!.n),
      };
    }
  }

  const counts = new Array<number>(centers.length).fill(0);
  for (const assignment of assignments) counts[assignment]++;
  return centers
    .map((center, i) => ({ center, share: counts[i] / points.length }))
    .sort((a, b) => b.share - a.share);
}

/** Full palette extraction: cluster, dedupe near-identical centers,
 * attach hex/hsl/readable/share. */
export function extractPalette(
  pixels: Uint8Array | number[],
  clusterCount: number,
  rng: () => number = Math.random,
): PaletteColor[] {
  const clusters = kmeans(pixels, clusterCount, 12, rng);
  const seen: PaletteColor[] = [];
  for (const { center, share } of clusters) {
    const hex = toHex(center);
    const duplicate = seen.find((c) => contrastRatio(c, center) < 1.05);
    if (duplicate) {
      duplicate.share += share;
      continue;
    }
    seen.push({
      ...center,
      hex,
      hsl: rgbToHsl(center),
      share,
      readable: readableOn(center),
    });
  }
  seen.sort((a, b) => b.share - a.share);
  const total = seen.reduce((sum, c) => sum + c.share, 0) || 1;
  for (const c of seen) c.share = c.share / total;
  return seen;
}

/** CSS custom properties from a palette. */
export function cssVariables(palette: PaletteColor[]): string {
  const lines = palette.map((c, i) => `  --palette-${i + 1}: ${c.hex}; /* ${(c.share * 100).toFixed(1)}% */`);
  return ":root {\n" + lines.join("\n") + "\n}";
}

/** Human-readable formats for one color. */
export function formats(color: PaletteColor): string {
  const hsl = color.hsl;
  return `hex ${color.hex} · rgb(${color.r}, ${color.g}, ${color.b}) · hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
}
