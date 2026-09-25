import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppContext, type AppState } from '@/lib/appContext';
import { auth, service } from '@/lib/data';
import type { AppNotification, AppUser } from '@/lib/domain';
import { enrichIssues, type EnrichedIssue } from '@/lib/enrich';
import { MODE, MODE_NOTE } from '@/lib/mode';

export default function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [issues, setIssues] = useState<EnrichedIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  const reload = useCallback(async () => {
    try {
      setError(null);
      const list = await service.listIssues();
      setIssues(enrichIssues(list));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load incidents.');
    } finally {
      setLoading(false);
    }
  }, []);

  const refreshNotifications = useCallback(async () => {
    if (!user) {
      setNotifications([]);
      return;
    }
    try {
      setNotifications(await service.listNotifications(user));
    } catch {
      /* notifications are non-critical */
    }
  }, [user]);

  useEffect(() => {
    let alive = true;
    void auth.current().then((u) => {
      if (alive) {
        setUser(u);
        setAuthReady(true);
      }
    }).catch(() => alive && setAuthReady(true));
    const off = auth.onChange((u) => setUser(u));
    return () => {
      alive = false;
      off();
    };
  }, []);

  useEffect(() => {
    void reload();
    return service.subscribe(() => {
      void reload();
    });
  }, [reload]);

  useEffect(() => {
    void refreshNotifications();
    return service.subscribe(() => {
      void refreshNotifications();
    });
  }, [refreshNotifications]);

  const value = useMemo<AppState>(
    () => ({
      mode: MODE,
      modeNote: MODE_NOTE,
      user,
      authReady,
      issues,
      loading,
      error,
      reload,
      notifications,
      unread: notifications.filter((n) => !n.read).length,
      refreshNotifications,
      markAllRead: async () => {
        if (user) {
          await service.markNotificationsRead(user);
          await refreshNotifications();
        }
      },
      signOut: () => auth.signOut(),
      switchPersona: (role) => auth.switchPersona?.(role),
      resetDemo: async () => {
        await service.resetDemo?.();
        await reload();
      },
    }),
    [user, authReady, issues, loading, error, reload, notifications, refreshNotifications]
  );

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}
