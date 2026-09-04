import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MainLayout } from '../../layout/MainLayout';
import { fetchWorkspaceAreas } from '../../api/workspaceAreas';

const LS_KEY = 'lumiva_workspace_area_id';

/** /workspace — smart redirect only. The real "all areas" grid lives at /workspace/areas
 * (WorkspaceAreasListPage). Goes to the last-selected area if one is stored (same key
 * WorkspaceAreaSwitcher uses), else the first area, else the areas list as a last resort. */
export const WorkspaceTablesPage: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    let alive = true;
    void (async () => {
      try {
        const areas = await fetchWorkspaceAreas();
        if (!alive) return;
        let stored: string | null = null;
        try {
          stored = localStorage.getItem(LS_KEY);
        } catch {
          /* ignore */
        }
        const target = (stored && areas.find((a) => a.id === stored)) || areas[0];
        if (target?.id) {
          navigate(`/workspace/areas/${target.id}`, { replace: true });
          return;
        }
      } catch {
        /* fall through to areas list */
      }
      if (!alive) return;
      navigate('/workspace/areas', { replace: true });
    })();
    return () => {
      alive = false;
    };
  }, [navigate]);

  return <MainLayout>{null}</MainLayout>;
};
