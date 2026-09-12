import { test, expect, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import mammoth from "mammoth";
import JSZip from "jszip";
import sharp from "sharp";

async function editorView(page: Page, mode: "Edit" | "Preview") {
  const switcher = page.getByRole("group", {
    name: "Editor view",
    exact: true,
  });
  if (await switcher.isVisible())
    await switcher.getByRole("button", { name: mode, exact: true }).click();
}
async function download(page: Page, format: string) {
  await editorView(page, "Preview");
  await page.getByLabel("CV export format").selectOption(format);
  const event = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download", exact: true }).click();
  const file = await event;
  const path = await file.path();
  expect(path).toBeTruthy();
  return readFile(path!);
}

test("CV editing, versions, photo, suggestions and real document exports", async ({
  page,
}) => {
  test.setTimeout(150000);
  await page.goto("/demo");
  await page.getByRole("button", { name: "CV editor", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "CV editor", exact: true }),
  ).toBeVisible();
  await page.getByLabel("Full name", { exact: true }).fill("Taylor Example");
  await page
    .getByLabel("Location", { exact: true })
    .fill("M\u00f6nsheim, Germany");
  await page
    .getByRole("button", { name: "Add point", exact: true })
    .first()
    .click();
  await page
    .getByLabel("Point 1", { exact: true })
    .fill("Worked on developing a navigation stack");
  await page
    .getByRole("button", { name: "Developed a navigation stack", exact: true })
    .click();
  await expect(page.getByLabel("Point 1", { exact: true })).toHaveValue(
    "Developed a navigation stack",
  );
  const photo = await sharp({
    create: {
      width: 160,
      height: 200,
      channels: 3,
      background: { r: 190, g: 40, b: 50 },
    },
  })
    .png()
    .toBuffer();
  await page.getByLabel("CV photo", { exact: true }).setInputFiles({
    name: "test-photo.png",
    mimeType: "image/png",
    buffer: photo,
  });
  await expect(page.getByAltText("CV portrait")).toBeVisible();
  await page.getByRole("button", { name: "Add section", exact: true }).click();
  await page
    .getByLabel("Section heading", { exact: true })
    .last()
    .fill("Awards");
  await page
    .getByLabel("Title / qualification", { exact: true })
    .last()
    .fill("Research award");
  await page
    .getByRole("button", { name: "Add entry", exact: true })
    .last()
    .click();
  await page
    .getByLabel("Title / qualification", { exact: true })
    .last()
    .fill("Community award");
  await page
    .getByRole("button", { name: "Move Awards up", exact: true })
    .click();
  await page.getByRole("button", { name: "Undo CV edit", exact: true }).click();
  await page.getByRole("button", { name: "Redo CV edit", exact: true }).click();
  await page.getByRole("button", { name: "Two pages", exact: true }).click();
  await expect(page.getByLabel("Full name", { exact: true })).toHaveValue(
    "Alex Morgan",
  );
  await page.getByLabel("Page for Technical Skills").selectOption("2");
  await editorView(page, "Preview");
  await expect(page.getByLabel("CV page count")).toHaveText("2 / 2 pages", {
    timeout: 60000,
  });
  const twoPdf = await download(page, "pdf");
  expect((await PDFDocument.load(twoPdf)).getPageCount()).toBe(2);
  const twoWord = await download(page, "docx");
  const twoZip = await JSZip.loadAsync(twoWord);
  expect(await twoZip.file("word/document.xml")!.async("string")).toContain(
    "pageBreakBefore",
  );
  await page.getByRole("button", { name: "One page", exact: true }).click();
  await expect(page.getByLabel("CV page count")).toHaveText("1 / 1 page", {
    timeout: 60000,
  });
  await expect(page.getByAltText("CV page 1", { exact: true })).toBeVisible();
  const nonblank = await page
    .getByAltText("CV page 1", { exact: true })
    .evaluate((image: HTMLImageElement) => {
      const canvas = document.createElement("canvas");
      canvas.width = 595;
      canvas.height = 842;
      const context = canvas.getContext("2d")!;
      context.drawImage(image, 0, 0, 595, 842);
      const pixels = context.getImageData(0, 0, 595, 842).data;
      let ink = 0;
      for (let index = 0; index < pixels.length; index += 4)
        if (
          pixels[index] < 200 &&
          pixels[index + 1] < 200 &&
          pixels[index + 2] < 200
        )
          ink++;
      return ink;
    });
  expect(nonblank).toBeGreaterThan(2000);
  await page.getByLabel("Preview zoom", { exact: true }).selectOption("150");
  expect(
    (await page.getByAltText("CV page 1", { exact: true }).boundingBox())!
      .width,
  ).toBeGreaterThan(800);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.getByLabel("Preview zoom", { exact: true }).selectOption("fit");
  const onePdf = await download(page, "pdf");
  expect((await PDFDocument.load(onePdf)).getPageCount()).toBe(1);
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data: new Uint8Array(onePdf) });
  try {
    const text = (await parser.getText()).text;
    expect(text).toContain("Taylor Example");
    expect(text).toContain("Developed a navigation stack");
    expect(text).toContain("M\u00f6nsheim");
  } finally {
    await parser.destroy();
  }
  const word = await download(page, "docx");
  const wordText = (await mammoth.extractRawText({ buffer: word })).value;
  expect(wordText).toContain("Taylor Example");
  expect(wordText).toContain("Developed a navigation stack");
  const zip = await JSZip.loadAsync(word);
  expect(
    Object.keys(zip.files).some(
      (path) => path.startsWith("word/media/") && path.endsWith(".jpg"),
    ),
  ).toBe(true);
  expect((await download(page, "txt")).toString()).toContain("Research award");
  const backup = JSON.parse((await download(page, "json")).toString());
  expect(backup.one.fullName).toBe("Taylor Example");
  expect(backup.two.fullName).toBe("Alex Morgan");
  expect(backup.one.photo).toMatch(/^data:image\/jpeg;base64,/);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: test.info().outputPath("cv-preview.png"),
    fullPage: false,
  });
  await editorView(page, "Edit");
  await page
    .getByRole("button", { name: "Profile & preferences", exact: true })
    .click();
  await page.getByRole("button", { name: "CV editor", exact: true }).click();
  await expect(page.getByLabel("Full name", { exact: true })).toHaveValue(
    "Taylor Example",
  );
  await page.getByRole("button", { name: "Save CVs", exact: true }).click();
  await expect(
    page
      .getByRole("status")
      .filter({ hasText: "Demo drafts stay in this tab only" }),
  ).toBeVisible();
  await page.screenshot({
    path: test.info().outputPath("cv-editor.png"),
    fullPage: false,
  });
});

test("CV imports, invalid photos, and page overflow fail safely", async ({
  page,
}) => {
  test.setTimeout(90000);
  await page.goto("/demo");
  await page.getByRole("button", { name: "CV editor", exact: true }).click();
  await page.getByLabel("CV photo", { exact: true }).setInputFiles({
    name: "unsafe.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from("<svg />"),
  });
  await expect(
    page
      .getByRole("region", { name: "CV editor", exact: true })
      .getByRole("alert"),
  ).toContainText("Choose a JPG, PNG, or WebP");
  await page
    .getByLabel("Import CV JSON backup", { exact: true })
    .setInputFiles({
      name: "bad.json",
      mimeType: "application/json",
      buffer: Buffer.from('{"one":{}}'),
    });
  await expect(
    page
      .getByRole("region", { name: "CV editor", exact: true })
      .getByRole("alert"),
  ).toContainText("not a valid Rolevia CV backup");
  const backup = await download(page, "json");
  const data = JSON.parse(backup.toString());
  data.one.fullName = "Imported Draft";
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByLabel("Import CV JSON backup", { exact: true })
    .setInputFiles({
      name: "cv.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(data)),
    });
  await editorView(page, "Edit");
  await expect(page.getByLabel("Full name", { exact: true })).toHaveValue(
    "Imported Draft",
  );
  await page
    .getByLabel("Description", { exact: true })
    .first()
    .fill(
      "A detailed description of verified work on navigation and simulation systems. ".repeat(
        38,
      ),
    );
  await page
    .getByLabel("Summary", { exact: true })
    .fill(
      "Documented project outcomes and collaboration across engineering teams. ".repeat(
        35,
      ),
    );
  await editorView(page, "Preview");
  await expect(
    page.getByRole("alert").filter({ hasText: "This CV exceeds 1 page" }),
  ).toBeVisible({ timeout: 60000 });
  await page.getByLabel("CV export format").selectOption("pdf");
  await expect(
    page.getByRole("button", { name: "Download", exact: true }),
  ).toBeDisabled();
  await page.getByLabel("CV export format").selectOption("json");
  await expect(
    page.getByRole("button", { name: "Download", exact: true }),
  ).toBeEnabled();
});
