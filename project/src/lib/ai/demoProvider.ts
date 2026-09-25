import type { AIAnalysis, Category, ResolutionComparison, Severity } from '../domain';
import { CATEGORY_META } from '../domain';
import { computeImageHash, loadImage } from '../duplicates';
import type { AIProvider, ImageInput } from './types';

interface ImageStats {
  darkRatio: number;
  texture: number;
  hash: string;
}

async function readStats(input: ImageInput): Promise<ImageStats> {
  const src = input.blob ? URL.createObjectURL(input.blob) : input.url;
  if (!src) throw new Error('No image supplied.');
  try {
    const img = await loadImage(src);
    const size = 96;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) throw new Error('Canvas unavailable');
    ctx.drawImage(img, 0, 0, size, size);
    const px = ctx.getImageData(0, 0, size, size).data;
    let dark = 0;
    let grad = 0;
    let prev = 0;
    for (let i = 0; i < px.length; i += 4) {
      const lum = px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114;
      if (lum < 40) dark += 1;
      grad += Math.abs(lum - prev);
      prev = lum;
    }
    const n = px.length / 4;
    const hash = (await computeImageHash(src)) ?? '0000000000000000';
    return { darkRatio: dark / n, texture: grad / n, hash };
  } finally {
    if (input.blob && src) URL.revokeObjectURL(src);
  }
}

const NAME_HINTS: Array<[RegExp, Category]> = [
  [/pothole|pit|crater/i, 'pothole'],
  [/crack/i, 'road_crack'],
  [/water|flood|logging|drain/i, 'waterlogging'],
  [/light|lamp/i, 'streetlight'],
  [/tree|branch/i, 'fallen_tree'],
  [/debris|garbage|trash|rubble/i, 'debris'],
  [/sign|board/i, 'damaged_sign'],
  [/manhole/i, 'open_manhole'],
  [/block|obstruct|barrier/i, 'obstruction'],
];

function hashToInt(hex: string): number {
  return parseInt(hex.slice(0, 8), 16) >>> 0;
}

/**
 * Deterministic, clearly-labelled stand-in for a vision model. The measurements it
 * reports (dark-area share, texture) are computed from the actual pixels, but the
 * category comes from a filename/sample hint or a hash-based guess. It is NOT a trained
 * road-damage detector, and the UI labels every result as demo output.
 */
export const demoProvider: AIProvider = {
  id: 'demo-analyzer',
  label: 'RoadFix demo analyzer',
  mode: 'demo',

  async analyzeImage(input: ImageInput): Promise<AIAnalysis> {
    const stats = await readStats(input);
    await new Promise((r) => setTimeout(r, 900)); // let the progress state be visible
    let category: Category | undefined = input.sampleHint;
    const hintSource = category ? 'sample photo metadata' : 'file name';
    if (!category && input.fileName) category = NAME_HINTS.find(([re]) => re.test(input.fileName!))?.[1];
    const guessed = !category;
    if (!category) {
      const pool: Category[] = ['pothole', 'pothole', 'road_crack', 'waterlogging', 'debris', 'other'];
      category = pool[hashToInt(stats.hash) % pool.length];
    }
    const severity: Severity = stats.darkRatio > 0.06 ? 'high' : stats.darkRatio > 0.025 ? 'medium' : 'low';
    const confidence = Math.round((0.74 + ((hashToInt(stats.hash) >>> 3) % 21) / 100) * 100) / 100;
    const pct = Math.round(stats.darkRatio * 100);
    return {
      mode: 'demo',
      provider: demoProvider.label,
      category,
      confidence: guessed ? Math.min(confidence, 0.7) : confidence,
      severity,
      description: `Possible ${CATEGORY_META[category].label.toLowerCase()} on the roadway. Demo estimate: please confirm the type below.`,
      evidence: [
        `Very dark area covers about ${pct}% of the photo`,
        `Surface texture variation is ${stats.texture > 14 ? 'high' : stats.texture > 7 ? 'moderate' : 'low'}`,
        guessed ? 'Issue type is a hash-based guess in demo mode' : `Issue type taken from ${hintSource}`,
      ],
      analyzedAt: new Date().toISOString(),
    };
  },

  async compareResolution(before: ImageInput, after: ImageInput): Promise<ResolutionComparison> {
    const [b, a] = await Promise.all([readStats(before), readStats(after)]);
    await new Promise((r) => setTimeout(r, 900));
    const drop = b.darkRatio - a.darkRatio;
    const bPct = Math.round(b.darkRatio * 100);
    const aPct = Math.round(a.darkRatio * 100);
    let verdict: ResolutionComparison['verdict'];
    if (b.darkRatio > 0.02 && (a.darkRatio <= b.darkRatio * 0.4 || drop > 0.06)) verdict = 'improved';
    else if (a.darkRatio >= b.darkRatio * 0.9) verdict = 'not_improved';
    else verdict = 'unclear';
    return {
      mode: 'demo',
      provider: demoProvider.label,
      verdict,
      confidence: verdict === 'improved' ? 0.8 : verdict === 'unclear' ? 0.5 : 0.7,
      beforeSummary: `Damage indicators present: very dark area about ${bPct}% of the photo`,
      afterSummary:
        verdict === 'improved'
          ? `Road surface appears repaired: dark area now about ${aPct}%`
          : verdict === 'not_improved'
            ? `Damage indicators still visible: dark area about ${aPct}%`
            : `Change is unclear: dark area about ${aPct}%`,
      note:
        verdict === 'improved'
          ? 'AI-assisted visual comparison suggests improvement. Please confirm with your own eyes.'
          : verdict === 'not_improved'
            ? 'AI-assisted visual comparison does not show clear improvement. Check the site and tell us what you see.'
            : 'The comparison is inconclusive. A clearer after-repair photo from the same angle helps.',
    };
  },
};
