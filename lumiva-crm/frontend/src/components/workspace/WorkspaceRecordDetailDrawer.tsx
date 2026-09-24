import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';
import {
  uploadWorkspaceFile,
  WORKSPACE_UPLOAD_MAX_FILE_LABEL,
  type CustomObjectField,
  type CustomObjectRecord,
  type WorkspaceFileFieldValue,
} from '../../api/customObjects';
import type { StaffUser } from '../../api/staff';
import type { Lead } from '../../api/leads';
import type { Project } from '../../api/projects';
import type { Company } from '../../api/companies';
import { collectStatusValuesFromRecords } from './workspaceStatusField';
import { normalizeOptionToken } from '../../workspace/normalizeOptionToken';
import { WorkspaceFileViewerModal } from './WorkspaceFileViewerModal';
import { getWorkspaceFieldValueStorageKey } from '../../workspace/workspaceFieldValueKey';
import { isRenderableWorkspaceDateField } from '../../workspace/workspaceDateField';
import { isWorkspaceEntityRefField, isWorkspaceReadOnlyField } from '../../workspace/workspaceEntityRef';
import { WorkspaceCrmEntityMultiField } from './WorkspaceCrmEntityMultiField';
import { getWorkspaceDataLink } from '../../workspace/workspaceRecordLink';
import { getStoredUser } from '../../auth/session';
import { AiAssigneeGroup } from '../ai/AiAssigneeGroup';
import { refreshWorkspaceAiColumn } from '../../api/customObjects';
import { aiColumnErrorMessage } from '../../pages/workspace/workspaceAiErrors';
import { splitTextWithMentions, isTextMentioning } from '../../pages/projects/mentions';
import '../../pages/workspace/WorkspaceArea.css';

/** Комментарий записи рабочей области — та же форма, что EntityComment (Lead/Project/Sale/…),
 * но хранится не в отдельной колонке БД, а в values.__comments записи (как __subitems) — это
 * реальное серверное хранение (видно всем сотрудникам), просто без отдельной миграции. */
export type WorkspaceComment = {
  id: string;
  author: string;
  createdAt: string;
  text: string;
  mentions?: string[];
  parentId?: string | null;
  likedBy?: string[];
};

const getRecordComments = (record: CustomObjectRecord): WorkspaceComment[] => {
  const raw = record.values?.__comments;
  return Array.isArray(raw) ? (raw as WorkspaceComment[]) : [];
};

const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
  const normalized = String(hex || '').trim().replace('#', '');
  if (!/^[0-9a-fA-F]{3,8}$/.test(normalized)) return null;
  const short = normalized.length === 3 || normalized.length === 4;
  const full = short
    ? normalized
        .slice(0, 3)
        .split('')
        .map((ch) => ch + ch)
        .join('')
    : normalized.slice(0, 6);
  const int = Number.parseInt(full, 16);
  if (!Number.isFinite(int)) return null;
  return { r: (int >> 16) & 255, g: (int >> 8) & 255, b: int & 255 };
};
const pickTextColorForBg = (hex: string) => {
  const rgb = hexToRgb(hex);
  if (!rgb) return '#111827';
  const luminance = (0.299 * rgb.r + 0.587 * rgb.g + 0.114 * rgb.b) / 255;
  return luminance > 0.6 ? '#0f172a' : '#ffffff';
};

export type WorkspaceRecordDetailDrawerProps = {
  record: CustomObjectRecord | null;
  onClose: () => void;
  onEditRecord: (next: CustomObjectRecord) => void;
  orderedColumns: CustomObjectField[];
  titleField: CustomObjectField | undefined;
  statusField: CustomObjectField | undefined;
  staffByDepartment: Array<{ department: string; users: StaffUser[] }>;
  /** Плоский список сотрудников тенанта — для @упоминаний в комментариях. */
  staff: StaffUser[];
  activityByRecord: Record<string, Array<{ id: string; text: string; createdAt: string }>>;
  pushActivity: (recordId: string, text: string) => void;
  saveRecord: (
    record: CustomObjectRecord,
    nextValues: Record<string, any>,
    changedField?: string,
  ) => void | Promise<void>;
  savingRecordId: string | null;
  showAddFieldButton?: boolean;
  onAddField?: () => void;
  /** Overlay z-index (table uses 40; kanban may need higher). */
  overlayZIndex?: number;
  /** Чтобы в списке статусов были значения из данных, даже если их нет в options поля. */
  recordsForStatusOptions?: CustomObjectRecord[];
  /** Таблица (custom object id) — для загрузки файлов в полях типа file */
  objectId: string;
  /** Слой «данные»: поля в сетке «по полочкам», удобно для импортов и больших строк */
  shelfLayout?: boolean;
  /** Колонки meta.workspaceEntityRef — списки для выбора лида/проекта */
  crmLeadOptions?: Lead[];
  crmProjectOptions?: Project[];
  crmCompanyOptions?: Company[];
};

export const WorkspaceRecordDetailDrawer: React.FC<WorkspaceRecordDetailDrawerProps> = ({
  record: activeRecord,
  onClose,
  onEditRecord,
  orderedColumns,
  titleField,
  statusField,
  staffByDepartment,
  staff,
  activityByRecord,
  pushActivity,
  saveRecord,
  savingRecordId,
  showAddFieldButton,
  onAddField,
  overlayZIndex = 40,
  recordsForStatusOptions,
  objectId,
  shelfLayout = false,
  crmLeadOptions = [],
  crmProjectOptions = [],
  crmCompanyOptions = [],
}) => {
  const { t, i18n } = useTranslation();
  const [filePreview, setFilePreview] = useState<{
    fileName: string;
    relativePath: string;
    fieldKey: string;
  } | null>(null);
  const [fileUploadErrorByField, setFileUploadErrorByField] = useState<Record<string, string>>({});
  const [aiRefreshingKey, setAiRefreshingKey] = useState<string | null>(null);
  const [aiRefreshError, setAiRefreshError] = useState<string | null>(null);

  // ── Комментарии: упоминания, лайки, ответы (как в карточке лида/проекта) ──
  const [newComment, setNewComment] = useState('');
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [mentionPos, setMentionPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const [replyText, setReplyText] = useState('');
  const [replyingToId, setReplyingToId] = useState<string | null>(null);
  const commentInputRef = useRef<HTMLTextAreaElement>(null);
  const commentUser = useMemo(() => getStoredUser(), []);
  const currentStaffForComments = useMemo(
    () => staff.find((u) => u.id === commentUser?.id || u.email === commentUser?.email),
    [staff, commentUser],
  );
  const currentCommentLabels = useMemo(
    () =>
      [commentUser?.name, commentUser?.email, currentStaffForComments?.fullName]
        .filter(Boolean)
        .map((v) => String(v).trim().toLowerCase()),
    [commentUser, currentStaffForComments],
  );

  useEffect(() => {
    setFileUploadErrorByField({});
    setNewComment('');
    setReplyText('');
    setReplyingToId(null);
    setMentionQuery(null);
  }, [activeRecord?.id]);
  const normalizeStatusToken = (value: string) => normalizeOptionToken(value);

  const statusOptions = useMemo(() => {
    const fromField =
      statusField?.options?.map((o) => String(o.value || '').trim()).filter(Boolean) || [];
    const fromRecords =
      statusField && recordsForStatusOptions?.length
        ? collectStatusValuesFromRecords(recordsForStatusOptions, statusField.key)
        : [];
    const merged = [...new Set([...fromField, ...fromRecords])].filter(Boolean);
    if (merged.length) return merged;
    return ['working_on_it', 'done', 'stuck', 'in_review'];
  }, [statusField, recordsForStatusOptions]);

  const statusLabelMap = useMemo(() => {
    const map: Record<string, string> = {};
    statusField?.options?.forEach((o) => {
      const value = String(o.value || '').trim();
      if (!value) return;
      map[value] = o.label || o.value;
    });
    statusOptions.forEach((opt) => {
      if (!map[opt]) map[opt] = opt.replace(/_/g, ' ');
    });
    return map;
  }, [statusField, statusOptions]);

  const statusColorMap = useMemo(() => {
    const raw = statusField?.meta?.statusColors;
    const map: Record<string, string> = {};
    if (raw && typeof raw === 'object') {
      Object.entries(raw as Record<string, any>).forEach(([key, value]) => {
        const normalizedKey = normalizeStatusToken(key);
        if (normalizedKey && typeof value === 'string' && value.trim()) {
          map[normalizedKey] = value.trim();
        }
      });
    }
    return map;
  }, [statusField]);

  const resolveStatusOptionValue = (value: string) => {
    const normalized = normalizeStatusToken(value);
    if (!normalized) return '';
    const byValue = statusOptions.find((opt) => normalizeStatusToken(opt) === normalized);
    if (byValue) return byValue;
    const byLabel = Object.entries(statusLabelMap).find(
      ([, label]) => normalizeStatusToken(label) === normalized,
    );
    if (byLabel?.[0]) return byLabel[0];
    return normalized;
  };

  const getStatusStyle = (value: string): React.CSSProperties | undefined => {
    const statusKey = resolveStatusOptionValue(value);
    const hex = statusColorMap[statusKey];
    if (!hex) return undefined;
    return {
      backgroundColor: hex,
      color: pickTextColorForBg(hex),
      borderColor: hex,
    };
  };

  const getStatusLabel = (value: string) =>
    statusLabelMap[resolveStatusOptionValue(value)] || value.replace(/_/g, ' ');

  if (!activeRecord) return null;

  const sourceLink = getWorkspaceDataLink(activeRecord.meta as Record<string, unknown> | null);

  const extractMentions = (text: string) => {
    const matches = text.matchAll(/@([\p{L}\p{N}._-]+)/gu);
    const result: string[] = [];
    for (const match of matches) if (match[1]) result.push(match[1]);
    return result;
  };
  const renderMentions = (text: string) =>
    splitTextWithMentions(text, staff).map((part, idx) =>
      part.mention ? (
        <span key={`m-${idx}`} style={{ color: '#0284c7', fontWeight: 500 }}>
          {part.text}
        </span>
      ) : (
        <span key={`t-${idx}`}>{part.text}</span>
      ),
    );
  const isMentioned = (text: string) => isTextMentioning(text, currentCommentLabels);

  const commitComments = (nextComments: WorkspaceComment[]) => {
    const nextValues = { ...(activeRecord.values || {}), __comments: nextComments };
    onEditRecord({ ...activeRecord, values: nextValues });
    void saveRecord(activeRecord, nextValues, '__comments');
  };

  const addComment = () => {
    if (!newComment.trim()) return;
    const c: WorkspaceComment = {
      id: crypto.randomUUID(),
      author:
        currentStaffForComments?.fullName ||
        commentUser?.name ||
        commentUser?.email ||
        t('crm.projects.detail.fallbacks.user'),
      createdAt: new Date().toISOString(),
      text: newComment.trim(),
      mentions: extractMentions(newComment.trim()),
    };
    commitComments([c, ...getRecordComments(activeRecord)]);
    pushActivity(activeRecord.id, t('crm.workspace.recordDrawer.addedComment'));
    setNewComment('');
    setMentionQuery(null);
  };

  const addReply = (parentId: string) => {
    if (!replyText.trim()) return;
    const c: WorkspaceComment = {
      id: crypto.randomUUID(),
      author:
        currentStaffForComments?.fullName ||
        commentUser?.name ||
        commentUser?.email ||
        t('crm.projects.detail.fallbacks.user'),
      createdAt: new Date().toISOString(),
      text: replyText.trim(),
      mentions: extractMentions(replyText.trim()),
      parentId,
    };
    commitComments([...getRecordComments(activeRecord), c]);
    setReplyText('');
    setReplyingToId(null);
  };

  const toggleCommentLike = (commentId: string) => {
    const me = currentStaffForComments?.id || commentUser?.id || commentUser?.email;
    if (!me) return;
    const nextComments = getRecordComments(activeRecord).map((c) => {
      if (c.id !== commentId) return c;
      const likedBy = c.likedBy || [];
      return {
        ...c,
        likedBy: likedBy.includes(me) ? likedBy.filter((uid) => uid !== me) : [...likedBy, me],
      };
    });
    commitComments(nextComments);
  };

  const refreshAiColumn = async (field: CustomObjectField) => {
    setAiRefreshingKey(field.key);
    setAiRefreshError(null);
    try {
      const res = await refreshWorkspaceAiColumn(activeRecord.objectId, activeRecord.id, field.key);
      if (res.ok && typeof res.value === 'string') {
        const nextValues = { ...(activeRecord.values || {}), [getWorkspaceFieldValueStorageKey(field)]: res.value };
        onEditRecord({ ...activeRecord, values: nextValues });
      } else {
        setAiRefreshError(aiColumnErrorMessage(t, res.error));
      }
    } catch {
      setAiRefreshError(aiColumnErrorMessage(t, null));
    } finally {
      setAiRefreshingKey(null);
    }
  };

  const comments = getRecordComments(activeRecord);

  return (
    <div className="ws-page ws-scrim" style={{ zIndex: overlayZIndex }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={`ws-drawer${shelfLayout ? '' : ''}`} style={{ width: shelfLayout ? 'min(680px,100%)' : 'min(560px,100%)' }}>
        <div className="ws-drawer-head">
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2>
              {String(
                activeRecord.values?.[titleField?.key || 'name'] || t('crm.workspace.recordDrawer.recordFallback'),
              )}
            </h2>
            {sourceLink && (
              <div className="s">
                {t('crm.workspace.recordDrawer.sourceRow')}
                {' · '}
                {new Date(sourceLink.pushedAt).toLocaleDateString()}
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="tb-icon-btn"
          >
            {t('crm.workspace.recordDrawer.close')}
          </button>
        </div>

        <div style={{ padding: '0 16px', marginTop: -4 }}>
          <AiAssigneeGroup entityType="custom_object_record" entityId={activeRecord.id} compact />
        </div>

        <div
          className="ws-drawer-body"
          style={
            shelfLayout
              ? { display: 'grid', gap: 12, gridTemplateColumns: 'repeat(2, minmax(0,1fr))' }
              : undefined
          }
        >
          {orderedColumns.map((field) => {
            const valueKey = getWorkspaceFieldValueStorageKey(field);
            return (
            <div
              key={field.id}
              className={shelfLayout ? 'ws-field' : 'ws-field'}
              style={shelfLayout ? { border: '1px solid var(--line-2)', borderRadius: 10, padding: 10, background: '#fff' } : undefined}
            >
              <label>
                {field.label}
              </label>
              {field.type === 'ai' ? (
                <div>
                  <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 min-h-[38px] break-words whitespace-pre-line" style={{ display: 'flex', alignItems: 'flex-start', gap: 6 }}>
                    <span aria-hidden style={{ flexShrink: 0, color: '#7c3aed' }}>✦</span>
                    <span>{String(activeRecord.values?.[valueKey] ?? '') || t('crm.workspace.recordDrawer.aiColumnEmpty')}</span>
                  </div>
                  <button
                    type="button"
                    className="tb-icon-btn"
                    style={{ marginTop: 6 }}
                    disabled={aiRefreshingKey === field.key}
                    onClick={() => void refreshAiColumn(field)}
                  >
                    {aiRefreshingKey === field.key
                      ? t('crm.workspace.recordDrawer.aiColumnRefreshing')
                      : t('crm.workspace.recordDrawer.aiColumnRefresh')}
                  </button>
                  {aiRefreshError && aiRefreshingKey === null ? (
                    <div style={{ fontSize: 11, color: '#9a1f31', marginTop: 4 }}>{aiRefreshError}</div>
                  ) : null}
                </div>
              ) : isWorkspaceReadOnlyField(field) ? (
                <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 min-h-[38px] break-words whitespace-pre-line">
                  {String(activeRecord.values?.[valueKey] ?? '') || '—'}
                </div>
              ) : statusField &&
              field.key === statusField.key &&
              (field.type === 'status' || field.type === 'select') ? (
                (() => {
                  const currentStatus =
                    resolveStatusOptionValue(String(activeRecord.values?.[valueKey] || '')) ||
                    statusOptions[0] ||
                    '';
                  const style = getStatusStyle(currentStatus);
                  return (
                    <select
                      value={currentStatus}
                      onChange={(e) => {
                        const nextValues = {
                          ...(activeRecord.values || {}),
                          [valueKey]: e.target.value,
                        };
                        onEditRecord({ ...activeRecord, values: nextValues });
                        void saveRecord(activeRecord, nextValues, field.key);
                      }}
                      style={style}
                      className={`w-full rounded-lg border px-3 py-2 text-sm ${
                        style ? 'bg-transparent' : 'border-slate-300'
                      }`}
                    >
                      {statusOptions.map((opt) => (
                        <option key={opt} value={opt}>
                          {getStatusLabel(opt)}
                        </option>
                      ))}
                    </select>
                  );
                })()
              ) : field.type === 'file' ? (
                (() => {
                  const raw = activeRecord.values?.[valueKey];
                  const fileVal =
                    raw && typeof raw === 'object' && !Array.isArray(raw)
                      ? (raw as WorkspaceFileFieldValue)
                      : null;
                  const has = Boolean(fileVal?.relativePath && fileVal?.name);
                  const inputId = `drawer-file-${activeRecord.id}-${field.key}`;
                  return (
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                      <input
                        id={inputId}
                        type="file"
                        className="hidden"
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.csv,.txt,.rtf,.odt,.ods"
                        onChange={async (e) => {
                          const f = e.target.files?.[0];
                          e.target.value = '';
                          if (!f) return;
                          try {
                            setFileUploadErrorByField((prev) => {
                              const n = { ...prev };
                              delete n[field.key];
                              return n;
                            });
                            const uploaded = await uploadWorkspaceFile(objectId, f);
                            const nextValues = {
                              ...(activeRecord.values || {}),
                              [valueKey]: uploaded,
                            };
                            onEditRecord({ ...activeRecord, values: nextValues });
                            void saveRecord(activeRecord, nextValues, field.key);
                          } catch (err) {
                            console.error(err);
                            setFileUploadErrorByField((prev) => ({
                              ...prev,
                              [field.key]:
                                err instanceof Error
                                  ? err.message
                                  : t('crm.workspace.recordDrawer.uploadFailed'),
                            }));
                          }
                        }}
                      />
                      {has ? (
                        <button
                          type="button"
                          onClick={() =>
                            setFilePreview({
                              fileName: fileVal!.name,
                              relativePath: fileVal!.relativePath,
                              fieldKey: field.key,
                            })
                          }
                          className="max-w-full truncate rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-left text-sm font-medium text-slate-900 hover:bg-slate-100"
                        >
                          {fileVal!.name}
                        </button>
                      ) : (
                        <label
                          htmlFor={inputId}
                          className="cursor-pointer rounded-lg border border-dashed border-slate-300 px-3 py-2 text-sm text-slate-500 hover:bg-slate-50"
                        >
                          {t('crm.workspace.recordDrawer.chooseFile')}
                        </label>
                      )}
                      {has && (
                        <button
                          type="button"
                          className="text-xs text-rose-600 underline"
                          onClick={() => {
                            const nextValues = { ...(activeRecord.values || {}), [valueKey]: null };
                            onEditRecord({ ...activeRecord, values: nextValues });
                            void saveRecord(activeRecord, nextValues, field.key);
                          }}
                        >
                          {t('crm.workspace.recordDrawer.removeFile')}
                        </button>
                      )}
                      </div>
                      <p className="mt-1 text-[11px] text-slate-400">
                        {t('crm.workspace.recordDrawer.maxFileSize', {
                          label: WORKSPACE_UPLOAD_MAX_FILE_LABEL,
                        })}
                      </p>
                      {fileUploadErrorByField[field.key] ? (
                        <p className="mt-1 text-xs text-red-600">{fileUploadErrorByField[field.key]}</p>
                      ) : null}
                    </div>
                  );
                })()
              ) : isWorkspaceEntityRefField(field) ? (
                (() => {
                  const ref = isWorkspaceEntityRefField(field)!;
                  return (
                    <WorkspaceCrmEntityMultiField
                      entity={ref}
                      rawValue={activeRecord.values?.[valueKey]}
                      leads={crmLeadOptions}
                      projects={crmProjectOptions}
                      companies={crmCompanyOptions}
                      variant="drawer"
                      onCommit={(serialized) => {
                        const nextValues = {
                          ...(activeRecord.values || {}),
                          [valueKey]: serialized === '' ? null : serialized,
                        };
                        onEditRecord({ ...activeRecord, values: nextValues });
                        void saveRecord(activeRecord, nextValues, field.key);
                      }}
                    />
                  );
                })()
              ) : field.key.includes('owner') ||
                field.key.includes('assignee') ||
                field.key.includes('person') ||
                field.key.includes('responsible') ? (
                <div className="rounded-lg border border-slate-300 p-2 space-y-2">
                  {staffByDepartment.map((group) => (
                    <div key={group.department}>
                      <div className="text-[10px] uppercase tracking-[0.14em] text-slate-400 mb-1">
                        {group.department}
                      </div>
                      <div className="space-y-1">
                        {group.users.map((user) => {
                          const selected = String(activeRecord.values?.[valueKey] || '')
                            .split(/[,;/]+/)
                            .map((v) => v.trim())
                            .filter(Boolean);
                          const active = selected.includes(user.fullName);
                          return (
                            <label
                              key={user.id}
                              className="flex items-center gap-2 text-sm text-slate-700"
                            >
                              <input
                                type="checkbox"
                                checked={active}
                                onChange={() => {
                                  const nextOwners = active
                                    ? selected.filter((name) => name !== user.fullName)
                                    : [...selected, user.fullName];
                                  const nextValues = {
                                    ...(activeRecord.values || {}),
                                    [valueKey]: nextOwners.join(', '),
                                  };
                                  onEditRecord({ ...activeRecord, values: nextValues });
                                  void saveRecord(activeRecord, nextValues, field.key);
                                }}
                              />
                              <span>{user.fullName}</span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </div>
              ) : isRenderableWorkspaceDateField(field) ? (
                <div className="relative">
                  <span className="absolute left-2 top-2 text-slate-400 pointer-events-none">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      className="h-4 w-4"
                    >
                      <rect x="3" y="5" width="18" height="16" rx="2" />
                      <path d="M16 3v4M8 3v4M3 10h18" />
                    </svg>
                  </span>
                  <input
                    type={String(field.type || '').toLowerCase() === 'date' ? 'date' : 'datetime-local'}
                    lang={i18n.language}
                    value={String(activeRecord.values?.[valueKey] ?? '').slice(
                      0,
                      String(field.type || '').toLowerCase() === 'date' ? 10 : 16,
                    )}
                    onChange={(e) =>
                      onEditRecord(
                        activeRecord
                          ? {
                              ...activeRecord,
                              values: { ...activeRecord.values, [valueKey]: e.target.value },
                            }
                          : activeRecord,
                      )
                    }
                    onBlur={(e) => {
                      const nextValues = {
                        ...(activeRecord.values || {}),
                        [valueKey]: e.target.value,
                      };
                      void saveRecord(activeRecord, nextValues, field.key);
                    }}
                    className="w-full min-w-[132px] rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-8 py-2 text-sm leading-5 focus:bg-white focus:border-slate-300 focus:ring-2 focus:ring-slate-200"
                  />
                </div>
              ) : (
                <input
                  value={String(activeRecord.values?.[valueKey] ?? '')}
                  onChange={(e) =>
                    onEditRecord(
                      activeRecord
                        ? {
                            ...activeRecord,
                            values: { ...activeRecord.values, [valueKey]: e.target.value },
                          }
                        : activeRecord,
                    )
                  }
                  onBlur={(e) => {
                    const nextValues = {
                      ...(activeRecord.values || {}),
                      [valueKey]: e.target.value,
                    };
                    void saveRecord(activeRecord, nextValues, field.key);
                  }}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              )}
            </div>
            );
          })}

          <div style={{ borderTop: '1px solid var(--line-2)', paddingTop: 14, marginTop: 6, gridColumn: shelfLayout ? '1 / -1' : undefined }}>
            <div className="ws-k" style={{ marginBottom: 8 }}>
              {t('crm.workspace.recordDrawer.activity')}
            </div>
            <div style={{ maxHeight: 160, overflow: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <p className="ws-note">
                {t('crm.workspace.common.created')}: {new Date(activeRecord.createdAt).toLocaleString()}
              </p>
              <p className="ws-note">
                {t('crm.workspace.recordDrawer.updatedAtLabel')}:{' '}
                {new Date(activeRecord.updatedAt).toLocaleString()}
              </p>
              {(activityByRecord[activeRecord.id] || []).map((item) => (
                <div key={item.id} className="ws-note" style={{ background: 'var(--bg-muted)', borderRadius: 8, padding: '6px 8px' }}>
                  {item.text} · {new Date(item.createdAt).toLocaleString()}
                </div>
              ))}
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--line-2)', paddingTop: 14, gridColumn: shelfLayout ? '1 / -1' : undefined }}>
            <div className="ws-k" style={{ marginBottom: 8 }}>
              {t('crm.workspace.recordDrawer.comments')}
            </div>
            <div style={{ maxHeight: 320, overflow: 'auto', paddingRight: 4, display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
              {comments
                .filter((c) => !c.parentId)
                .map((c) => {
                  const replies = comments.filter((r) => r.parentId === c.id);
                  const me = currentStaffForComments?.id || commentUser?.id || commentUser?.email || '';
                  const liked = !!me && (c.likedBy || []).includes(me);
                  const renderCommentBody = (comment: WorkspaceComment) => {
                    const mentions = comment.mentions ?? extractMentions(comment.text || '');
                    return (
                      <>
                        <div className="ws-note" style={{ marginBottom: 3 }}>
                          {new Date(comment.createdAt).toLocaleString()} · {comment.author}
                        </div>
                        <div style={{ fontSize: 12.5, whiteSpace: 'pre-wrap', color: 'var(--ink)' }}>
                          {renderMentions(comment.text)}
                        </div>
                        {mentions.length > 0 && (
                          <div style={{ marginTop: 6, display: 'flex', flexWrap: 'wrap', gap: 4, fontSize: 10, color: 'var(--fg-3)' }}>
                            {mentions.map((m) => (
                              <span
                                key={m}
                                style={{ borderRadius: 999, padding: '1px 7px', background: '#fff', border: '1px solid var(--line-2)' }}
                              >
                                @{m}
                              </span>
                            ))}
                          </div>
                        )}
                      </>
                    );
                  };
                  return (
                    <div key={c.id}>
                      <div
                        style={{
                          borderRadius: 10,
                          padding: '8px 10px',
                          border: `1px solid ${isMentioned(c.text) ? '#bae6fd' : 'var(--line-2)'}`,
                          background: isMentioned(c.text) ? '#f0f9ff' : 'var(--bg-muted)',
                        }}
                      >
                        {renderCommentBody(c)}
                        <div style={{ marginTop: 6, display: 'flex', alignItems: 'center', gap: 12, fontSize: 10, color: 'var(--fg-3)' }}>
                          <button
                            type="button"
                            onClick={() => toggleCommentLike(c.id)}
                            style={{ display: 'inline-flex', alignItems: 'center', gap: 3, background: 'none', border: 'none', padding: 0, color: liked ? '#dc2626' : 'var(--fg-3)', cursor: 'pointer' }}
                          >
                            <span aria-hidden>{liked ? '♥' : '♡'}</span>
                            {(c.likedBy || []).length > 0 && (c.likedBy || []).length}
                          </button>
                          <button
                            type="button"
                            onClick={() => setReplyingToId((prev) => (prev === c.id ? null : c.id))}
                            style={{ background: 'none', border: 'none', padding: 0, color: 'var(--fg-3)', cursor: 'pointer' }}
                          >
                            {t('crm.projects.detail.comments.reply')}
                          </button>
                        </div>
                      </div>

                      {replies.length > 0 && (
                        <div style={{ marginTop: 6, marginLeft: 14, paddingLeft: 10, borderLeft: '2px solid var(--line-2)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                          {replies.map((r) => {
                            const rLiked = !!me && (r.likedBy || []).includes(me);
                            return (
                              <div
                                key={r.id}
                                style={{
                                  borderRadius: 10,
                                  padding: '8px 10px',
                                  border: `1px solid ${isMentioned(r.text) ? '#bae6fd' : 'var(--line-2)'}`,
                                  background: isMentioned(r.text) ? '#f0f9ff' : '#fff',
                                }}
                              >
                                {renderCommentBody(r)}
                                <button
                                  type="button"
                                  onClick={() => toggleCommentLike(r.id)}
                                  style={{ marginTop: 6, display: 'inline-flex', alignItems: 'center', gap: 3, background: 'none', border: 'none', padding: 0, fontSize: 10, color: rLiked ? '#dc2626' : 'var(--fg-3)', cursor: 'pointer' }}
                                >
                                  <span aria-hidden>{rLiked ? '♥' : '♡'}</span>
                                  {(r.likedBy || []).length > 0 && (r.likedBy || []).length}
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      {replyingToId === c.id && (
                        <div style={{ marginTop: 6, marginLeft: 14, display: 'flex', gap: 6 }}>
                          <input
                            autoFocus
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') addReply(c.id);
                            }}
                            placeholder={t('crm.projects.detail.comments.replyPlaceholder')}
                            className="ws-input"
                            style={{ flex: 1 }}
                          />
                          <button type="button" onClick={() => addReply(c.id)} className="btn btn-primary btn-sm">
                            {t('crm.projects.detail.actions.add')}
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              {comments.length === 0 && <p className="ws-note">{t('crm.projects.detail.comments.empty')}</p>}
            </div>
            <div style={{ position: 'relative' }}>
              <textarea
                ref={commentInputRef}
                value={newComment}
                onChange={(e) => {
                  const value = e.target.value;
                  setNewComment(value);
                  const caret = e.target.selectionStart ?? value.length;
                  const before = value.slice(0, caret);
                  const match = before.match(/@([\p{L}\p{N}._-]*)$/u);
                  if (match) {
                    const rect = e.target.getBoundingClientRect();
                    setMentionPos({ top: rect.bottom + 4, left: rect.left, width: rect.width });
                    setMentionQuery(match[1]);
                  } else {
                    setMentionQuery(null);
                  }
                }}
                onBlur={() => window.setTimeout(() => setMentionQuery(null), 150)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                    e.preventDefault();
                    addComment();
                  }
                }}
                placeholder={t('crm.projects.detail.comments.newPlaceholder')}
                rows={3}
                className="ws-input"
                style={{ width: '100%', resize: 'vertical', minHeight: 64 }}
              />
              {mentionQuery !== null &&
                mentionQuery.length >= 2 &&
                mentionPos &&
                typeof document !== 'undefined' &&
                createPortal(
                  (() => {
                    const q = mentionQuery.toLowerCase();
                    const matches = staff.filter((u) => u.fullName?.toLowerCase().includes(q)).slice(0, 6);
                    if (!matches.length) return null;
                    return (
                      <div
                        data-workspace-inline-popover
                        className="fixed z-[100000] rounded-xl bg-white shadow-2xl border border-slate-200 p-1"
                        style={{
                          top: mentionPos.top,
                          left: mentionPos.left,
                          width: Math.max(240, mentionPos.width),
                          maxHeight: 224,
                          overflowY: 'auto',
                        }}
                      >
                        {matches.map((u) => (
                          <button
                            key={u.id}
                            type="button"
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={() => {
                              const el = commentInputRef.current;
                              const caret = el?.selectionStart ?? newComment.length;
                              const before = newComment.slice(0, caret);
                              const after = newComment.slice(caret);
                              const replaced = before.replace(/@([\p{L}\p{N}._-]*)$/u, `@${u.fullName} `);
                              const next = replaced + after;
                              setNewComment(next);
                              setMentionQuery(null);
                              requestAnimationFrame(() => {
                                el?.focus();
                                const pos = replaced.length;
                                el?.setSelectionRange(pos, pos);
                              });
                            }}
                            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-slate-50"
                          >
                            <span style={{ fontWeight: 500, fontSize: 12, color: 'var(--ink)' }}>{u.fullName}</span>
                            <span style={{ fontSize: 10, color: 'var(--fg-4)' }}>{u.email}</span>
                          </button>
                        ))}
                      </div>
                    );
                  })(),
                  document.body,
                )}
              <button type="button" onClick={addComment} className="btn btn-primary btn-sm" style={{ marginTop: 8 }}>
                {t('crm.workspace.recordDrawer.send')}
              </button>
            </div>
          </div>
        </div>

        <div className="ws-drawer-foot">
          <span className="cnt">
            {savingRecordId === activeRecord.id
              ? t('crm.workspace.recordDrawer.savingChanges')
              : t('crm.workspace.recordDrawer.allSynced')}
          </span>
          <span className="sp" />
          {showAddFieldButton && onAddField && (
            <button
              type="button"
              onClick={onAddField}
              className="tb-icon-btn"
            >
              {t('crm.workspace.recordDrawer.addField')}
            </button>
          )}
        </div>
      </div>
      {filePreview && (
        <WorkspaceFileViewerModal
          open
          fileName={filePreview.fileName}
          relativePath={filePreview.relativePath}
          onClose={() => setFilePreview(null)}
          onRemove={() => {
            const fk = filePreview.fieldKey;
            const nextValues = { ...(activeRecord.values || {}), [fk]: null };
            onEditRecord({ ...activeRecord, values: nextValues });
            void saveRecord(activeRecord, nextValues, fk);
            setFilePreview(null);
          }}
        />
      )}
    </div>
  );
};
