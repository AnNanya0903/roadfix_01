import { aiProvider } from './ai';
import type { AIAnalysis } from './domain';
import { demoPhotoUrl, UploadError } from './photos';

export interface ScanFrame {
  timeSec: number;
  dataUrl: string;
  analysis: AIAnalysis | null;
  error?: string;
}

/** Pull evenly spaced frames from a video in the browser. */
export async function extractFrames(file: File, count = 8, onProgress?: (done: number, total: number) => void): Promise<Array<{ timeSec: number; dataUrl: string }>> {
  const url = URL.createObjectURL(file);
  try {
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.src = url;
    await new Promise<void>((resolve, reject) => {
      video.onloadedmetadata = () => resolve();
      video.onerror = () => reject(new UploadError('That video could not be read. Try an MP4 or WebM recorded on a phone.'));
      setTimeout(() => reject(new UploadError('The video took too long to load.')), 15000);
    });
    const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : 0;
    if (!duration) throw new UploadError('The video has no readable duration.');
    const n = Math.min(count, Math.max(2, Math.floor(duration)));
    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 640 / (video.videoWidth || 640));
    canvas.width = Math.round((video.videoWidth || 640) * scale);
    canvas.height = Math.round((video.videoHeight || 480) * scale);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new UploadError('Your browser could not process the video.');
    const out: Array<{ timeSec: number; dataUrl: string }> = [];
    for (let i = 0; i < n; i++) {
      const t = ((i + 0.5) / n) * duration;
      await new Promise<void>((resolve, reject) => {
        video.onseeked = () => resolve();
        video.onerror = () => reject(new UploadError('Seeking in the video failed.'));
        video.currentTime = t;
      });
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      out.push({ timeSec: t, dataUrl: canvas.toDataURL('image/jpeg', 0.75) });
      onProgress?.(i + 1, n);
    }
    return out;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function analyzeFrames(frames: Array<{ timeSec: number; dataUrl: string }>, onProgress?: (done: number, total: number) => void): Promise<ScanFrame[]> {
  const results: ScanFrame[] = [];
  let done = 0;
  const queue = [...frames.entries()];
  const worker = async () => {
    for (let next = queue.shift(); next; next = queue.shift()) {
      const [idx, f] = next;
      try {
        results[idx] = { ...f, analysis: await aiProvider.analyzeImage({ url: f.dataUrl }) };
      } catch (e) {
        results[idx] = { ...f, analysis: null, error: e instanceof Error ? e.message : 'Analysis failed' };
      }
      onProgress?.(++done, frames.length);
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  return results;
}

/** Demo pipeline: bundled illustrated frames with fixed hints, so the feature works without a video or a model. */
export function demoScanFrames(): Array<{ timeSec: number; dataUrl: string; hint: 'pothole' | 'road_crack' | 'waterlogging' | 'other' }> {
  const set: Array<['pothole' | 'crack' | 'water' | 'generic', number, 'pothole' | 'road_crack' | 'waterlogging' | 'other']> = [
    ['generic', 41, 'other'], ['pothole', 42, 'pothole'], ['crack', 43, 'road_crack'], ['pothole', 44, 'pothole'], ['water', 45, 'waterlogging'], ['crack', 46, 'road_crack'],
  ];
  return set.map(([scene, seed, hint], i) => ({ timeSec: i * 4 + 2, dataUrl: demoPhotoUrl(scene, seed), hint }));
}
