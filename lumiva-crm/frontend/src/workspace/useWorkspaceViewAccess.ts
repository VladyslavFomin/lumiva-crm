import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { fetchCustomObject } from '../api/customObjects';
import { parseEnabledViews } from './workspaceEnabledViews';

export function useWorkspaceViewAccess(
  objectId: string,
  view: 'kanban' | 'calendar' | 'analytics' | 'gantt',
) {
  const navigate = useNavigate();
  const [allowed, setAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    if (!objectId) return;
    let alive = true;
    fetchCustomObject(objectId)
      .then((o) => {
        if (!alive) return;
        const v = parseEnabledViews(o.meta);
        const ok =
          view === 'kanban'
            ? v.kanban
            : view === 'calendar'
              ? v.calendar
              : view === 'analytics'
                ? v.analytics
                : v.gantt;
        setAllowed(ok);
        if (!ok) {
          navigate(`/workspace/${objectId}/table`, { replace: true });
        }
      })
      .catch(() => {
        if (!alive) return;
        setAllowed(false);
        navigate(`/workspace/${objectId}/table`, { replace: true });
      });
    return () => {
      alive = false;
    };
  }, [objectId, view, navigate]);

  return allowed;
}
