import fs from "fs";
import path from "path";
import { test, expect } from "@playwright/test";
import { comparePdfPair, PairConfig } from "../../core/pdf/compare/comparePdfPair.js";
import { generateHtmlReport } from "../../core/pdf/report/generateHtmlReport.js";

test.skip(({ browserName }) => browserName !== "chromium", "PDF compare is Node-only; run once.");

const BASELINE_DIR = path.resolve("artifacts/pdf/baseline");
const OUTPUT_DIR = path.resolve("artifacts/pdf/output");
const RUNS_DIR = path.resolve("artifacts/runs");

function listPdfFiles(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter(f => f.toLowerCase().endsWith(".pdf"))
    .map(f => path.join(dir, f));
}

function buildPairs(): PairConfig[] {
  const baselineFiles = listPdfFiles(BASELINE_DIR);
  const outputFiles = listPdfFiles(OUTPUT_DIR);

  const normalize = (p: string) =>
    path.basename(p)
      .replace(/_Baseline\.pdf$/i, "")
      .replace(/_Output\.pdf$/i, "");

  const baselineMap = new Map<string, string>();
  for (const b of baselineFiles) baselineMap.set(normalize(b), b);

  const pairs: PairConfig[] = [];
  for (const o of outputFiles) {
    const key = normalize(o);
    const b = baselineMap.get(key);
    if (!b) continue;

    pairs.push({
      pairName: key,
      baselinePdfPath: b,
      outputPdfPath: o,
      maxDiffPercent: 0,  
      pixelmatchThreshold: 0.1, 
    });
  }

  return pairs;
}

let allResults: any[] = [];
let testRunId: string;
let testRunRootDir: string;

function makeRunId() {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const rnd = Math.random().toString(16).slice(2, 8);
  return `${ts}_${rnd}`;
}

test.describe("PDF visual comparison", () => {
  test.beforeAll(() => {
    fs.mkdirSync(RUNS_DIR, { recursive: true });
    testRunId = makeRunId();
    testRunRootDir = path.join(RUNS_DIR, testRunId);
    fs.mkdirSync(testRunRootDir, { recursive: true });
  });

  const pairs = buildPairs();
  
  test.beforeAll(() => {
    if (pairs.length === 0) {
      throw new Error("No PDF pairs found in baseline and output directories.");
    }
  });

  // create a separate test for each pair
  for (const pair of pairs) {
    test(`compare ${pair.pairName}`, async ({}, testInfo) => {
      const result = await comparePdfPair(pair, testRunRootDir);
      allResults.push(result);

      const pairJsonPath = path.join(testRunRootDir, pair.pairName, "pair-result.json");
      fs.writeFileSync(pairJsonPath, JSON.stringify(result, null, 2), "utf-8");
      await testInfo.attach(`result.json`, {
        path: pairJsonPath,
        contentType: "application/json",
      });

      for (const p of result.pageDiffs ?? []) {
        const baseImg = path.join(testRunRootDir, p.baselineImage);
        const outImg = path.join(testRunRootDir, p.outputImage);
        const diffImg = path.join(testRunRootDir, p.diffImage);

        if (fs.existsSync(baseImg)) {
          await testInfo.attach(`page-${p.pageNumber}-baseline.png`, {
            path: baseImg,
            contentType: "image/png",
          });
        }
        if (fs.existsSync(outImg)) {
          await testInfo.attach(`page-${p.pageNumber}-output.png`, {
            path: outImg,
            contentType: "image/png",
          });
        }
        if (fs.existsSync(diffImg)) {
          await testInfo.attach(`page-${p.pageNumber}-diff.png`, {
            path: diffImg,
            contentType: "image/png",
          });
        }
      }

      // attach text diffs if any
      if (result.textDiffs) {
        for (const t of result.textDiffs) {
          const txtPath = path.join(testRunRootDir, pair.pairName, `page-${t.pageNumber}-text-diff.json`);
          fs.writeFileSync(txtPath, JSON.stringify(t, null, 2), "utf-8");
          await testInfo.attach(`page-${t.pageNumber}-text-diff.json`, {
            path: txtPath,
            contentType: "application/json",
          });
        }
      }

      // assert this pair passed
      expect(result.overall, `PDF pair "${pair.pairName}" failed`).toBe("PASS");
    });
  }

  test.afterAll(async () => {
    // generate unified report after all tests complete
    const summary = {
      runId: testRunId,
      createdAt: new Date().toISOString(),
      results: allResults,
    };

    const summaryPath = path.join(testRunRootDir, "summary.json");
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), "utf-8");

    generateHtmlReport(testRunRootDir, summary);
  });
});