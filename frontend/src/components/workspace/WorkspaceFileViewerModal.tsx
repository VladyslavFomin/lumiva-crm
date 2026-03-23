import React from 'react';
import { useTranslation } from 'react-i18next';
import { workspaceFileDownloadHref } from '../../api/customObjects';

export type WorkspaceFileViewerModalProps = {
  open: boolean;
  fileName: string;
  relativePath: string;
  onClose: () => void;
  onRemove: () => void;
};

export const WorkspaceFileViewerModal: React.FC<WorkspaceFileViewerModalProps> = ({
  open,
  fileName,
  relativePath,
  onClose,
  onRemove,
}) => {
  const { t } = useTranslation();
  if (!open) return null;

  const href = workspaceFileDownloadHref(relativePath);
  const ext = (fileName.split('.').pop() || '').toLowerCase();
  const isPdf = ext === 'pdf';
  const isOffice = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx'].includes(ext);
  const officeEmbed = isOffice
    ? `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(href)}`
    : null;

  /* Не использовать bg-slate-900/bg-slate-800 здесь: в index.css они принудительно белые (legacy light theme). */
  const toolbarBtn =
    'inline-flex items-center justify-center rounded-xl px-3 py-2 text-xs font-semibold transition-colors';

  return (
    <div className="fixed inset-0 z-[120] flex flex-col bg-[#0f172a]/90 backdrop-blur-sm">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 bg-lumiva-bg px-4 py-3 shadow-[0_8px_24px_rgba(15,23,42,0.06)]">
        <span
          className="min-w-0 truncate text-sm font-semibold text-lumiva-accent"
          title={fileName}
        >
          {fileName}
        </span>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <a
            href={href}
            download={fileName}
            className={`${toolbarBtn} border border-lumiva-accent bg-lumiva-accent text-white shadow-[0_8px_20px_rgba(34,34,34,0.12)] hover:opacity-90 no-underline`}
          >
            {t('crm.workspace.fileViewer.download')}
          </a>
          <button
            type="button"
            onClick={() => {
              onRemove();
              onClose();
            }}
            className={`${toolbarBtn} border border-red-200 bg-red-50 text-red-700 hover:bg-red-100`}
          >
            {t('crm.workspace.fileViewer.remove')}
          </button>
          <button
            type="button"
            onClick={onClose}
            className={`${toolbarBtn} border border-slate-200 bg-white text-lumiva-accent hover:bg-slate-100`}
          >
            {t('crm.workspace.fileViewer.close')}
          </button>
        </div>
      </div>
      <div className="min-h-0 flex-1 bg-white">
        {isPdf ? (
          <iframe title={fileName} src={href} className="h-full w-full border-0" />
        ) : officeEmbed ? (
          <iframe title={fileName} src={officeEmbed} className="h-full w-full border-0" />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-4 px-6 text-center text-slate-600">
            <p className="text-sm">{t('crm.workspace.fileViewer.previewUnavailable')}</p>
            <a
              href={href}
              download={fileName}
              className="rounded-xl bg-lumiva-accent px-4 py-2 text-sm font-semibold text-white hover:bg-lumiva-accent-soft"
            >
              {t('crm.workspace.fileViewer.downloadToOpen')}
            </a>
          </div>
        )}
      </div>
    </div>
  );
};
