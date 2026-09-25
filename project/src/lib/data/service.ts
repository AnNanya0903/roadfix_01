import type {
  ExternalRef, AppMode, AppNotification, AppUser, Confirmation, ConfirmationKind, Issue, IssueNote, NewIssueInput, PhotoRef, ResolutionComparison, Status, StatusEvent,
} from '../domain';

export class ForbiddenError extends Error {
  constructor(message = 'You do not have permission to do that.') {
    super(message);
    this.name = 'ForbiddenError';
  }
}
export class RateLimitError extends Error {
  constructor(message = 'You are reporting too quickly. Please wait a little before sending another report.') {
    super(message);
    this.name = 'RateLimitError';
  }
}
export class RuleError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'RuleError';
  }
}

export interface ConfirmOptions {
  photo?: PhotoRef | null;
  photoBlob?: Blob | null;
  comparison?: ResolutionComparison | null;
}

export interface Activity {
  reportsSubmitted: number;
  reportsVerified: number;
  confirmationsGiven: number;
  repairsVerified: number;
}

export interface CreateResult {
  issue: Issue;
  warnings: string[];
}

/**
 * Everything the UI needs from a backend. Authorization is enforced inside implementations:
 * the demo service checks roles itself; the Supabase service relies on Row Level Security and
 * SECURITY DEFINER functions, so hiding a button is never the only protection.
 */
export interface DataService {
  mode: AppMode;
  listIssues(): Promise<Issue[]>;
  getIssue(id: string): Promise<Issue | null>;
  getHistory(id: string): Promise<StatusEvent[]>;
  getConfirmations(id: string): Promise<Confirmation[]>;
  createIssue(input: NewIssueInput, user: AppUser): Promise<CreateResult>;
  confirm(issueId: string, kind: ConfirmationKind, user: AppUser, opts?: ConfirmOptions): Promise<Issue>;
  updateStatus(issueId: string, to: Status, user: AppUser, note?: string): Promise<Issue>;
  assign(issueId: string, department: string, user: AppUser, note?: string): Promise<Issue>;
  addNote(issueId: string, text: string, kind: IssueNote['kind'], user: AppUser): Promise<Issue>;
  addExternalRef(issueId: string, ref: Pick<ExternalRef, 'authorityId' | 'authorityName' | 'channel' | 'reference'>, user: AppUser): Promise<Issue>;
  listNotifications(user: AppUser): Promise<AppNotification[]>;
  markNotificationsRead(user: AppUser, ids?: string[]): Promise<void>;
  getActivity(user: AppUser): Promise<Activity>;
  subscribe(cb: () => void): () => void;
  resetDemo?(): Promise<void>;
}

export interface AuthAPI {
  current(): Promise<AppUser | null>;
  signIn(email: string, password: string): Promise<AppUser>;
  signUp(email: string, password: string, name: string): Promise<AppUser | null>;
  signOut(): Promise<void>;
  onChange(cb: (user: AppUser | null) => void): () => void;
  /** Demo mode only. */
  switchPersona?(role: 'citizen' | 'authority' | 'admin'): void;
}
