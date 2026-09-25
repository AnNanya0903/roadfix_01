import { createContext, useContext } from 'react';
import type { AppMode, AppNotification, AppUser } from './domain';
import type { EnrichedIssue } from './enrich';

export interface AppState {
  mode: AppMode;
  modeNote: string | null;
  user: AppUser | null;
  authReady: boolean;
  issues: EnrichedIssue[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
  notifications: AppNotification[];
  unread: number;
  refreshNotifications: () => Promise<void>;
  markAllRead: () => Promise<void>;
  signOut: () => Promise<void>;
  switchPersona: (role: 'citizen' | 'authority' | 'admin') => void;
  resetDemo: () => Promise<void>;
}

export const AppContext = createContext<AppState | null>(null);

export function useApp(): AppState {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
