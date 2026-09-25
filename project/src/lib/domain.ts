// Core domain model for RoadFix AI. Both the demo and the Supabase data
// services speak these types, so UI code never cares which one is active.

export const CATEGORIES = [
  'pothole',
  'road_crack',
  'waterlogging',
  'streetlight',
  'fallen_tree',
  'debris',
  'damaged_sign',
  'open_manhole',
  'obstruction',
  'other',
] as const;
export type Category = (typeof CATEGORIES)[number];

export type Severity = 'low' | 'medium' | 'high';

export const LIFECYCLE = [
  'reported',
  'ai_analyzed',
  'verified',
  'assigned',
  'acknowledged',
  'work_started',
  'resolved',
  'citizen_verified',
] as const;
export type LifecycleStatus = (typeof LIFECYCLE)[number];
/** `reopened` is a side state: a citizen said the problem still exists after a "resolved" mark. */
export type Status = LifecycleStatus | 'reopened';

export type Role = 'citizen' | 'authority' | 'admin';
export type AppMode = 'demo' | 'live';

export interface CategoryMeta {
  label: string;
  color: string;
  department: string;
  icon: string;
}

export const CATEGORY_META: Record<Category, CategoryMeta> = {
  pothole: { label: 'Pothole', color: '#C8392F', department: 'Roads & Infrastructure', icon: 'CircleDashed' },
  road_crack: { label: 'Road crack', color: '#D97A00', department: 'Roads & Infrastructure', icon: 'Construction' },
  waterlogging: { label: 'Waterlogging', color: '#2563A8', department: 'Drainage & Storm Water', icon: 'Droplets' },
  streetlight: { label: 'Broken streetlight', color: '#B98600', department: 'Street Lighting', icon: 'Lightbulb' },
  fallen_tree: { label: 'Fallen tree', color: '#23784A', department: 'Parks & Tree Cell', icon: 'TreeDeciduous' },
  debris: { label: 'Road debris', color: '#5B6771', department: 'Solid Waste Management', icon: 'Trash2' },
  damaged_sign: { label: 'Damaged traffic sign', color: '#7A4FB5', department: 'Traffic Engineering', icon: 'Signpost' },
  open_manhole: { label: 'Open manhole', color: '#9C1F1F', department: 'Water & Sewerage', icon: 'CircleOff' },
  obstruction: { label: 'Road obstruction', color: '#3F6D8C', department: 'Traffic Engineering', icon: 'OctagonAlert' },
  other: { label: 'Other', color: '#5B6771', department: 'Roads & Infrastructure', icon: 'AlertTriangle' },
};

export const DEPARTMENTS = Array.from(new Set(Object.values(CATEGORY_META).map((c) => c.department)));

export const SEVERITY_LABEL: Record<Severity, string> = { low: 'Low', medium: 'Medium', high: 'High' };

export const STATUS_LABEL: Record<Status, string> = {
  reported: 'Reported',
  ai_analyzed: 'AI analyzed',
  verified: 'Verified',
  assigned: 'Assigned',
  acknowledged: 'Acknowledged',
  work_started: 'Work started',
  resolved: 'Resolved',
  citizen_verified: 'Citizen verified',
  reopened: 'Reopened',
};

export const STATUS_TONE: Record<Status, 'gray' | 'blue' | 'amber' | 'green' | 'red'> = {
  reported: 'gray',
  ai_analyzed: 'gray',
  verified: 'blue',
  assigned: 'blue',
  acknowledged: 'blue',
  work_started: 'amber',
  resolved: 'green',
  citizen_verified: 'green',
  reopened: 'red',
};

/** Statuses an authority may move an issue to, keyed by current status. */
export const AUTHORITY_TRANSITIONS: Record<Status, Status[]> = {
  reported: ['verified'],
  ai_analyzed: ['verified'],
  verified: ['assigned'],
  assigned: ['acknowledged', 'work_started'],
  acknowledged: ['work_started'],
  work_started: ['resolved'],
  resolved: [],
  citizen_verified: [],
  reopened: ['assigned', 'work_started'],
};

export function isClosed(status: Status): boolean {
  return status === 'resolved' || status === 'citizen_verified';
}

export function isVerifiedStatus(status: Status): boolean {
  return LIFECYCLE.indexOf(status as LifecycleStatus) >= LIFECYCLE.indexOf('verified') || status === 'reopened';
}

export type PhotoRef =
  | { kind: 'demo'; scene: 'pothole' | 'repaired' | 'water' | 'crack' | 'generic'; seed: number }
  | { kind: 'upload'; url: string };

export interface AIAnalysis {
  mode: AppMode;
  provider: string;
  category: Category;
  confidence: number; // 0..1
  severity: Severity;
  description: string;
  evidence: string[];
  analyzedAt: string;
}

export interface ResolutionComparison {
  mode: AppMode;
  provider: string;
  verdict: 'improved' | 'unclear' | 'not_improved';
  confidence: number;
  beforeSummary: string;
  afterSummary: string;
  note: string;
}

export interface Facility {
  kind: 'school' | 'hospital' | 'bus_stop' | 'railway_station' | 'junction' | 'public_facility';
  name: string;
  distanceM: number;
  source: 'demo' | 'openstreetmap';
}

export interface IssueNote {
  id: string;
  at: string;
  by: string;
  text: string;
  kind: 'note' | 'evidence_request';
}

export interface Resolution {
  afterPhoto: PhotoRef | null;
  comparison: ResolutionComparison | null;
  fixedVotes: number;
  stillExistsVotes: number;
}

export interface ExternalRef {
  id: string;
  authorityId: string;
  authorityName: string;
  channel: string;
  reference: string;
  at: string;
  by: string;
}

export interface Issue {
  id: string;
  category: Category;
  severity: Severity;
  status: Status;
  title: string;
  description: string;
  grievance: string | null;
  latitude: number;
  longitude: number;
  address: string;
  roadName: string;
  area: string;
  reporterId: string | null;
  createdAt: string;
  updatedAt: string;
  lastVerifiedAt: string | null;
  supporters: number; // citizens who reported or confirmed this location
  photo: PhotoRef | null;
  imageHash: string | null;
  analysis: AIAnalysis | null;
  department: string | null;
  assignedAt: string | null;
  workStartedAt: string | null;
  resolvedAt: string | null;
  citizenVerifiedAt: string | null;
  notes: IssueNote[];
  needsEvidence: boolean;
  resolution: Resolution | null;
  /** null = no reliable facility data was available when the report was created */
  facilities: Facility[] | null;
  /** Reference numbers from complaints the citizen filed with an external government channel. */
  externalRefs: ExternalRef[];
  isDemo: boolean;
}

export interface StatusEvent {
  id: string;
  issueId: string;
  from: Status | null;
  to: Status;
  at: string;
  by: string;
  note: string | null;
}

export type ConfirmationKind = 'confirm' | 'still_exists' | 'fixed' | 'add_evidence';

export interface Confirmation {
  id: string;
  issueId: string;
  userId: string;
  kind: ConfirmationKind;
  at: string;
  photo: PhotoRef | null;
}

export type NotificationType =
  | 'report_submitted'
  | 'report_analyzed'
  | 'duplicate_found'
  | 'verified'
  | 'assigned'
  | 'work_started'
  | 'resolved'
  | 'verification_requested'
  | 'new_high_priority'
  | 'multiple_reports'
  | 'sla_threshold'
  | 'still_unresolved'
  | 'evidence_requested';

export interface AppNotification {
  id: string;
  audience: Role;
  userId: string | null;
  issueId: string | null;
  type: NotificationType;
  title: string;
  body: string;
  at: string;
  read: boolean;
}

export interface AppUser {
  id: string;
  name: string;
  email: string | null;
  role: Role;
  department: string | null;
}

export interface NewIssueInput {
  category: Category;
  severity: Severity;
  title: string;
  description: string;
  grievance: string | null;
  latitude: number;
  longitude: number;
  address: string;
  roadName: string;
  area: string;
  photo: PhotoRef | null;
  photoBlob?: Blob | null;
  imageHash: string | null;
  analysis: AIAnalysis | null;
  facilities: Facility[] | null;
}
