import type { PhotoRef } from './domain';

export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
export const MAX_VIDEO_BYTES = 60 * 1024 * 1024;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const cache = new Map<string, string>();

/** Procedurally drawn stand-in photos used only by demo data and the "sample photo" buttons. */
export function demoPhotoUrl(scene: 'pothole' | 'repaired' | 'water' | 'crack' | 'generic', seed: number): string {
  const key = `${scene}:${seed}`;
  const hit = cache.get(key);
  if (hit) return hit;
  const r = mulberry32(seed * 9973 + scene.length * 131);
  const W = 640;
  const H = 480;
  let body = '';
  const base = scene === 'repaired' ? '#4a4f55' : '#3d4147';
  body += `<rect width="${W}" height="${H}" fill="${base}"/>`;
  body += `<rect width="${W}" height="${H}" filter="url(#grain)" opacity="0.55"/>`;
  // lane marking
  body += `<path d="M0 ${330 + r() * 20} L${W} ${300 + r() * 20}" stroke="#d8d2b8" stroke-width="9" stroke-dasharray="70 46" opacity="0.8"/>`;
  const cx = 250 + r() * 140;
  const cy = 210 + r() * 90;
  if (scene === 'pothole') {
    const rx = 92 + r() * 30;
    const ry = 54 + r() * 20;
    const pts: string[] = [];
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const k = 0.82 + r() * 0.3;
      pts.push(`${(cx + Math.cos(a) * rx * k).toFixed(1)},${(cy + Math.sin(a) * ry * k).toFixed(1)}`);
    }
    body += `<polygon points="${pts.join(' ')}" fill="#8a8d90" opacity="0.55" transform="translate(-5 -4) scale(1.06)" transform-origin="${cx} ${cy}"/>`;
    body += `<polygon points="${pts.join(' ')}" fill="#0c0d0f"/>`;
    body += `<ellipse cx="${cx + 10}" cy="${cy + 8}" rx="${rx * 0.55}" ry="${ry * 0.5}" fill="#050506"/>`;
    for (let i = 0; i < 26; i++) {
      body += `<circle cx="${(cx + (r() - 0.5) * rx * 2.6).toFixed(1)}" cy="${(cy + (r() - 0.5) * ry * 2.8).toFixed(1)}" r="${(1 + r() * 3).toFixed(1)}" fill="#6d7074"/>`;
    }
  } else if (scene === 'water') {
    body += `<ellipse cx="${cx}" cy="${cy + 30}" rx="260" ry="110" fill="#5b6a70" opacity="0.92"/>`;
    body += `<ellipse cx="${cx - 40}" cy="${cy + 10}" rx="150" ry="46" fill="#8fa5ad" opacity="0.55"/>`;
    body += `<path d="M${cx - 140} ${cy + 40} q40 -14 80 0 t80 0 t80 0" stroke="#c3d3d8" stroke-width="3" fill="none" opacity="0.7"/>`;
  } else if (scene === 'crack') {
    let x = 60 + r() * 60;
    let y = 90 + r() * 40;
    let d = `M${x} ${y}`;
    for (let i = 0; i < 9; i++) {
      x += 55 + r() * 25;
      y += (r() - 0.35) * 70;
      d += ` L${x.toFixed(1)} ${y.toFixed(1)}`;
    }
    body += `<path d="${d}" stroke="#0a0a0b" stroke-width="7" fill="none" stroke-linejoin="round"/>`;
    body += `<path d="${d}" stroke="#7b7f83" stroke-width="1.5" fill="none" transform="translate(3 3)" opacity="0.6"/>`;
  } else if (scene === 'repaired') {
    body += `<ellipse cx="${cx}" cy="${cy}" rx="120" ry="66" fill="#565b61" opacity="0.7"/>`;
    body += `<ellipse cx="${cx}" cy="${cy}" rx="120" ry="66" fill="none" stroke="#2f3237" stroke-width="2" opacity="0.5"/>`;
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}"><defs><filter id="grain"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="${seed}"/><feColorMatrix values="0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0 0.5  0 0 0 0.5 0"/></filter></defs>${body}</svg>`;
  const url = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  cache.set(key, url);
  return url;
}

export function photoUrl(photo: PhotoRef | null | undefined): string | null {
  if (!photo) return null;
  return photo.kind === 'demo' ? demoPhotoUrl(photo.scene, photo.seed) : photo.url;
}

export class UploadError extends Error {}

export function validateImageFile(file: File): void {
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) throw new UploadError('Use a JPG, PNG or WebP photo.');
  if (file.size > MAX_UPLOAD_BYTES) throw new UploadError('That photo is larger than 10 MB. Choose a smaller one.');
  if (file.size === 0) throw new UploadError('That file is empty.');
}

export function validateVideoFile(file: File): void {
  if (!ALLOWED_VIDEO_TYPES.includes(file.type)) throw new UploadError('Use an MP4, WebM or MOV video.');
  if (file.size > MAX_VIDEO_BYTES) throw new UploadError('That video is larger than 60 MB. Record a shorter clip.');
}

export interface PreparedImage {
  blob: Blob;
  dataUrl: string;
  width: number;
  height: number;
}

/** Downscale to at most `maxDim` px and re-encode as JPEG so uploads stay small and EXIF is stripped. */
export async function prepareImage(source: Blob | string, maxDim = 1024, quality = 0.8): Promise<PreparedImage> {
  const url = typeof source === 'string' ? source : URL.createObjectURL(source);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = () => reject(new UploadError('That file could not be read as an image.'));
      i.src = url;
    });
    const scale = Math.min(1, maxDim / Math.max(img.naturalWidth || 640, img.naturalHeight || 480));
    const w = Math.max(1, Math.round((img.naturalWidth || 640) * scale));
    const h = Math.max(1, Math.round((img.naturalHeight || 480) * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new UploadError('Your browser could not process the image.');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new UploadError('Could not encode the image.'))), 'image/jpeg', quality)
    );
    const dataUrl = canvas.toDataURL('image/jpeg', quality);
    return { blob, dataUrl, width: w, height: h };
  } finally {
    if (typeof source !== 'string') URL.revokeObjectURL(url);
  }
}
