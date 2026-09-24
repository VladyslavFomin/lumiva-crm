import React from 'react';
import type { AiAssignee } from '../../api/aiEmployees';

/**
 * ИИ-ответственные в таблицах: фиолетовый градиентный чип с ✦ — сразу отличим от сотрудников-людей.
 * inline-стили: таблицы разных модулей имеют разные CSS-системы, общий класс не подошёл бы.
 */
export function AiAssigneeChips({ items }: { items?: AiAssignee[] | null }) {
  if (!items?.length) return null;
  return (
    <>
      {items.map((a) => (
        <span
          key={a.agentId}
          title={`${a.name} · AI`}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 4,
            height: 22,
            padding: '0 8px 0 6px',
            borderRadius: 11,
            fontSize: 11,
            fontWeight: 600,
            lineHeight: 1,
            color: '#fff',
            background: 'linear-gradient(135deg,#7c3aed,#2563eb 60%,#06b6d4)',
            boxShadow: '0 1px 6px rgba(99,102,241,.35)',
            whiteSpace: 'nowrap',
            marginLeft: 4,
            verticalAlign: 'middle',
          }}
        >
          <span aria-hidden style={{ fontSize: 10 }}>✦</span>
          {a.name}
        </span>
      ))}
    </>
  );
}
