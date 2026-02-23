import fs from "fs";
import path from "path";

export type RunSummary = {
  runId: string;
  createdAt: string;
  results: any[]; // PairResult[]
};

function esc(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function generateHtmlReport(runRootDir: string, summary: RunSummary) {
  const htmlPath = path.join(runRootDir, "report.html");

  const rows = summary.results.map((r: any) => {
    const diffPages = r.pagesWithDifferences?.length ? r.pagesWithDifferences.join(", ") : "—";
    return `
      <tr>
        <td>${esc(r.pairName)}</td>
        <td>${esc(r.baselineFileName)}</td>
        <td>${esc(r.outputFileName)}</td>
        <td><b class="${r.overall === "PASS" ? "pass" : "fail"}">${r.overall}</b></td>
        <td>${r.baselinePageCount} vs ${r.outputPageCount}</td>
        <td>${esc(diffPages)}</td>
      </tr>
    `;
  }).join("");

  const details = summary.results.map((r: any) => {
    const pages = r.pageDiffs ?? [];
    const pageBlocks = pages.length
      ? pages.map((p: any) => `
        <div class="page">
          <h4>Page ${p.pageNumber} — diff: ${p.diffPixels} px (${p.diffPercent}%)</h4>
          <div class="thumbs">
            <a href="${p.baselineImage}" target="_blank">
              <img src="${p.baselineImage}" alt="Baseline page ${p.pageNumber}">
              <div class="cap">Baseline</div>
            </a>
            <a href="${p.outputImage}" target="_blank">
              <img src="${p.outputImage}" alt="Output page ${p.pageNumber}">
              <div class="cap">Output</div>
            </a>
            <a href="${p.diffImage}" target="_blank">
              <img src="${p.diffImage}" alt="Diff page ${p.pageNumber}">
              <div class="cap">Diff</div>
            </a>
          </div>
        </div>
      `).join("")
      : `<div class="muted">No differing pages.</div>`;

    const meta = `
      <div class="meta">
        <div><b>Rotation mismatches:</b> ${r.rotationMismatches?.length ? esc(JSON.stringify(r.rotationMismatches)) : "None"}</div>
        <div><b>Bookmark diff:</b> baseline=${r.bookmarkDiff?.baselineCount ?? 0}, output=${r.bookmarkDiff?.outputCount ?? 0},
          missingTitles=${r.bookmarkDiff?.missingTitles?.length ?? 0}, extraTitles=${r.bookmarkDiff?.extraTitles?.length ?? 0}
        </div>
      </div>
    `;

    return `
      <section class="pair">
        <h3>${esc(r.pairName)} — <span class="${r.overall === "PASS" ? "pass" : "fail"}">${r.overall}</span></h3>
        <div class="muted">${esc(r.baselineFileName)} vs ${esc(r.outputFileName)}</div>
        ${meta}
        ${pageBlocks}
      </section>
    `;
  }).join("");

  const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>PDF Visual Compare Report</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 24px; }
    table { border-collapse: collapse; width: 100%; margin-top: 12px; }
    th, td { border: 1px solid #ddd; padding: 8px; font-size: 14px; }
    th { background: #f5f5f5; text-align: left; }
    .pass { color: #0a7a0a; }
    .fail { color: #b00020; }
    .muted { color: #666; font-size: 13px; margin-top: 6px; }
    .pair { margin-top: 28px; padding-top: 18px; border-top: 2px solid #eee; }
    .thumbs { display: flex; gap: 16px; margin: 12px 0; flex-wrap: wrap; }
    .thumbs a { text-decoration: none; color: inherit; width: 280px; }
    .thumbs img { width: 100%; border: 1px solid #ddd; }
    .cap { font-size: 12px; color: #333; margin-top: 4px; }
    .page { margin-top: 14px; }
    .meta { margin-top: 10px; font-size: 13px; }
  </style>
</head>
<body>
  <h1>PDF Visual Compare Report</h1>
  <div class="muted">Run: ${esc(summary.runId)} • Created: ${esc(summary.createdAt)}</div>

  <h2>Summary</h2>
  <table>
    <thead>
      <tr>
        <th>Pair</th>
        <th>Baseline</th>
        <th>Output</th>
        <th>Result</th>
        <th>Page Count</th>
        <th>Pages with Diffs</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>

  ${details}
</body>
</html>`;

  fs.writeFileSync(htmlPath, html, "utf-8");
}