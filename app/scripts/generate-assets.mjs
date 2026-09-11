import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const output = fileURLToPath(new URL("../public/", import.meta.url));
await mkdir(output, { recursive: true });
const size = 512;
const pixels = Buffer.alloc(size * size * 4);
for (let row = 0; row < size; row++) {
  for (let column = 0; column < size; column++) {
    const offset = (row * size + column) * 4;
    const horizontal = column - size / 2;
    const vertical = row - size / 2;
    const radius = Math.hypot(horizontal, vertical);
    const ring = radius > 145 && radius < 157;
    const needle =
      Math.abs(horizontal + vertical) < 29 &&
      Math.abs(horizontal - vertical) < 176;
    const color = ring
      ? [179, 212, 138]
      : needle
        ? vertical < -horizontal
          ? [238, 248, 224]
          : [158, 191, 131]
        : [36, 92, 72];
    pixels[offset] = color[0];
    pixels[offset + 1] = color[1];
    pixels[offset + 2] = color[2];
    pixels[offset + 3] = 255;
  }
}
for (const [filename, dimension] of [
  ["icon-512.png", 512],
  ["icon-maskable.png", 512],
  ["icon-192.png", 192],
  ["apple-touch-icon.png", 180],
  ["brand-mark.png", 64],
]) {
  await sharp(pixels, { raw: { width: size, height: size, channels: 4 } })
    .resize(dimension, dimension)
    .png()
    .toFile(`${output}/${filename}`);
}
console.log("Generated Rolevia bitmap brand and install icons.");
