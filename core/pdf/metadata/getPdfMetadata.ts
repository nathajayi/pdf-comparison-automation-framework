import fs from "fs";
import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";

export type PdfMetadata = {
  pageCount: number;
  rotations: number[];
  outlineTitles: string[];
  /** text extracted from each page, normalized to a single string */
  pageTexts: string[];
};

export async function getPdfMetadata(pdfPath: string): Promise<PdfMetadata> {
  const data = new Uint8Array(fs.readFileSync(pdfPath));
  const loadingTask = pdfjsLib.getDocument({ data });
  const pdf = await loadingTask.promise;

  const pageCount = pdf.numPages;
  const rotations: number[] = [];

  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const rotate = (page.rotate ?? 0) % 360;
    rotations.push(rotate);
  }

  const outline = await pdf.getOutline().catch(() => null);

  const outlineTitles: string[] = [];
  const walk = (items: any[]) => {
    for (const it of items) {
      if (it?.title) outlineTitles.push(String(it.title));
      if (it?.items?.length) walk(it.items);
    }
  };
  if (Array.isArray(outline)) walk(outline);

  // extract raw text from each page
  const pageTexts: string[] = [];
  for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    const items = content.items.map((i: any) => i.str || "");
    pageTexts.push(items.join(" "));
  }

  return { pageCount, rotations, outlineTitles, pageTexts };
}