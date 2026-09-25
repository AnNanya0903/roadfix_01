import type { Category, Issue } from './domain';
import { isClosed } from './domain';
import { distanceMeters } from './geo';

/** 64-bit difference hash (dHash) of an image, as 16 hex chars. Visually similar photos give nearby hashes. */
export async function computeImageHash(source: Blob | string): Promise<string | null> {
  try {
    const url = typeof source === 'string' ? source : URL.createObjectURL(source);
    const img = await loadImage(url);
    if (typeof source !== 'string') URL.revokeObjectURL(url);
    const canvas = document.createElement('canvas');
    canvas.width = 9;
    canvas.height = 8;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, 9, 8);
    const px = ctx.getImageData(0, 0, 9, 8).data;
    const gray = (x: number, y: number) => {
      const i = (y * 9 + x) * 4;
      return px[i] * 0.299 + px[i + 1] * 0.587 + px[i + 2] * 0.114;
    };
    let bits = '';
    for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bits += gray(x, y) > gray(x + 1, y) ? '1' : '0';
    let hex = '';
    for (let i = 0; i < 64; i += 4) hex += parseInt(bits.slice(i, i + 4), 2).toString(16);
    return hex;
  } catch {
    return null;
  }
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not read that image.'));
    img.src = src;
  });
}

export function hammingDistance(a: string, b: string): number {
  let d = 0;
  for (let i = 0; i < Math.min(a.length, b.length); i++) {
    let x = parseInt(a[i], 16) ^ parseInt(b[i], 16);
    while (x) {
      d += x & 1;
      x >>= 1;
    }
  }
  return d;
}

function words(text: string): Set<string> {
  return new Set(text.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter((w) => w.length > 2));
}

function textSimilarity(a: string, b: string): number {
  const A = words(a);
  const B = words(b);
  if (!A.size || !B.size) return 0;
  let overlap = 0;
  A.forEach((w) => B.has(w) && overlap++);
  return overlap / Math.max(A.size, B.size);
}

export interface DuplicateCandidate {
  category: Category;
  latitude: number;
  longitude: number;
  description: string;
  imageHash: string | null;
}

export interface DuplicateMatch {
  issue: Issue;
  distanceM: number;
  score: number;
  reasons: string[];
}

export const DUPLICATE_THRESHOLD = 55;

/**
 * Rule-based duplicate check: GPS proximity, category, photo similarity, recency, wording.
 * Returns suggestions only. Nothing is merged without the citizen's confirmation.
 */
export function findDuplicates(candidate: DuplicateCandidate, issues: Issue[], now = new Date()): DuplicateMatch[] {
  const matches: DuplicateMatch[] = [];
  for (const issue of issues) {
    if (isClosed(issue.status)) continue;
    const d = distanceMeters(candidate.latitude, candidate.longitude, issue.latitude, issue.longitude);
    if (d > 300) continue;
    const sameCategory = issue.category === candidate.category;
    if (!sameCategory && d > 75) continue;

    let score = d <= 30 ? 45 : d <= 75 ? 38 : d <= 150 ? 25 : 10;
    const reasons = [`${Math.round(d)} m from the pin you chose`];
    if (sameCategory) {
      score += 25;
      reasons.push('Same type of issue');
    }
    if (candidate.imageHash && issue.imageHash) {
      const h = hammingDistance(candidate.imageHash, issue.imageHash);
      if (h <= 8) {
        score += 25;
        reasons.push('Photo looks very similar');
      } else if (h <= 14) {
        score += 12;
        reasons.push('Photo looks somewhat similar');
      }
    }
    if (now.getTime() - new Date(issue.createdAt).getTime() < 45 * 86400000) {
      score += 5;
      reasons.push('Reported in the last 45 days');
    }
    if (textSimilarity(candidate.description, issue.description) >= 0.4) {
      score += 5;
      reasons.push('Similar description');
    }
    if (score >= DUPLICATE_THRESHOLD) matches.push({ issue, distanceM: d, score: Math.min(100, score), reasons });
  }
  return matches.sort((a, b) => b.score - a.score).slice(0, 3);
}
