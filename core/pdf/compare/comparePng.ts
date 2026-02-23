import fs from "fs";
import { PNG } from "pngjs";
import pixelmatch from "pixelmatch";

export type ImageDiffResult = {
  diffPixels: number;
  diffPercent: number; // 0..100
  sameDimensions: boolean;
  width: number;
  height: number;
};

export async function comparePng(
  baselinePngPath: string,
  outputPngPath: string,
  diffPngPath: string,
  options?: { threshold?: number } // pixelmatch threshold (0..1). default 0.1
): Promise<ImageDiffResult> {
  const threshold = options?.threshold ?? 0.1;

  const baseline = PNG.sync.read(fs.readFileSync(baselinePngPath));
  const output = PNG.sync.read(fs.readFileSync(outputPngPath));

  const sameDimensions = baseline.width === output.width && baseline.height === output.height;

  // If dimensions differ, still compute diff on min area and mark mismatch.
  const width = Math.min(baseline.width, output.width);
  const height = Math.min(baseline.height, output.height);

  const b = new PNG({ width, height });
  const o = new PNG({ width, height });

  // copy pixels into cropped buffers
  PNG.bitblt(baseline, b, 0, 0, width, height, 0, 0);
  PNG.bitblt(output, o, 0, 0, width, height, 0, 0);

  const diff = new PNG({ width, height });

  const diffPixels = pixelmatch(b.data, o.data, diff.data, width, height, { threshold });
  fs.writeFileSync(diffPngPath, PNG.sync.write(diff));

  const totalPixels = width * height;
  const diffPercent = totalPixels === 0 ? 0 : (diffPixels / totalPixels) * 100;

  return { diffPixels, diffPercent, sameDimensions, width, height };
}