import { Navigate, useLocation } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useApp } from '@/lib/appContext';
import type { Role } from '@/lib/domain';
import { EmptyState, Loading } from './States';
import { Link } from 'react-router-dom';
import { ShieldAlert } from 'lucide-react';

/** Frontend route guard. The real enforcement is in the data service / Supabase RLS. */
export function RequireRole({ roles, children }: { roles: Role[]; children: ReactNode }) {
  const { user, authReady } = useApp();
  const loc = useLocation();
  if (!authReady) return <Loading label="Checking your session…" />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname)}`} replace />;
  if (!roles.includes(user.role)) {
    return (
      <EmptyState
        page
        icon={<ShieldAlert className="h-6 w-6" aria-hidden />}
        title="This area is for authority staff"
        body={`You are signed in as ${user.role}. Ask an administrator for access, or go back to your dashboard.`}
        action={<Link to="/app" className="btn-dark">Go to my dashboard</Link>}
      />
    );
  }
  return <>{children}</>;
}
