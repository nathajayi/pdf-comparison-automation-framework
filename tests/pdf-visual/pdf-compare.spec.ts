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

  // Expect naming like: sample_file_1_Baseline.pdf and sample_file_1_Output.pdf
  // We'll match by stripping _Baseline/_Output.
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
      pairName: key, // nice readable name
      baselinePdfPath: b,
      outputPdfPath: o,
      maxDiffPercent: 0,          // strict. adjust if you see anti-alias noise
      pixelmatchThreshold: 0.1,   // sensitivity
    });
  }

  return pairs;
}

function makeRunId() {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  const rnd = Math.random().toString(16).slice(2, 8);
  return `${ts}_${rnd}`;
}

test.describe("PDF visual comparison", () => {
  test("compare baseline vs output PDF pairs and generate report", async ({}, testInfo) => {
    const pairs = buildPairs();
    expect(pairs.length).toBeGreaterThan(0);

    fs.mkdirSync(RUNS_DIR, { recursive: true });
    const runId = makeRunId();
    const runRootDir = path.join(RUNS_DIR, runId);
    fs.mkdirSync(runRootDir, { recursive: true });

    const results = [];
    for (const pair of pairs) {
      const result = await comparePdfPair(pair, runRootDir);
      results.push(result);

      // Attach pair JSON + key images to Playwright report (nice bonus)
      const pairJsonPath = path.join(runRootDir, pair.pairName, "pair-result.json");
      fs.writeFileSync(pairJsonPath, JSON.stringify(result, null, 2), "utf-8");
      await testInfo.attach(`${pair.pairName}-result.json`, {
        path: pairJsonPath,
        contentType: "application/json",
      });

      for (const p of result.pageDiffs ?? []) {
        // p.baselineImage is relative to run root; resolve it
        const baseImg = path.join(runRootDir, p.baselineImage);
        const outImg = path.join(runRootDir, p.outputImage);
        const diffImg = path.join(runRootDir, p.diffImage);

        if (fs.existsSync(baseImg)) await testInfo.attach(`${pair.pairName}-page-${p.pageNumber}-baseline.png`, { path: baseImg, contentType: "image/png" });
        if (fs.existsSync(outImg)) await testInfo.attach(`${pair.pairName}-page-${p.pageNumber}-output.png`, { path: outImg, contentType: "image/png" });
        if (fs.existsSync(diffImg)) await testInfo.attach(`${pair.pairName}-page-${p.pageNumber}-diff.png`, { path: diffImg, contentType: "image/png" });
      }
    }

    const summary = {
      runId,
      createdAt: new Date().toISOString(),
      results,
    };

    const summaryPath = path.join(runRootDir, "summary.json");
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), "utf-8");
    await testInfo.attach("summary.json", { path: summaryPath, contentType: "application/json" });

    generateHtmlReport(runRootDir, summary);
    const reportPath = path.join(runRootDir, "report.html");
    await testInfo.attach("pdf-visual-report.html", { path: reportPath, contentType: "text/html" });

    // Fail the test if any pair FAILs (so CI clearly shows red/green)
    const failed = results.filter((r: any) => r.overall === "FAIL");
    expect(failed, `Some PDF pairs failed. Open: ${reportPath}`).toHaveLength(0);
  });
});