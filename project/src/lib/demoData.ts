import type {
  AIAnalysis, AppNotification, AppUser, Category, Confirmation, Issue, IssueNote, LifecycleStatus, PhotoRef, Severity, Status, StatusEvent,
} from './domain';
import { CATEGORY_META } from './domain';
import { buildGrievance } from './grievance';
import { DEMO_ROADS, demoFacilitiesNear, pointOnRoad } from './demoGeo';
import { computeImageHash } from './duplicates';
import { demoPhotoUrl } from './photos';

export const DEMO_USERS: Record<'citizen' | 'authority' | 'admin', AppUser> = {
  citizen: { id: 'demo-citizen', name: 'Demo Citizen', email: 'citizen@demo.roadfix', role: 'citizen', department: null },
  authority: { id: 'demo-authority', name: 'Officer (Demo)', email: 'officer@demo.roadfix', role: 'authority', department: 'Roads & Infrastructure' },
  admin: { id: 'demo-admin', name: 'Admin (Demo)', email: 'admin@demo.roadfix', role: 'admin', department: null },
};

/** The sample photo used by the "Use sample photo" button and by demo issue RF-1024. */
export const SAMPLE_POTHOLE = { kind: 'demo' as const, scene: 'pothole' as const, seed: 7 };
export const SAMPLE_LOCATION = { latitude: 12.9752, longitude: 77.5905 };

const DAY = 86400000;
const HOUR = 3600000;

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CATEGORY_WEIGHTS: Array<[Category, number]> = [
  ['pothole', 30], ['road_crack', 15], ['waterlogging', 12], ['streetlight', 10], ['debris', 7],
  ['damaged_sign', 7], ['fallen_tree', 5], ['open_manhole', 5], ['obstruction', 4], ['other', 5],
];

const TEXT: Record<Category, string[]> = {
  pothole: ['Deep pothole in the left lane. Two-wheelers are swerving to avoid it.', 'Pothole about 30 cm wide near the bus stop, filled with water after rain.', 'Large pothole on the carriageway edge, getting bigger every week.'],
  road_crack: ['Long crack running along the lane, edges starting to break.', 'Surface cracking near the junction, gravel is coming loose.'],
  waterlogging: ['Water collects here after even light rain and stays for hours.', 'Drain is blocked, so the whole lane floods.'],
  streetlight: ['Streetlight has been off for several nights, stretch is very dark.', 'Two consecutive streetlights not working.'],
  fallen_tree: ['Large branch has fallen across half the road.', 'Tree leaning onto the carriageway after the storm.'],
  debris: ['Construction rubble left on the road shoulder.', 'Loose gravel and broken concrete on the lane.'],
  damaged_sign: ['Speed limit sign bent and facing the wrong way.', 'Stop sign knocked over, not visible to drivers.'],
  open_manhole: ['Manhole cover missing, open hole in the lane.', 'Manhole cover broken and sunk below road level.'],
  obstruction: ['Parked construction equipment blocking one lane for days.', 'Barricade left in the middle of the road.'],
  other: ['Uneven road patch after utility digging.', 'Road edge collapsed near the footpath.'],
};

const SCENE: Record<Category, 'pothole' | 'water' | 'crack' | 'generic'> = {
  pothole: 'pothole', waterlogging: 'water', road_crack: 'crack',
  streetlight: 'generic', fallen_tree: 'generic', debris: 'generic', damaged_sign: 'generic', open_manhole: 'generic', obstruction: 'generic', other: 'generic',
};

const NOTES = ['Site inspection scheduled with the ward engineer.', 'Material requested from the depot.', 'Crew allotted, work planned for the next dry day.', 'Duplicate reports merged into this record for tracking.'];

export interface SeedData {
  issues: Issue[];
  history: StatusEvent[];
  confirmations: Confirmation[];
  notifications: AppNotification[];
}

function pickWeighted<T>(items: Array<[T, number]>, u: number): T {
  const total = items.reduce((s, [, w]) => s + w, 0);
  let acc = 0;
  for (const [item, w] of items) {
    acc += w;
    if (u * total <= acc) return item;
  }
  return items[items.length - 1][0];
}

export async function buildSeed(now = new Date()): Promise<SeedData> {
  const r = rng(20260920);
  const issues: Issue[] = [];
  const history: StatusEvent[] = [];
  const notifications: AppNotification[] = [];
  const iso = (ms: number) => new Date(ms).toISOString();
  const roadWeights: Array<[number, number]> = DEMO_ROADS.map((_, i) => [i, [3, 1.5, 2, 1, 3, 1, 2, 1, 1.5, 1, 1.5, 1][i]]);
  const sampleHash = await computeImageHash(demoPhotoUrl(SAMPLE_POTHOLE.scene, SAMPLE_POTHOLE.seed));

  for (let i = 1; i <= 64; i++) {
    const n = 1000 + i;
    const id = `RF-${n}`;
    let category = pickWeighted(CATEGORY_WEIGHTS, r());
    const road = DEMO_ROADS[pickWeighted(roadWeights, r())];
    let [lat, lng] = pointOnRoad(road, r(), (r() - 0.5) * 0.0004, (r() - 0.5) * 0.0004);
    let roadName = road.name;
    let area = road.area;
    let ageDays = Math.floor(Math.pow(r(), 0.8) * 58) + (r() < 0.5 ? 0 : 1);
    const sevU = r();
    let severity: Severity =
      category === 'open_manhole' || category === 'fallen_tree' ? 'high'
        : category === 'road_crack' || category === 'damaged_sign' || category === 'streetlight' ? (sevU < 0.15 ? 'high' : sevU < 0.6 ? 'medium' : 'low')
          : sevU < 0.35 ? 'high' : sevU < 0.75 ? 'medium' : 'low';
    let supporters = Math.max(1, Math.min(30, 1 + Math.floor(-Math.log(1 - r() * 0.98) * 4 * (severity === 'high' ? 1.6 : 1))));
    let target: Status = pickWeighted<Status>(
      [['reported', 6], ['ai_analyzed', 7], ['verified', 14], ['assigned', 12], ['acknowledged', 6], ['work_started', 9], ['resolved', 16], ['citizen_verified', 20], ['reopened', 2]],
      r()
    );
    let reporterId: string | null = `demo-reporter-${1 + Math.floor(r() * 40)}`;
    let description = TEXT[category][Math.floor(r() * TEXT[category].length)];
    let photo: PhotoRef = { kind: 'demo', scene: SCENE[category], seed: i };
    let imageHash: string | null = null;

    if (n === 1024) {
      category = 'pothole'; severity = 'high'; supporters = 23; ageDays = 6; target = 'verified';
      lat = SAMPLE_LOCATION.latitude; lng = SAMPLE_LOCATION.longitude;
      roadName = 'Demo Ring Road (Central)'; area = 'Central Market';
      description = 'Large pothole in the left lane, about 40 cm across. Vehicles are swerving into the middle of the road.';
      photo = SAMPLE_POTHOLE; imageHash = sampleHash; reporterId = 'demo-reporter-3';
    } else if (n === 1010) {
      category = 'waterlogging'; severity = 'medium'; supporters = 8; ageDays = 20; target = 'resolved'; reporterId = DEMO_USERS.citizen.id;
      description = 'Water collects at the low point of the lane after every rain and stays for hours.'; photo = { kind: 'demo', scene: 'water', seed: 10 };
    } else if (n === 1017) {
      category = 'streetlight'; severity = 'medium'; supporters = 4; ageDays = 9; target = 'assigned'; reporterId = DEMO_USERS.citizen.id;
      description = 'Streetlight has been off for a week; the stretch is very dark at night.'; photo = { kind: 'demo', scene: 'generic', seed: 17 };
    } else if (n === 1031) {
      category = 'road_crack'; severity = 'low'; supporters = 1; ageDays = 0; target = 'ai_analyzed'; reporterId = DEMO_USERS.citizen.id;
      description = 'Hairline crack forming along the lane edge.'; photo = { kind: 'demo', scene: 'crack', seed: 31 };
    }

    const created = now.getTime() - (ageDays * DAY + (n === 1031 ? 2 * HOUR : Math.floor(r() * 20) * HOUR));
    const ORDER: LifecycleStatus[] = ['reported', 'ai_analyzed', 'verified', 'assigned', 'acknowledged', 'work_started', 'resolved', 'citizen_verified'];
    const steps: Array<{ s: Status; at: number }> = [{ s: 'reported', at: created }];
    let t = created;
    const gaps = [0.05, 0.4, 0.8, 1, 2.5, 3];
    const targetIdx = target === 'reopened' ? ORDER.indexOf('resolved') : ORDER.indexOf(target as LifecycleStatus);
    for (let k = 1; k <= targetIdx; k++) {
      t += gaps[Math.min(k - 1, gaps.length - 1)] * DAY * (0.6 + r() * 0.8);
      if (n === 1024 && ORDER[k] === 'verified') t = created + 0.6 * DAY;
      if (t > now.getTime() - 30 * 60000) break;
      if (n === 1010 && ORDER[k] === 'resolved') t = now.getTime() - 26 * HOUR;
      steps.push({ s: ORDER[k], at: t });
    }
    let status: Status = steps[steps.length - 1].s;
    if (target === 'reopened' && status === 'resolved') {
      status = 'reopened';
      steps.push({ s: 'reopened', at: Math.min(now.getTime() - HOUR, t + DAY) });
    }
    const at = (s: Status) => steps.find((x) => x.s === s)?.at ?? null;
    const dept = CATEGORY_META[category].department;
    const assigned = at('assigned');
    const facilities = demoFacilitiesNear(lat, lng);
    const address = `${roadName}, ${area}`;
    const analysis: AIAnalysis = {
      mode: 'demo', provider: 'Seeded demo record', category, severity,
      confidence: Math.round((0.72 + r() * 0.23) * 100) / 100,
      description: `Possible ${CATEGORY_META[category].label.toLowerCase()} (demo record).`,
      evidence: ['Demo data record: no real image analysis was run'], analyzedAt: iso(created + 60000),
    };
    const notes: IssueNote[] = assigned && r() < 0.6 ? [{ id: `${id}-n1`, at: iso(assigned + HOUR), by: DEMO_USERS.authority.name, text: NOTES[Math.floor(r() * NOTES.length)], kind: 'note' }] : [];
    const isClosedNow = status === 'resolved' || status === 'citizen_verified';
    const resolvedAt = at('resolved');
    const grievance = buildGrievance({ category, severity, address, latitude: lat, longitude: lng, description, at: new Date(created), facilities, supporters, hasPhoto: true, aiAssisted: false }).body;

    issues.push({
      id, category, severity, status,
      title: `${CATEGORY_META[category].label} near ${roadName}`,
      description, grievance, latitude: lat, longitude: lng, address, roadName, area,
      reporterId, createdAt: iso(created), updatedAt: iso(steps[steps.length - 1].at),
      lastVerifiedAt: at('verified') ? iso(at('verified') as number) : null,
      supporters, photo, imageHash, analysis,
      department: assigned ? dept : null,
      assignedAt: assigned ? iso(assigned) : null,
      workStartedAt: at('work_started') ? iso(at('work_started') as number) : null,
      resolvedAt: resolvedAt ? iso(resolvedAt) : null,
      citizenVerifiedAt: at('citizen_verified') ? iso(at('citizen_verified') as number) : null,
      notes, needsEvidence: false,
      resolution: isClosedNow || status === 'reopened'
        ? {
            afterPhoto: n === 1010 ? null : { kind: 'demo', scene: 'repaired', seed: i },
            comparison: null,
            fixedVotes: status === 'citizen_verified' ? 2 : 0,
            stillExistsVotes: status === 'reopened' ? 1 : 0,
          }
        : null,
      facilities, externalRefs: [], isDemo: true,
    });
    steps.forEach((s, k) => {
      history.push({ id: `${id}-h${k}`, issueId: id, from: k ? steps[k - 1].s : null, to: s.s, at: iso(s.at), by: k === 0 ? 'Citizen' : s.s === 'ai_analyzed' ? 'RoadFix analyzer' : s.s === 'citizen_verified' ? 'Citizen' : DEMO_USERS.authority.name, note: null });
    });
  }

  const byId = (id: string) => issues.find((i) => i.id === id) as Issue;
  const nid = (k: string) => `seed-n-${k}`;
  const mk = (k: string, audience: AppNotification['audience'], userId: string | null, issueId: string | null, type: AppNotification['type'], title: string, body: string, agoH: number, read = false): AppNotification =>
    ({ id: nid(k), audience, userId, issueId, type, title, body, at: iso(now.getTime() - agoH * HOUR), read });

  notifications.push(
    mk('c1', 'citizen', DEMO_USERS.citizen.id, 'RF-1010', 'verification_requested', 'Please verify the repair', 'RF-1010 was marked resolved. Has it actually been fixed? An after-repair photo helps.', 26),
    mk('c2', 'citizen', DEMO_USERS.citizen.id, 'RF-1017', 'assigned', 'Your report was assigned', `RF-1017 was assigned to ${CATEGORY_META.streetlight.department}.`, 150, true),
    mk('c3', 'citizen', DEMO_USERS.citizen.id, 'RF-1031', 'report_analyzed', 'Report analyzed', 'RF-1031 was checked. Review the AI-assisted result in the report.', 2, true),
    mk('a1', 'authority', null, 'RF-1024', 'new_high_priority', 'New high-priority issue', 'RF-1024 pothole near a school scored High priority.', 22),
    mk('a2', 'authority', null, 'RF-1024', 'multiple_reports', 'Multiple reports for one location', 'RF-1024 now has 23 supporting reports.', 20),
  );
  const oldOpen = issues.filter((i) => i.status !== 'resolved' && i.status !== 'citizen_verified' && (now.getTime() - new Date(i.createdAt).getTime()) / DAY > 25).slice(0, 2);
  oldOpen.forEach((i, k) => notifications.push(mk(`a-sla-${k}`, 'authority', null, i.id, 'sla_threshold', 'Issue approaching SLA threshold', `${i.id} has been open for more than 25 days.`, 30 + k * 5)));

  const confirmations: Confirmation[] = [5, 12].map((k) => ({ id: `seed-c-${k}`, issueId: byId(`RF-${1000 + k}`).id, userId: DEMO_USERS.citizen.id, kind: 'confirm' as const, at: iso(now.getTime() - (k + 3) * DAY), photo: null }));
  return { issues, history, confirmations, notifications };
}
