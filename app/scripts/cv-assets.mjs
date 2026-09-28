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
for (const weight of [400, 700]) {
  for (const style of ["normal", "italic"]) {
    await copyFile(
      new URL(
        `../node_modules/@fontsource/arimo/files/arimo-latin-${weight}-${style}.woff`,
        import.meta.url,
      ),
      new URL(
        `../public/cv-assets/arimo-${weight}-${style}.woff`,
        import.meta.url,
      ),
    );
  }
}
await copyFile(
  new URL(
    "../node_modules/pdfjs-dist/build/pdf.worker.min.mjs",
    import.meta.url,
  ),
  new URL("../public/cv-assets/pdf.worker.min.mjs", import.meta.url),
);
for (const style of ["regular", "bold", "italic", "bolditalic"]) {
  await copyFile(
    new URL(
      `../assets/fonts/tex-gyre-pagella/texgyrepagella-${style}.otf`,
      import.meta.url,
    ),
    new URL(
      `../public/cv-assets/texgyrepagella-${style}.otf`,
      import.meta.url,
    ),
  );
}
