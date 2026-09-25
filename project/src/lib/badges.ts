import type { Activity } from './data/service';

export interface Badge {
  key: string;
  name: string;
  description: string;
  earned: boolean;
  progress: string;
}

/** Badges only count verified or corroborated activity, so spam reporting earns nothing. */
export function computeBadges(a: Activity): Badge[] {
  return [
    { key: 'reporter', name: 'Reporter', description: 'Had a report verified or corroborated by neighbours', earned: a.reportsVerified >= 1, progress: `${Math.min(a.reportsVerified, 1)}/1 verified report` },
    { key: 'verifier', name: 'Community Verifier', description: 'Confirmed five issues that other citizens reported', earned: a.confirmationsGiven >= 5, progress: `${Math.min(a.confirmationsGiven, 5)}/5 confirmations` },
    { key: 'watcher', name: 'Road Watcher', description: 'Verified three repairs after they were marked resolved', earned: a.repairsVerified >= 3, progress: `${Math.min(a.repairsVerified, 3)}/3 repairs verified` },
  ];
}
