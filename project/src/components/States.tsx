import { AlertTriangle, Inbox, Loader2, RefreshCw } from 'lucide-react';
import type { ReactNode } from 'react';

export function Loading({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-sm text-signal-gray" role="status" aria-live="polite">
      <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> {label}
    </div>
  );
}

export function EmptyState({ title, body, action, icon, page = false }: { title: string; body: string; action?: ReactNode; icon?: ReactNode; page?: boolean }) {
  const Heading = page ? 'h1' : 'h3';
  return (
    <div className="flex flex-col items-center px-4 py-14 text-center">
      <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-concrete text-signal-gray">{icon ?? <Inbox className="h-6 w-6" aria-hidden />}</div>
      <Heading className="font-display text-xl font-semibold">{title}</Heading>
      <p className="mt-1 max-w-sm text-sm text-signal-gray">{body}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="mx-auto my-8 max-w-md rounded-lg border border-signal-red/30 bg-signal-redbg p-5 text-center" role="alert">
      <AlertTriangle className="mx-auto mb-2 h-6 w-6 text-signal-red" aria-hidden />
      <p className="text-sm font-semibold text-signal-red">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn-outline btn-sm mt-3">
          <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Try again
        </button>
      )}
    </div>
  );
}

export function InlineNotice({ tone = 'info', children }: { tone?: 'info' | 'warn' | 'error' | 'ok'; children: ReactNode }) {
  const cls = { info: 'bg-signal-bluebg text-signal-blue', warn: 'bg-lane-100 text-lane-700', error: 'bg-signal-redbg text-signal-red', ok: 'bg-signal-greenbg text-signal-green' }[tone];
  return (
    <div className={`rounded-md px-3 py-2 text-sm ${cls}`} role={tone === 'error' ? 'alert' : 'status'}>
      {children}
    </div>
  );
}
