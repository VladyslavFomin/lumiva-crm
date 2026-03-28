import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  uploadWorkspaceFile,
  WORKSPACE_UPLOAD_MAX_FILE_LABEL,
  type CustomObjectField,
  type CustomObjectRecord,
  type WorkspaceFileFieldValue,
} from '../../api/customObjects';
import type { StaffUser } from '../../api/staff';
import { collectStatusValuesFromRecords } from './workspaceStatusField';
import { normalizeOptionToken } from '../../workspace/normalizeOptionToken';
import { WorkspaceFileViewerModal } from './WorkspaceFileViewerModal';

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

function isRenderableDateField(field: CustomObjectField): boolean {
  const type = String(field.type || '').toLowerCase();
  if (type !== 'date' && type !== 'datetime') return false;
  const key = String(field.key || '').toLowerCase();
  const label = String(field.label || '').toLowerCase();
  const isIdLike =
    key.endsWith('id') ||
    key.includes('_id') ||
    key.includes('id_') ||
    label.endsWith(' id');
  if (isIdLike) return false;
  return true;
}

export type WorkspaceRecordDetailDrawerProps = {
  record: CustomObjectRecord | null;
  onClose: () => void;
  onEditRecord: (next: CustomObjectRecord) => void;
  orderedColumns: CustomObjectField[];
  titleField: CustomObjectField | undefined;
  statusField: CustomObjectField | undefined;
  staffByDepartment: Array<{ department: string; users: StaffUser[] }>;
  commentsByRecord: Record<
    string,
    Array<{ id: string; text: string; createdAt: string; author: string }>
  >;
  setCommentsByRecord: React.Dispatch<
    React.SetStateAction<
      Record<string, Array<{ id: string; text: string; createdAt: string; author: string }>>
    >
  >;
  activityByRecord: Record<string, Array<{ id: string; text: string; createdAt: string }>>;
  pushActivity: (recordId: string, text: string) => void;
  commentDraft: string;
  setCommentDraft: React.Dispatch<React.SetStateAction<string>>;
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
};

export const WorkspaceRecordDetailDrawer: React.FC<WorkspaceRecordDetailDrawerProps> = ({
  record: activeRecord,
  onClose,
  onEditRecord,
  orderedColumns,
  titleField,
  statusField,
  staffByDepartment,
  commentsByRecord,
  setCommentsByRecord,
  activityByRecord,
  pushActivity,
  commentDraft,
  setCommentDraft,
  saveRecord,
  savingRecordId,
  showAddFieldButton,
  onAddField,
  overlayZIndex = 40,
  recordsForStatusOptions,
  objectId,
}) => {
  const { t, i18n } = useTranslation();
  const [filePreview, setFilePreview] = useState<{
    fileName: string;
    relativePath: string;
    fieldKey: string;
  } | null>(null);
  const [fileUploadErrorByField, setFileUploadErrorByField] = useState<Record<string, string>>({});

  useEffect(() => {
    setFileUploadErrorByField({});
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

  return (
    <div className="fixed inset-0" style={{ zIndex: overlayZIndex }}>
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="absolute right-0 top-0 h-full w-full max-w-xl bg-white border-l border-slate-200 shadow-2xl p-4 overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-slate-900">
            {String(
              activeRecord.values?.[titleField?.key || 'name'] || t('crm.workspace.recordDrawer.recordFallback'),
            )}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-300 px-2 py-1 text-xs"
          >
            {t('crm.workspace.recordDrawer.close')}
          </button>
        </div>

        <div className="space-y-3">
          {orderedColumns.map((field) => (
            <div key={field.id}>
              <label className="block text-xs text-slate-500 mb-1">{field.label}</label>
              {statusField &&
              field.key === statusField.key &&
              (field.type === 'status' || field.type === 'select') ? (
                (() => {
                  const currentStatus =
                    resolveStatusOptionValue(String(activeRecord.values?.[field.key] || '')) ||
                    statusOptions[0] ||
                    '';
                  const style = getStatusStyle(currentStatus);
                  return (
                    <select
                      value={currentStatus}
                      onChange={(e) => {
                        const nextValues = {
                          ...(activeRecord.values || {}),
                          [field.key]: e.target.value,
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
                  const raw = activeRecord.values?.[field.key];
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
                              [field.key]: uploaded,
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
                            const nextValues = { ...(activeRecord.values || {}), [field.key]: null };
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
                          const selected = String(activeRecord.values?.[field.key] || '')
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
                                    [field.key]: nextOwners.join(', '),
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
              ) : isRenderableDateField(field) ? (
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
                    value={String(activeRecord.values?.[field.key] ?? '').slice(
                      0,
                      String(field.type || '').toLowerCase() === 'date' ? 10 : 16,
                    )}
                    onChange={(e) =>
                      onEditRecord(
                        activeRecord
                          ? {
                              ...activeRecord,
                              values: { ...activeRecord.values, [field.key]: e.target.value },
                            }
                          : activeRecord,
                      )
                    }
                    onBlur={(e) => {
                      const nextValues = {
                        ...(activeRecord.values || {}),
                        [field.key]: e.target.value,
                      };
                      void saveRecord(activeRecord, nextValues, field.key);
                    }}
                    className="w-full min-w-[132px] rounded-xl border border-slate-200 bg-slate-50 pl-8 pr-8 py-2 text-sm leading-5 focus:bg-white focus:border-slate-300 focus:ring-2 focus:ring-slate-200"
                  />
                </div>
              ) : (
                <input
                  value={String(activeRecord.values?.[field.key] ?? '')}
                  onChange={(e) =>
                    onEditRecord(
                      activeRecord
                        ? {
                            ...activeRecord,
                            values: { ...activeRecord.values, [field.key]: e.target.value },
                          }
                        : activeRecord,
                    )
                  }
                  onBlur={(e) => {
                    const nextValues = {
                      ...(activeRecord.values || {}),
                      [field.key]: e.target.value,
                    };
                    void saveRecord(activeRecord, nextValues, field.key);
                  }}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                />
              )}
            </div>
          ))}
        </div>

        <div className="mt-6 pt-4 border-t border-slate-200">
          <div className="text-sm font-semibold text-slate-900 mb-2">
            {t('crm.workspace.recordDrawer.activity')}
          </div>
          <div className="space-y-2 max-h-40 overflow-auto">
            <div className="text-xs text-slate-500">
              {t('crm.workspace.common.created')}: {new Date(activeRecord.createdAt).toLocaleString()}
            </div>
            <div className="text-xs text-slate-500">
              {t('crm.workspace.recordDrawer.updatedAtLabel')}:{' '}
              {new Date(activeRecord.updatedAt).toLocaleString()}
            </div>
            {(activityByRecord[activeRecord.id] || []).map((item) => (
              <div key={item.id} className="text-xs text-slate-600 rounded-lg bg-slate-50 px-2 py-1">
                {item.text} · {new Date(item.createdAt).toLocaleString()}
              </div>
            ))}
          </div>
        </div>

        <div className="mt-4 pt-4 border-t border-slate-200">
          <div className="text-sm font-semibold text-slate-900 mb-2">
            {t('crm.workspace.recordDrawer.comments')}
          </div>
          <div className="space-y-2 max-h-40 overflow-auto mb-2">
            {(commentsByRecord[activeRecord.id] || []).map((comment) => (
              <div key={comment.id} className="rounded-lg border border-slate-200 bg-white px-2 py-1.5">
                <div className="text-[11px] text-slate-500">
                  {comment.author} · {new Date(comment.createdAt).toLocaleString()}
                </div>
                <div className="text-xs text-slate-700 mt-0.5">{comment.text}</div>
              </div>
            ))}
            {(commentsByRecord[activeRecord.id] || []).length === 0 && (
              <div className="text-xs text-slate-400">{t('crm.workspace.recordDrawer.noCommentsYet')}</div>
            )}
          </div>
          <div className="flex gap-2">
            <input
              value={commentDraft}
              onChange={(e) => setCommentDraft(e.target.value)}
              placeholder={t('crm.workspace.recordDrawer.commentPlaceholder')}
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => {
                if (!commentDraft.trim()) return;
                setCommentsByRecord((prev) => {
                  const list = prev[activeRecord.id] || [];
                  return {
                    ...prev,
                    [activeRecord.id]: [
                      {
                        id: crypto.randomUUID(),
                        text: commentDraft.trim(),
                        createdAt: new Date().toISOString(),
                        author: t('crm.workspace.recordDrawer.authorYou'),
                      },
                      ...list,
                    ],
                  };
                });
                pushActivity(activeRecord.id, t('crm.workspace.recordDrawer.addedComment'));
                setCommentDraft('');
              }}
              className="px-3 py-2 rounded-lg bg-slate-900 text-white text-sm"
            >
              {t('crm.workspace.recordDrawer.send')}
            </button>
          </div>
        </div>

        <div className="mt-5 pt-4 border-t border-slate-200 flex items-center justify-between">
          <div className="text-xs text-slate-500">
            {savingRecordId === activeRecord.id
              ? t('crm.workspace.recordDrawer.savingChanges')
              : t('crm.workspace.recordDrawer.allSynced')}
          </div>
          {showAddFieldButton && onAddField && (
            <button
              type="button"
              onClick={onAddField}
              className="px-3 py-2 rounded-lg border border-slate-300 text-sm"
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
