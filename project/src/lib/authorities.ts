import type { Category, Issue } from './domain';
import { CATEGORY_META } from './domain';

/**
 * Directory of the offices a road-safety report can be handed to.
 *
 * IMPORTANT: this is a HANDOFF directory, not an integration. RoadFix does not file anything
 * on a government system. It prepares the complaint and opens the official channel so the
 * citizen submits it. No public API for submitting municipal complaints was found; see README.
 *
 * Every channel records where the detail came from. `official` = a government page or the
 * office's own app listing. `secondary` = a third-party page that lists it; the UI tells the
 * user to confirm it. Numbers and handles change (Bengaluru's civic body was reorganised into
 * the Greater Bengaluru Authority), so review this file before each release.
 */
export type ChannelType = 'web' | 'phone' | 'app' | 'x' | 'whatsapp' | 'email';

export interface Channel {
  type: ChannelType;
  label: string;
  /** URL for web/app, digits for phone/whatsapp (with country code for whatsapp), handle without @ for x, address for email */
  value: string;
  confidence: 'official' | 'secondary';
  source: string;
  categories?: Category[];
}

export interface Authority {
  id: string;
  name: string;
  scope: string;
  role: 'primary' | 'traffic' | 'escalation' | 'fallback';
  /** Rough bounding box [south, west, north, east]. Approximate: real jurisdictions follow ward boundaries. */
  bbox?: [number, number, number, number];
  categories?: Category[];
  channels: Channel[];
  note?: string;
  checkedOn: string;
}

const CHECKED = '2026-09-21';

export const AUTHORITIES: Authority[] = [
  {
    id: 'gba-bbmp',
    name: 'Greater Bengaluru Authority / BBMP',
    scope: 'Roads, potholes, drainage, streetlights, trees and waste within Bengaluru',
    role: 'primary',
    bbox: [12.7, 77.3, 13.25, 77.9],
    channels: [
      { type: 'web', label: 'e-Helpline online complaint', value: 'https://support.bbmpgov.in/ehelpline', confidence: 'secondary', source: 'Listed by vaultproptech.com (2026)' },
      { type: 'phone', label: 'Civic helpline 1533', value: '1533', confidence: 'secondary', source: 'Listed by vaultproptech.com and godigit.com' },
      { type: 'app', label: 'Namma Bengaluru (Sahaaya 2.0) app', value: 'https://play.google.com/store/apps/details?id=com.nammabengaluruNew.org', confidence: 'official', source: 'Google Play listing by BBMP-IT' },
      { type: 'app', label: 'Fix Pothole app (potholes only)', value: 'https://play.google.com/store/apps/details?id=com.indigo.bbmp.fixpothole', confidence: 'official', source: 'Google Play listing', categories: ['pothole', 'road_crack'] },
    ],
    note: 'Since the reorganisation, complaints may be handled by the city corporation for your ward. The channels above accept the complaint and route it.',
    checkedOn: CHECKED,
  },
  {
    id: 'blr-traffic',
    name: 'Bengaluru Traffic Police',
    scope: 'Damaged traffic signs and road obstructions',
    role: 'traffic',
    bbox: [12.7, 77.3, 13.25, 77.9],
    categories: ['damaged_sign', 'obstruction'],
    channels: [
      { type: 'x', label: 'Post to @blrcitytraffic on X', value: 'blrcitytraffic', confidence: 'secondary', source: 'Listed by interns.city' },
    ],
    checkedOn: CHECKED,
  },
  {
    id: 'cpgrams',
    name: 'CPGRAMS (Government of India)',
    scope: 'Central public grievance portal. Use it to escalate if the local office does not respond, or for central departments',
    role: 'escalation',
    channels: [
      { type: 'web', label: 'Lodge or escalate on pgportal.gov.in', value: 'https://pgportal.gov.in/', confidence: 'official', source: 'DARPG / PIB' },
    ],
    note: 'CPGRAMS is mainly for grievances against government services and appeals. For a pothole, file with the local body first.',
    checkedOn: CHECKED,
  },
];

function inBox(lat: number, lng: number, b: [number, number, number, number]) {
  return lat >= b[0] && lat <= b[2] && lng >= b[1] && lng <= b[3];
}

export interface AuthorityMatch {
  authority: Authority;
  channels: Channel[];
}

export interface Routing {
  matches: AuthorityMatch[];
  /** True when no local office is configured for this location. */
  noLocalOffice: boolean;
}

export function resolveAuthorities(issue: Pick<Issue, 'latitude' | 'longitude' | 'category'>): Routing {
  const matches: AuthorityMatch[] = [];
  let local = false;
  for (const a of AUTHORITIES) {
    if (a.role === 'escalation') continue;
    if (!a.bbox || !inBox(issue.latitude, issue.longitude, a.bbox)) continue;
    if (a.categories && !a.categories.includes(issue.category)) continue;
    const channels = a.channels.filter((c) => !c.categories || c.categories.includes(issue.category));
    if (channels.length) {
      matches.push({ authority: a, channels });
      if (a.role === 'primary') local = true;
    }
  }
  for (const a of AUTHORITIES) if (a.role === 'escalation') matches.push({ authority: a, channels: a.channels });
  return { matches, noLocalOffice: !local };
}

export function issueUrl(id: string): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}issues/${id}`;
}

export function shortComplaint(issue: Pick<Issue, 'id' | 'category' | 'roadName' | 'area'>, handle?: string): string {
  const tag = handle ? `@${handle} ` : '';
  return `${tag}${CATEGORY_META[issue.category].label} on ${issue.roadName}, ${issue.area}. Evidence and location: ${issueUrl(issue.id)} #RoadFix`.slice(0, 275);
}

export function channelHref(c: Channel, issue: Pick<Issue, 'id' | 'category' | 'roadName' | 'area' | 'title' | 'grievance'>): string {
  switch (c.type) {
    case 'phone': return `tel:${c.value}`;
    case 'x': return `https://x.com/intent/post?text=${encodeURIComponent(shortComplaint(issue, c.value))}`;
    case 'whatsapp': return `https://wa.me/${c.value}?text=${encodeURIComponent(shortComplaint(issue))}`;
    case 'email': return `mailto:${c.value}?subject=${encodeURIComponent(issue.title)}&body=${encodeURIComponent(issue.grievance ?? shortComplaint(issue))}`;
    default: return c.value;
  }
}

export function localSearchHref(issue: Pick<Issue, 'area' | 'category'>): string {
  return `https://www.google.com/search?q=${encodeURIComponent(`${issue.area} municipal corporation complaint ${CATEGORY_META[issue.category].label}`)}`;
}
