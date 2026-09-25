import { MODE } from '../mode';
import { demoProvider } from './demoProvider';
import { edgeProvider } from './edgeProvider';
import type { AIProvider } from './types';

export const aiProvider: AIProvider = MODE === 'live' ? edgeProvider : demoProvider;
export { AIUnavailableError } from './types';
export type { AIProvider, ImageInput } from './types';
