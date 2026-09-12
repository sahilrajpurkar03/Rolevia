import { copyFile, mkdir } from "node:fs/promises";

await mkdir(new URL("../public/cv-assets/", import.meta.url), {
  recursive: true,
});
for (const weight of [400, 700]) {
  await copyFile(
    new URL(
      `../node_modules/@fontsource/dm-sans/files/dm-sans-latin-${weight}-normal.woff`,
      import.meta.url,
    ),
    new URL(`../public/cv-assets/dm-sans-${weight}.woff`, import.meta.url),
  );
}
await copyFile(
  new URL(
    "../node_modules/pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ),
  new URL("../public/cv-assets/pdf.worker.min.mjs", import.meta.url),
);
