import type { AIAnalysis, AppMode, Category, ResolutionComparison } from '../domain';

export interface ImageInput {
  /** Either a real upload or a data/blob URL. */
  blob?: Blob;
  url?: string;
  fileName?: string;
  /** Set only for the bundled demo sample photos. */
  sampleHint?: Category;
}

export interface AIProvider {
  id: string;
  label: string;
  mode: AppMode;
  analyzeImage(input: ImageInput): Promise<AIAnalysis>;
  compareResolution(before: ImageInput, after: ImageInput): Promise<ResolutionComparison>;
}

export class AIUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AIUnavailableError';
  }
}
