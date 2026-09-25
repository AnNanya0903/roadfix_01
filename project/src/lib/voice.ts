export const VOICE_LANGUAGES = [
  { code: 'en', label: 'English' }, { code: 'hi', label: 'हिन्दी' }, { code: 'kn', label: 'ಕನ್ನಡ' }, { code: 'ta', label: 'தமிழ்' },
  { code: 'te', label: 'తెలుగు' }, { code: 'ml', label: 'മലയാളം' }, { code: 'mr', label: 'मराठी' }, { code: 'bn', label: 'বাংলা' },
  { code: 'gu', label: 'ગુજરાતી' }, { code: 'pa', label: 'ਪੰਜਾਬੀ' },
] as const;

interface RecognitionEvent {
  resultIndex: number;
  results: ArrayLike<{ 0?: { transcript: string }; isFinal: boolean }>;
}
interface Recognition {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  onresult: ((e: RecognitionEvent) => void) | null;
  onerror: ((e: { error?: string }) => void) | null;
  onend: (() => void) | null;
}

export function voiceSupported(): boolean {
  const w = window as unknown as Record<string, unknown>;
  return Boolean(w.SpeechRecognition || w.webkitSpeechRecognition);
}

/** Browser speech-to-text (kept from the original RoadFix). Returns a stop function, or null if unsupported. */
export function startVoiceDictation(lang: string, onText: (t: string) => void, onError: (m: string) => void, onEnd: () => void): (() => void) | null {
  const w = window as unknown as Record<string, new () => Recognition>;
  const Ctor = w.SpeechRecognition || w.webkitSpeechRecognition;
  if (!Ctor) {
    onError('Voice dictation is not supported in this browser. Type the description instead.');
    return null;
  }
  const rec = new Ctor();
  rec.continuous = false;
  rec.interimResults = true;
  rec.lang = lang === 'en' ? 'en-IN' : `${lang}-IN`;
  let final = '';
  rec.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const t = e.results[i]?.[0]?.transcript;
      if (!t) continue;
      if (e.results[i].isFinal) final += `${t} `;
      else interim += t;
    }
    onText(`${final}${interim}`.trim());
  };
  rec.onerror = (e) => onError(e.error === 'not-allowed' ? 'Microphone permission was denied.' : 'Voice dictation failed. Type the description instead.');
  rec.onend = onEnd;
  rec.start();
  return () => {
    try {
      rec.stop();
    } catch {
      /* already stopped */
    }
  };
}
