import { isClosed } from './domain';
import type { EnrichedIssue } from './enrich';
import type { WeatherSnapshot } from './weather';

export type RiskLevel = 'high' | 'medium' | 'low';

export interface AreaRisk {
  area: string;
  level: RiskLevel;
  score: number;
  reasons: string[];
}

export interface RainConcern {
  area: string;
  level: RiskLevel;
  reason: string;
}

/**
 * EXPERIMENTAL. A transparent heuristic over historical incidents, not a trained model, and
 * not a promise that any road will fail. It ranks areas by how much unresolved and recurring
 * damage they already have, and nudges waterlogging history when heavy rain is forecast.
 */
export function forecastAreaRisk(issues: EnrichedIssue[], weather: WeatherSnapshot | null): AreaRisk[] {
  const areas = Array.from(new Set(issues.map((i) => i.area)));
  const rainBoost = weather && weather.rainNext24hMm >= 30 ? 1.5 : weather && weather.rainNext24hMm >= 10 ? 1.2 : 1;
  return areas
    .map((area) => {
      const list = issues.filter((i) => i.area === area);
      const open = list.filter((i) => !isClosed(i.status));
      const openHigh = open.filter((i) => i.severity === 'high').length;
      const openMed = open.filter((i) => i.severity === 'medium').length;
      const water = list.filter((i) => i.category === 'waterlogging').length;
      const repeats = list.filter((i) => i.priority.factors.some((f) => f.key === 'recurrence')).length;
      const slow = open.filter((i) => i.ageDays > 14).length;
      const score = Math.round(openHigh * 9 + openMed * 4 + repeats * 5 + slow * 3 + water * 3 * rainBoost);
      const reasons: string[] = [];
      if (openHigh) reasons.push(`${openHigh} open high-severity issue${openHigh > 1 ? 's' : ''}`);
      if (repeats) reasons.push(`${repeats} repeat location${repeats > 1 ? 's' : ''}`);
      if (slow) reasons.push(`${slow} unresolved for over 14 days`);
      if (water) reasons.push(`${water} waterlogging report${water > 1 ? 's' : ''} on record${rainBoost > 1 ? ' with rain forecast' : ''}`);
      return { area, score, level: (score >= 45 ? 'high' : score >= 22 ? 'medium' : 'low') as RiskLevel, reasons: reasons.length ? reasons : ['Few open issues on record'] };
    })
    .sort((a, b) => b.score - a.score);
}

export function rainConcerns(issues: EnrichedIssue[], weather: WeatherSnapshot | null): RainConcern[] {
  if (!weather) return [];
  const areas = Array.from(new Set(issues.map((i) => i.area)));
  return areas
    .map((area) => {
      const water = issues.filter((i) => i.area === area && i.category === 'waterlogging');
      const openWater = water.filter((i) => !isClosed(i.status)).length;
      const heavy = weather.rainNext24hMm >= 30;
      const level: RiskLevel = heavy && (openWater >= 2 || water.length >= 4) ? 'high' : weather.rainNext24hMm >= 10 && water.length >= 2 ? 'medium' : 'low';
      const reason = water.length ? `${water.length} past waterlogging report${water.length > 1 ? 's' : ''}, ${openWater} still open` : 'No waterlogging reports on record';
      return { area, level, reason };
    })
    .sort((a, b) => ({ high: 0, medium: 1, low: 2 })[a.level] - ({ high: 0, medium: 1, low: 2 })[b.level]);
}
