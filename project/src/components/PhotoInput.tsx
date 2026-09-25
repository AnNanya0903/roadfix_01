import { Camera, ImagePlus, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { UploadError, validateImageFile } from '@/lib/photos';

interface Props {
  label: string;
  file: File | null;
  previewUrl: string | null;
  onFile: (file: File) => void;
  onClear: () => void;
  hint?: string;
  id: string;
}

export default function PhotoInput({ label, file, previewUrl, onFile, onClear, hint, id }: Props) {
  const [error, setError] = useState<string | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const galleryRef = useRef<HTMLInputElement>(null);

  const handle = (f?: File | null) => {
    if (!f) return;
    try {
      validateImageFile(f);
      setError(null);
      onFile(f);
    } catch (e) {
      setError(e instanceof UploadError ? e.message : 'That file could not be used.');
    }
  };

  return (
    <div>
      <p className="label" id={`${id}-label`}>{label}</p>
      {previewUrl ? (
        <div className="relative overflow-hidden rounded-lg border border-concrete-300">
          <img src={previewUrl} alt="Selected evidence" className="max-h-72 w-full object-cover" />
          <button type="button" onClick={onClear} className="absolute right-2 top-2 rounded-full bg-asphalt/80 p-1.5 text-white hover:bg-asphalt" aria-label="Remove photo">
            <X className="h-4 w-4" aria-hidden />
          </button>
          {file && <p className="bg-white px-3 py-1.5 text-xs text-signal-gray">{file.name} · {(file.size / 1024).toFixed(0)} KB</p>}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2" role="group" aria-labelledby={`${id}-label`}>
          <button type="button" onClick={() => cameraRef.current?.click()} className="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-concrete-300 bg-white px-4 py-8 text-sm font-semibold hover:border-asphalt">
            <Camera className="h-7 w-7" aria-hidden /> Take a photo
          </button>
          <button type="button" onClick={() => galleryRef.current?.click()} className="flex flex-col items-center gap-2 rounded-lg border-2 border-dashed border-concrete-300 bg-white px-4 py-8 text-sm font-semibold hover:border-asphalt">
            <ImagePlus className="h-7 w-7" aria-hidden /> Upload from device
          </button>
        </div>
      )}
      <input ref={cameraRef} data-testid={`${id}-camera`} type="file" accept="image/*" capture="environment" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => { handle(e.target.files?.[0]); e.target.value = ''; }} />
      <input ref={galleryRef} data-testid={`${id}-file`} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1} aria-hidden onChange={(e) => { handle(e.target.files?.[0]); e.target.value = ''; }} />
      {hint && !error && <p className="hint mt-1.5">{hint}</p>}
      {error && <p className="mt-1.5 text-sm font-semibold text-signal-red" role="alert">{error}</p>}
    </div>
  );
}
