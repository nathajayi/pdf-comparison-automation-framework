import fs from "fs";
import path from "path";
import { renderPdfToPng } from "../../../core/pdf/render/renderPdfToPng.js";
import { getPdfMetadata } from "../../../core/pdf/metadata/getPdfMetadata.js";
import { comparePng } from "../../../core/pdf/compare/comparePng.js";

export type PairConfig = {
  pairName: string;
  baselinePdfPath: string;
  outputPdfPath: string;

  // Visual diff rule
  maxDiffPercent?: number; // default 0
  pixelmatchThreshold?: number; // default 0.1

  // Rendering
  renderDpi?: number; // default 150
};

export type PageDiff = {
  pageNumber: number;
  diffPixels: number;
  diffPercent: number;
  sameDimensions: boolean;

  baselineImage: string; // relative to run root
  outputImage: string;
  diffImage: string;
};

export type PairResult = {
  pairName: string;
  baselineFileName: string;
  outputFileName: string;

  overall: "PASS" | "FAIL";

  baselinePageCount: number;
  outputPageCount: number;

  pagesWithDifferences: number[];
  pageDiffs: PageDiff[];

  // metadata checks
  rotationMismatches: Array<{ pageNumber: number; baselineRotate: number; outputRotate: number }>;
  bookmarkDiff: {
    baselineCount: number;
    outputCount: number;
    // best-effort: titles only
    missingTitles: string[];
    extraTitles: string[];
  };
};

function ensureDir(dir: string) {
  fs.mkdirSync(dir, { recursive: true });
}

function rel(fromDir: string, filePath: string) {
  return path.relative(fromDir, filePath).split(path.sep).join("/");
}

export async function comparePdfPair(cfg: PairConfig, runRootDir: string): Promise<PairResult> {
  const maxDiffPercent = cfg.maxDiffPercent ?? 0;
  const pixelmatchThreshold = cfg.pixelmatchThreshold ?? 0.1;
  const renderDpi = cfg.renderDpi ?? 150;

  const pairDir = path.join(runRootDir, cfg.pairName);
  const baselineImgDir = path.join(pairDir, "baseline");
  const outputImgDir = path.join(pairDir, "output");
  const diffImgDir = path.join(pairDir, "diff");

  ensureDir(baselineImgDir);
  ensureDir(outputImgDir);
  ensureDir(diffImgDir);

  // Metadata first
  const baselineMeta = await getPdfMetadata(cfg.baselinePdfPath);
  const outputMeta = await getPdfMetadata(cfg.outputPdfPath);

  const rotationMismatches: PairResult["rotationMismatches"] = [];
  const minPagesForRotation = Math.min(baselineMeta.pageCount, outputMeta.pageCount);
  for (let i = 0; i < minPagesForRotation; i++) {
    const bR = baselineMeta.rotations[i] ?? 0;
    const oR = outputMeta.rotations[i] ?? 0;
    if (bR !== oR) rotationMismatches.push({ pageNumber: i + 1, baselineRotate: bR, outputRotate: oR });
  }

  // bookmark titles best-effort diff (titles only)
  const baselineTitles = baselineMeta.outlineTitles;
  const outputTitles = outputMeta.outlineTitles;

  const baselineSet = new Set(baselineTitles);
  const outputSet = new Set(outputTitles);

  const missingTitles = baselineTitles.filter(t => !outputSet.has(t));
  const extraTitles = outputTitles.filter(t => !baselineSet.has(t));

  // Render to images
  const baselineRender = await renderPdfToPng(
  cfg.baselinePdfPath,
  baselineImgDir,
  { dpi: cfg.renderDpi }
);

const outputRender = await renderPdfToPng(
  cfg.outputPdfPath,
  outputImgDir,
  { dpi: cfg.renderDpi }
);

  const baselinePageCount = baselineRender.pageCount;
  const outputPageCount = outputRender.pageCount;

  const pagesToCompare = Math.min(baselinePageCount, outputPageCount);

  const pageDiffs: PageDiff[] = [];
  const pagesWithDifferences: number[] = [];

  for (let page = 1; page <= pagesToCompare; page++) {
    const baselinePng = baselineRender.pageImagePaths[page - 1];
    const outputPng = outputRender.pageImagePaths[page - 1];
    const diffPng = path.join(diffImgDir, `page-${String(page).padStart(3, "0")}-diff.png`);

    const diff = await comparePng(baselinePng, outputPng, diffPng, { threshold: pixelmatchThreshold });

    const isDifferent =
      !diff.sameDimensions || diff.diffPercent > maxDiffPercent;

    if (isDifferent) pagesWithDifferences.push(page);

    pageDiffs.push({
      pageNumber: page,
      diffPixels: diff.diffPixels,
      diffPercent: Number(diff.diffPercent.toFixed(4)),
      sameDimensions: diff.sameDimensions,
      baselineImage: rel(runRootDir, baselinePng),
      outputImage: rel(runRootDir, outputPng),
      diffImage: rel(runRootDir, diffPng),
    });
  }

  // Page count mismatch counts as failure
  const pageCountMismatch = baselinePageCount !== outputPageCount;

  // rotation mismatch counts as failure
  const rotationMismatch = rotationMismatches.length > 0;

  // bookmark mismatch counts as failure (best-effort)
  const bookmarkMismatch = missingTitles.length > 0 || extraTitles.length > 0;

  // any visual diffs counts as failure
  const visualMismatch = pagesWithDifferences.length > 0;

  const overall: "PASS" | "FAIL" =
    (pageCountMismatch || rotationMismatch || bookmarkMismatch || visualMismatch) ? "FAIL" : "PASS";

  return {
    pairName: cfg.pairName,
    baselineFileName: path.basename(cfg.baselinePdfPath),
    outputFileName: path.basename(cfg.outputPdfPath),
    overall,
    baselinePageCount,
    outputPageCount,
    pagesWithDifferences,
    pageDiffs: pageDiffs.filter(p => pagesWithDifferences.includes(p.pageNumber)),
    rotationMismatches,
    bookmarkDiff: {
      baselineCount: baselineTitles.length,
      outputCount: outputTitles.length,
      missingTitles,
      extraTitles,
    },
  };
}