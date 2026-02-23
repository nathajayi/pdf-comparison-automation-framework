import fs from "fs";
import path from "path";
import { Poppler } from "node-poppler";

export type RenderOptions = {
  dpi?: number;       // default 150
  maxPages?: number;  // default 500
};

export type RenderResult = {
  pageCount: number;
  pageImagePaths: string[];
};

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function pad3(n: number) {
  return String(n).padStart(3, "0");
}

function listPngs(dir: string) {
  return fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith(".png"))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    .map((f) => path.join(dir, f));
}

export async function renderPdfToPng(
  pdfPath: string,
  outDir: string,
  options: RenderOptions = {}
): Promise<RenderResult> {
  const dpi = options.dpi ?? 150;
  const maxPages = options.maxPages ?? 500;

  ensureDir(outDir);

  const poppler = new Poppler();

  // Poppler writes files like: <prefix>-1.png, <prefix>-2.png, ...
  const prefix = path.join(outDir, "page");

  try {
    await poppler.pdfToPpm(pdfPath, prefix, {
  pngFile: true,
  resolutionXAxis: 150,
  resolutionYAxis: 150,
} as any); // keep if your typings don’t include these props
  } catch (e: any) {
    // Make the error actionable (usually PATH / missing poppler)
    throw new Error(
      `Poppler render failed. Ensure 'pdftoppm' is installed and on PATH.\n` +
        `Tried rendering: ${pdfPath}\n` +
        `Original error: ${e?.message ?? e}`
    );
  }

  const generated = listPngs(outDir);
  if (!generated.length) {
    throw new Error(`Poppler produced no PNGs for: ${pdfPath}`);
  }
  if (generated.length > maxPages) {
    throw new Error(
      `PDF pages (${generated.length}) exceed maxPages=${maxPages}: ${pdfPath}`
    );
  }

  // Normalize names to: page-001.png, page-002.png, ...
  const pageImagePaths: string[] = [];
  for (let i = 0; i < generated.length; i++) {
    const src = generated[i];
    const dst = path.join(outDir, `page-${pad3(i + 1)}.png`);

    if (path.resolve(src) !== path.resolve(dst)) {
      fs.copyFileSync(src, dst);
      fs.unlinkSync(src);
    }
    pageImagePaths.push(dst);
  }

  return { pageCount: pageImagePaths.length, pageImagePaths };
}