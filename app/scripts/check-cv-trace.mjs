import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const trace = JSON.parse(
  await readFile(
    new URL("../.next/server/app/api/cv/route.js.nft.json", import.meta.url),
    "utf8",
  ),
);
const files = trace.files.map((file) => file.replaceAll("\\", "/"));
for (const filename of [
  "index.js",
  "js-binding.js",
  "geometry.js",
  "package.json",
]) {
  assert(
    files.some((file) => file.endsWith(`/@napi-rs/canvas/${filename}`)),
    `CV deployment is missing canvas/${filename}`,
  );
}
const nativePackage =
  process.platform === "linux"
    ? `canvas-linux-${process.arch}-gnu`
    : `canvas-${process.platform}-${process.arch}`;
assert(
  files.some(
    (file) =>
      file.includes(`/@napi-rs/${nativePackage}`) && file.endsWith(".node"),
  ),
  "CV deployment is missing the platform's native canvas binary",
);
console.log(
  "CV deployment trace includes the canvas loader and native binary.",
);
