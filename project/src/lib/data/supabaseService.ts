import type {
  AppNotification, AppUser, Confirmation, ConfirmationKind, Issue, IssueNote, NewIssueInput, PhotoRef, Status, StatusEvent, NotificationType, Category, Severity,
} from '../domain';
import { EVIDENCE_BUCKET, getSupabase } from '../mode';
import { ForbiddenError, RateLimitError, RuleError, type Activity, type ConfirmOptions, type CreateResult, type DataService } from './service';

type Row = Record<string, unknown>;

function toError(err: { message?: string; code?: string }): Error {
  const msg = err.message ?? 'Request failed.';
  if (err.code === '42501' || msg.startsWith('forbidden')) return new ForbiddenError(msg.replace(/^forbidden:\s*/, ''));
  if (msg.includes('rate_limit')) return new RateLimitError();
  if (err.code === '28000' || msg.includes('not_authenticated')) return new ForbiddenError('Sign in to do that.');
  return new RuleError(msg);
}

const photo = (url: unknown): PhotoRef | null => (typeof url === 'string' && url ? { kind: 'upload', url } : null);

function mapIssue(r: Row, notes: IssueNote[] = []): Issue {
  const res = r.resolution as { afterPhotoUrl?: string | null; comparison?: Issue['resolution'] extends infer T ? (T extends { comparison: infer C } ? C : never) : never; fixedVotes?: number; stillExistsVotes?: number } | null;
  return {
    id: r.id as string,
    category: r.category as Category,
    severity: r.severity as Severity,
    status: r.status as Status,
    title: r.title as string,
    description: r.description as string,
    grievance: (r.grievance as string | null) ?? null,
    latitude: r.latitude as number,
    longitude: r.longitude as number,
    address: (r.address as string) ?? '',
    roadName: (r.road_name as string) ?? 'Unnamed road',
    area: (r.area as string) ?? 'Unknown area',
    reporterId: (r.reporter_id as string) ?? null,
    createdAt: r.created_at as string,
    updatedAt: r.updated_at as string,
    lastVerifiedAt: (r.last_verified_at as string | null) ?? null,
    supporters: (r.supporters as number) ?? 1,
    photo: photo(r.photo_url),
    imageHash: (r.image_hash as string | null) ?? null,
    analysis: (r.ai_analysis as Issue['analysis']) ?? null,
    department: (r.department as string | null) ?? null,
    assignedAt: (r.assigned_at as string | null) ?? null,
    workStartedAt: (r.work_started_at as string | null) ?? null,
    resolvedAt: (r.resolved_at as string | null) ?? null,
    citizenVerifiedAt: (r.citizen_verified_at as string | null) ?? null,
    notes,
    needsEvidence: Boolean(r.needs_evidence),
    resolution: res ? { afterPhoto: photo(res.afterPhotoUrl), comparison: res.comparison ?? null, fixedVotes: res.fixedVotes ?? 0, stillExistsVotes: res.stillExistsVotes ?? 0 } : null,
    facilities: (r.facilities as Issue['facilities']) ?? null,
    externalRefs: (r.external_refs as Issue['externalRefs'] | null) ?? [],
    isDemo: Boolean(r.is_demo),
  };
}

async function upload(blob: Blob, userId: string): Promise<string> {
  const sb = getSupabase();
  const path = `${userId}/${crypto.randomUUID()}.jpg`;
  const { error } = await sb.storage.from(EVIDENCE_BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: false });
  if (error) throw new RuleError(`Photo upload failed: ${error.message}`);
  return sb.storage.from(EVIDENCE_BUCKET).getPublicUrl(path).data.publicUrl;
}

async function notesFor(id: string): Promise<IssueNote[]> {
  const { data } = await getSupabase().from('issue_notes').select('*').eq('issue_id', id).order('created_at');
  return ((data ?? []) as Row[]).map((n) => ({ id: n.id as string, at: n.created_at as string, by: n.author_name as string, text: n.text as string, kind: n.kind as IssueNote['kind'] }));
}

export const supabaseService: DataService = {
  mode: 'live',

  async listIssues() {
    const sb = getSupabase();
    const out: Issue[] = [];
    for (let from = 0; from < 2000; from += 1000) {
      const { data, error } = await sb.from('issues').select('*').order('created_at', { ascending: false }).range(from, from + 999);
      if (error) throw toError(error);
      out.push(...((data ?? []) as Row[]).map((r) => mapIssue(r)));
      if (!data || data.length < 1000) break;
    }
    return out;
  },

  async getIssue(id) {
    const { data, error } = await getSupabase().from('issues').select('*').eq('id', id).maybeSingle();
    if (error) throw toError(error);
    return data ? mapIssue(data as Row, await notesFor(id)) : null;
  },

  async getHistory(id): Promise<StatusEvent[]> {
    const { data, error } = await getSupabase().from('status_history').select('*').eq('issue_id', id).order('created_at');
    if (error) throw toError(error);
    return ((data ?? []) as Row[]).map((h) => ({ id: h.id as string, issueId: id, from: (h.from_status as Status | null) ?? null, to: h.to_status as Status, at: h.created_at as string, by: h.actor_name as string, note: (h.note as string | null) ?? null }));
  },

  async getConfirmations(id): Promise<Confirmation[]> {
    const { data, error } = await getSupabase().from('confirmations').select('*').eq('issue_id', id);
    if (error) throw toError(error);
    return ((data ?? []) as Row[]).map((c) => ({ id: c.id as string, issueId: id, userId: c.user_id as string, kind: c.kind as ConfirmationKind, at: c.created_at as string, photo: photo(c.photo_url) }));
  },

  async createIssue(input: NewIssueInput, user: AppUser): Promise<CreateResult> {
    const sb = getSupabase();
    let photoUrl: string | null = null;
    if (input.photoBlob) photoUrl = await upload(input.photoBlob, user.id);
    const { data, error } = await sb
      .from('issues')
      .insert({
        category: input.category, severity: input.severity, status: input.analysis ? 'ai_analyzed' : 'reported',
        title: input.title, description: input.description, grievance: input.grievance,
        latitude: input.latitude, longitude: input.longitude, address: input.address, road_name: input.roadName, area: input.area,
        reporter_id: user.id, photo_url: photoUrl, image_hash: input.imageHash, ai_analysis: input.analysis, facilities: input.facilities,
      })
      .select('*')
      .single();
    if (error) throw toError(error);
    return { issue: mapIssue(data as Row), warnings: [] };
  },

  async confirm(issueId, kind, user, opts?: ConfirmOptions) {
    let url: string | null = null;
    if (opts?.photoBlob) url = await upload(opts.photoBlob, user.id);
    else if (opts?.photo?.kind === 'upload') url = opts.photo.url;
    const { data, error } = await getSupabase().rpc('rf_confirm', { p_issue: issueId, p_kind: kind, p_photo_url: url, p_comparison: opts?.comparison ?? null });
    if (error) throw toError(error);
    return mapIssue(data as Row);
  },

  async updateStatus(issueId, to: Status, _user, note) {
    const { data, error } = await getSupabase().rpc('rf_set_status', { p_issue: issueId, p_to: to, p_department: null, p_note: note ?? null });
    if (error) throw toError(error);
    return mapIssue(data as Row);
  },

  async assign(issueId, department, _user, note) {
    const { data, error } = await getSupabase().rpc('rf_set_status', { p_issue: issueId, p_to: 'assigned', p_department: department, p_note: note ?? null });
    if (error) throw toError(error);
    return mapIssue(data as Row);
  },

  async addNote(issueId, text, kind) {
    const { data, error } = await getSupabase().rpc('rf_add_note', { p_issue: issueId, p_text: text, p_kind: kind });
    if (error) throw toError(error);
    return mapIssue(data as Row, await notesFor(issueId));
  },

  async addExternalRef(issueId, ref) {
    const { data, error } = await getSupabase().rpc('rf_add_external_ref', { p_issue: issueId, p_authority: ref.authorityId, p_authority_name: ref.authorityName, p_channel: ref.channel, p_reference: ref.reference });
    if (error) throw toError(error);
    return mapIssue(data as Row, await notesFor(issueId));
  },

  async listNotifications(user): Promise<AppNotification[]> {
    const { data, error } = await getSupabase().from('notifications').select('*').eq('user_id', user.id).order('created_at', { ascending: false }).limit(100);
    if (error) throw toError(error);
    return ((data ?? []) as Row[]).map((n) => ({ id: n.id as string, audience: user.role, userId: user.id, issueId: (n.issue_id as string | null) ?? null, type: n.type as NotificationType, title: n.title as string, body: n.body as string, at: n.created_at as string, read: Boolean(n.read) }));
  },

  async markNotificationsRead(user, ids) {
    let q = getSupabase().from('notifications').update({ read: true }).eq('user_id', user.id);
    if (ids) q = q.in('id', ids);
    const { error } = await q;
    if (error) throw toError(error);
  },

  async getActivity(user): Promise<Activity> {
    const sb = getSupabase();
    const [mine, conf] = await Promise.all([
      sb.from('issues').select('status, supporters').eq('reporter_id', user.id),
      sb.from('confirmations').select('kind').eq('user_id', user.id),
    ]);
    const reports = (mine.data ?? []) as Array<{ status: string; supporters: number }>;
    const confs = (conf.data ?? []) as Array<{ kind: string }>;
    return {
      reportsSubmitted: reports.length,
      reportsVerified: reports.filter((r) => !['reported', 'ai_analyzed'].includes(r.status) || r.supporters >= 3).length,
      confirmationsGiven: confs.filter((c) => c.kind === 'confirm' || c.kind === 'add_evidence').length,
      repairsVerified: confs.filter((c) => c.kind === 'fixed').length,
    };
  },

  subscribe(cb) {
    const sb = getSupabase();
    const channel = sb.channel('roadfix-issues').on('postgres_changes', { event: '*', schema: 'public', table: 'issues' }, () => cb()).subscribe();
    return () => {
      void sb.removeChannel(channel);
    };
  },
};
