import type {
  AppNotification, AppUser, Confirmation, ConfirmationKind, Issue, IssueNote, NewIssueInput, NotificationType, Status, StatusEvent,
} from '../domain';
import { AUTHORITY_TRANSITIONS, CATEGORY_META, isClosed } from '../domain';
import { buildSeed, DEMO_USERS, type SeedData } from '../demoData';
import { ForbiddenError, RateLimitError, RuleError, type Activity, type ConfirmOptions, type CreateResult, type DataService } from './service';
import { isVerifiedStatus } from '../domain';

const KEY = 'roadfix.demo.v1';
const HOUR = 3600000;

interface Store extends SeedData {
  createdLog: Array<{ user: string; at: number }>;
}

let memory: Store | null = null;
const listeners = new Set<() => void>();
let loading: Promise<Store> | null = null;

function persist(store: Store, warnings: string[] = []): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(store));
  } catch {
    // Storage full (uploaded photos are large). Drop uploaded photo data from the newest issues and retry once.
    let dropped = false;
    for (const issue of [...store.issues].reverse()) {
      if (issue.photo?.kind === 'upload') {
        issue.photo = null;
        dropped = true;
        break;
      }
    }
    try {
      localStorage.setItem(KEY, JSON.stringify(store));
      if (dropped) warnings.push('Browser storage is full, so the photo could not be kept in demo storage. Use "Reset demo data" to free space.');
    } catch {
      throw new RuleError('Browser storage is full. Reset demo data from the footer and try again.');
    }
  }
}

async function load(): Promise<Store> {
  if (memory) return memory;
  if (!loading) {
    loading = (async () => {
      try {
        const raw = localStorage.getItem(KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Store;
          if (parsed && Array.isArray(parsed.issues)) return parsed;
        }
      } catch {
        /* fall through to reseed */
      }
      const seed = await buildSeed();
      const store: Store = { ...seed, createdLog: [] };
      persist(store);
      return store;
    })().then((s) => {
      memory = s;
      return s;
    });
  }
  return loading;
}

function emit() {
  listeners.forEach((cb) => cb());
}

if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) {
      memory = null;
      loading = null;
      emit();
    }
  });
}

const iso = () => new Date().toISOString();
const uid = (p: string) => `${p}-${crypto.randomUUID().slice(0, 8)}`;

function requireAuthority(user: AppUser) {
  if (user.role !== 'authority' && user.role !== 'admin') throw new ForbiddenError('Only authority staff can change an incident.');
}

function followers(store: Store, issue: Issue): string[] {
  const ids = new Set<string>();
  if (issue.reporterId) ids.add(issue.reporterId);
  store.confirmations.filter((c) => c.issueId === issue.id && (c.kind === 'confirm' || c.kind === 'add_evidence' || c.kind === 'still_exists')).forEach((c) => ids.add(c.userId));
  return [...ids].filter((id) => !id.startsWith('demo-reporter-') && id !== 'demo-authority' && id !== 'demo-admin');
}

function notifyCitizens(store: Store, issue: Issue, type: NotificationType, title: string, body: string) {
  for (const id of followers(store, issue)) {
    store.notifications.unshift({ id: uid('n'), audience: 'citizen', userId: id, issueId: issue.id, type, title, body, at: iso(), read: false });
  }
}

function notifyAuthority(store: Store, issue: Issue, type: NotificationType, title: string, body: string) {
  store.notifications.unshift({ id: uid('n'), audience: 'authority', userId: null, issueId: issue.id, type, title, body, at: iso(), read: false });
}

function pushHistory(store: Store, issue: Issue, from: Status | null, to: Status, by: string, note: string | null) {
  store.history.push({ id: uid('h'), issueId: issue.id, from, to, at: iso(), by, note });
}

function find(store: Store, id: string): Issue {
  const issue = store.issues.find((i) => i.id === id);
  if (!issue) throw new RuleError(`Issue ${id} was not found.`);
  return issue;
}

export const demoService: DataService = {
  mode: 'demo',

  async listIssues() {
    return (await load()).issues;
  },

  async getIssue(id) {
    return (await load()).issues.find((i) => i.id === id) ?? null;
  },

  async getHistory(id): Promise<StatusEvent[]> {
    return (await load()).history.filter((h) => h.issueId === id).sort((a, b) => a.at.localeCompare(b.at));
  },

  async getConfirmations(id): Promise<Confirmation[]> {
    return (await load()).confirmations.filter((c) => c.issueId === id);
  },

  async createIssue(input: NewIssueInput, user: AppUser): Promise<CreateResult> {
    const store = await load();
    const now = Date.now();
    const recent = store.createdLog.filter((l) => l.user === user.id && now - l.at < HOUR);
    if (recent.length >= 5) throw new RateLimitError();
    const sameSpot = store.issues.find(
      (i) => i.reporterId === user.id && i.category === input.category && now - new Date(i.createdAt).getTime() < 24 * HOUR && Math.abs(i.latitude - input.latitude) < 0.0003 && Math.abs(i.longitude - input.longitude) < 0.0003
    );
    if (sameSpot) throw new RuleError(`You already reported this spot as ${sameSpot.id} in the last 24 hours. Open it to add evidence instead.`);

    const maxNum = store.issues.reduce((m, i) => Math.max(m, parseInt(i.id.slice(3), 10) || 0), 1000);
    const id = `RF-${maxNum + 1}`;
    const analysed = Boolean(input.analysis);
    const issue: Issue = {
      id, category: input.category, severity: input.severity, status: analysed ? 'ai_analyzed' : 'reported',
      title: input.title, description: input.description, grievance: input.grievance,
      latitude: input.latitude, longitude: input.longitude, address: input.address, roadName: input.roadName, area: input.area,
      reporterId: user.id, createdAt: iso(), updatedAt: iso(), lastVerifiedAt: null, supporters: 1,
      photo: input.photo, imageHash: input.imageHash, analysis: input.analysis,
      department: null, assignedAt: null, workStartedAt: null, resolvedAt: null, citizenVerifiedAt: null,
      notes: [], needsEvidence: false, resolution: null, facilities: input.facilities, externalRefs: [], isDemo: false,
    };
    store.issues.unshift(issue);
    store.createdLog.push({ user: user.id, at: now });
    pushHistory(store, issue, null, 'reported', user.name, null);
    if (analysed) pushHistory(store, issue, 'reported', 'ai_analyzed', 'RoadFix analyzer', null);
    store.notifications.unshift({ id: uid('n'), audience: 'citizen', userId: user.id, issueId: id, type: 'report_submitted', title: 'Report submitted', body: `${id} was received. Authorities can now review it.`, at: iso(), read: false });
    if (analysed) store.notifications.unshift({ id: uid('n'), audience: 'citizen', userId: user.id, issueId: id, type: 'report_analyzed', title: 'Report analyzed', body: `${id} was checked with AI assistance. Review the result in the report.`, at: iso(), read: false });
    if (issue.severity === 'high') notifyAuthority(store, issue, 'new_high_priority', 'New high-priority issue', `${id} (${CATEGORY_META[issue.category].label}) was reported with high severity.`);
    const warnings: string[] = [];
    persist(store, warnings);
    emit();
    return { issue, warnings };
  },

  async confirm(issueId: string, kind: ConfirmationKind, user: AppUser, opts?: ConfirmOptions): Promise<Issue> {
    const store = await load();
    const issue = find(store, issueId);
    const mine = store.confirmations.filter((c) => c.issueId === issueId && c.userId === user.id);
    const isReporter = issue.reporterId === user.id;
    const isSupporter = isReporter || mine.some((c) => c.kind === 'confirm' || c.kind === 'add_evidence' || c.kind === 'still_exists');

    if (kind === 'confirm') {
      if (isClosed(issue.status)) throw new RuleError('This issue is already marked resolved.');
      if (isSupporter) throw new RuleError(isReporter ? 'You reported this issue, so it already counts as yours.' : 'You already confirmed this issue.');
      issue.supporters += 1;
      issue.lastVerifiedAt = iso();
    } else if (kind === 'still_exists') {
      if (mine.some((c) => c.kind === 'still_exists' && Date.now() - new Date(c.at).getTime() < 24 * HOUR)) throw new RuleError('You already told us this today. Thanks.');
      if (!isSupporter) issue.supporters += 1;
      issue.lastVerifiedAt = iso();
      if (isClosed(issue.status)) {
        const from = issue.status;
        issue.status = 'reopened';
        issue.resolution = { afterPhoto: issue.resolution?.afterPhoto ?? null, comparison: opts?.comparison ?? issue.resolution?.comparison ?? null, fixedVotes: 0, stillExistsVotes: (issue.resolution?.stillExistsVotes ?? 0) + 1 };
        pushHistory(store, issue, from, 'reopened', user.name, 'Citizen reports the problem still exists');
        notifyAuthority(store, issue, 'still_unresolved', 'Citizen reports issue still unresolved', `${issue.id} was marked resolved, but a citizen says the problem still exists.`);
      }
    } else if (kind === 'fixed') {
      if (issue.status !== 'resolved') throw new RuleError('Repair verification opens once an authority marks the issue resolved.');
      if (!isSupporter) throw new RuleError('Only citizens who reported or confirmed this issue can verify the repair.');
      if (mine.some((c) => c.kind === 'fixed')) throw new RuleError('You already verified this repair.');
      const votes = (issue.resolution?.fixedVotes ?? 0) + 1;
      issue.resolution = {
        afterPhoto: opts?.photo ?? issue.resolution?.afterPhoto ?? null,
        comparison: opts?.comparison ?? issue.resolution?.comparison ?? null,
        fixedVotes: votes,
        stillExistsVotes: issue.resolution?.stillExistsVotes ?? 0,
      };
      // One vote backed by an after-repair photo is enough; otherwise two independent citizens are needed.
      const hasEvidence = Boolean(opts?.photo) || Boolean(issue.resolution.afterPhoto);
      if (votes >= 2 || (votes >= 1 && hasEvidence)) {
        issue.status = 'citizen_verified';
        issue.citizenVerifiedAt = iso();
        pushHistory(store, issue, 'resolved', 'citizen_verified', user.name, `Verified by ${votes} citizen${votes > 1 ? 's' : ''}`);
        notifyAuthority(store, issue, 'still_unresolved', 'Repair confirmed by citizens', `${issue.id} was confirmed fixed by the community.`);
      }
    } else if (kind === 'add_evidence') {
      if (!opts?.photo) throw new RuleError('Attach a photo to add evidence.');
      if (!isSupporter) issue.supporters += 1;
      issue.needsEvidence = false;
      issue.lastVerifiedAt = iso();
    }

    store.confirmations.push({ id: uid('c'), issueId, userId: user.id, kind, at: iso(), photo: opts?.photo ?? null });
    issue.updatedAt = iso();
    if ([5, 10, 20].includes(issue.supporters) && (kind === 'confirm' || kind === 'add_evidence')) {
      notifyAuthority(store, issue, 'multiple_reports', 'Multiple reports for one location', `${issue.id} now has ${issue.supporters} supporting reports.`);
    }
    persist(store);
    emit();
    return issue;
  },

  async updateStatus(issueId, to, user, note) {
    requireAuthority(user);
    const store = await load();
    const issue = find(store, issueId);
    if (!AUTHORITY_TRANSITIONS[issue.status].includes(to)) throw new RuleError(`An issue that is "${issue.status.replace(/_/g, ' ')}" cannot move to "${to.replace(/_/g, ' ')}".`);
    if (to === 'assigned') throw new RuleError('Use Assign to choose a department.');
    const from = issue.status;
    issue.status = to;
    issue.updatedAt = iso();
    if (to === 'verified') issue.lastVerifiedAt = iso();
    if (to === 'work_started') issue.workStartedAt = iso();
    if (to === 'resolved') {
      issue.resolvedAt = iso();
      issue.resolution = { afterPhoto: null, comparison: null, fixedVotes: 0, stillExistsVotes: 0 };
    }
    pushHistory(store, issue, from, to, user.name, note ?? null);
    if (to === 'verified') notifyCitizens(store, issue, 'verified', 'Report verified', `${issue.id} was verified by ${user.name}.`);
    if (to === 'work_started') notifyCitizens(store, issue, 'work_started', 'Work has started', `Repair work on ${issue.id} has started.`);
    if (to === 'resolved') {
      notifyCitizens(store, issue, 'resolved', 'Issue marked resolved', `${issue.id} was marked resolved by the authority.`);
      notifyCitizens(store, issue, 'verification_requested', 'Please verify the repair', `Has ${issue.id} actually been fixed? An after-repair photo helps.`);
    }
    persist(store);
    emit();
    return issue;
  },

  async assign(issueId, department, user, note) {
    requireAuthority(user);
    const store = await load();
    const issue = find(store, issueId);
    if (!['verified', 'reopened', 'assigned', 'reported', 'ai_analyzed'].includes(issue.status)) throw new RuleError('This issue is already being worked on.');
    const from = issue.status;
    const reassign = issue.status === 'assigned';
    issue.status = 'assigned';
    issue.department = department;
    issue.assignedAt = iso();
    issue.updatedAt = iso();
    if (!issue.lastVerifiedAt) issue.lastVerifiedAt = iso();
    pushHistory(store, issue, from, 'assigned', user.name, note ? `${department}: ${note}` : department);
    notifyCitizens(store, issue, 'assigned', reassign ? 'Report re-assigned' : 'Your report was assigned', `${issue.id} was assigned to ${department}.`);
    persist(store);
    emit();
    return issue;
  },

  async addNote(issueId, text, kind, user) {
    requireAuthority(user);
    const store = await load();
    const issue = find(store, issueId);
    const clean = text.trim();
    if (!clean) throw new RuleError('Write a note first.');
    const note: IssueNote = { id: uid('note'), at: iso(), by: user.name, text: clean.slice(0, 600), kind };
    issue.notes.push(note);
    if (kind === 'evidence_request') {
      issue.needsEvidence = true;
      notifyCitizens(store, issue, 'evidence_requested', 'More evidence requested', `${issue.id}: ${clean.slice(0, 120)}`);
    }
    issue.updatedAt = iso();
    persist(store);
    emit();
    return issue;
  },

  async addExternalRef(issueId, ref, user) {
    const store = await load();
    const issue = find(store, issueId);
    const staff = user.role === 'authority' || user.role === 'admin';
    const involved = issue.reporterId === user.id || store.confirmations.some((c) => c.issueId === issueId && c.userId === user.id);
    if (!staff && !involved) throw new ForbiddenError('Only people who reported or confirmed this issue can add a reference number.');
    const reference = ref.reference.trim().slice(0, 60);
    if (reference.length < 3) throw new RuleError('Enter the reference number the office gave you.');
    issue.externalRefs = [...(issue.externalRefs ?? []), { id: uid('x'), authorityId: ref.authorityId, authorityName: ref.authorityName, channel: ref.channel, reference, at: iso(), by: user.name }];
    issue.updatedAt = iso();
    persist(store);
    emit();
    return issue;
  },

  async listNotifications(user): Promise<AppNotification[]> {
    const store = await load();
    return store.notifications
      .filter((n) => (user.role === 'citizen' ? n.audience === 'citizen' && n.userId === user.id : n.audience === 'authority'))
      .sort((a, b) => b.at.localeCompare(a.at));
  },

  async markNotificationsRead(user, ids) {
    const store = await load();
    store.notifications.forEach((n) => {
      const mine = user.role === 'citizen' ? n.audience === 'citizen' && n.userId === user.id : n.audience === 'authority';
      if (mine && (!ids || ids.includes(n.id))) n.read = true;
    });
    persist(store);
    emit();
  },

  async getActivity(user): Promise<Activity> {
    const store = await load();
    const mine = store.issues.filter((i) => i.reporterId === user.id);
    const conf = store.confirmations.filter((c) => c.userId === user.id);
    return {
      reportsSubmitted: mine.length,
      // Only reports that authorities verified, or that neighbours corroborated, count toward badges (anti-spam).
      reportsVerified: mine.filter((i) => isVerifiedStatus(i.status) || isClosed(i.status) || i.supporters >= 3).length,
      confirmationsGiven: conf.filter((c) => c.kind === 'confirm' || c.kind === 'add_evidence').length,
      repairsVerified: conf.filter((c) => c.kind === 'fixed').length,
    };
  },

  subscribe(cb) {
    listeners.add(cb);
    return () => listeners.delete(cb);
  },

  async resetDemo() {
    localStorage.removeItem(KEY);
    memory = null;
    loading = null;
    await load();
    emit();
  },
};

export { DEMO_USERS };
