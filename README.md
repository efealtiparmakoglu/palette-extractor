# palette-extractor

**Image palette tooling: RGB→HEX/HSL, WCAG contrast ratios, k-means colour
clustering and CSS custom-property generation. Pure logic, no canvas —
the image decoding is yours. Zero dependencies.**

```ts
import { extractPalette, toCssVariables } from "./src/core.ts";

const palette = extractPalette(pixels, 6);
// → [{ hex: "#3b82f6", hsl: {...}, share: 0.42, textOnTop: "#ffffff" }, …]

toCssVariables(palette, "brand");
// → { "--brand-500": "#3b82f6", … }
```

The hard part of "pull the colours out of this screenshot" is not the
arithmetic, it is deciding what a swatch *means*. palette-extractor does
the arithmetic — and tests it — so the part you write is the part that
needs your judgement.

## What it does

- **Conversions** — RGB to HEX, RGB to HSL, and back, with the rounding
  and hue-wrap edge cases handled explicitly.
- **Contrast** — WCAG 2.1 contrast ratios and the AA/AAA verdicts for
  text on a given background, plus the better of black or white as the
  readable foreground for each swatch.
- **Clustering** — k-means over pixel data with a deterministic seed
  (the same image always yields the same palette), returning each
  cluster's share of the pixels.
- **CSS output** — a set of custom properties, ordered by lightness, so
  the generated tokens can be dropped into a stylesheet as-is.

## Scope

This is the palette core only: it takes pixels, not files. Feed it from
`getImageData` in a browser, from a decoder of your choice on the server,
or from tests. Keeping the decoding out is what makes every part of the
colour logic testable in milliseconds.

## Development

```sh
node --test test/
```

## License

MIT — see [LICENSE](LICENSE).
