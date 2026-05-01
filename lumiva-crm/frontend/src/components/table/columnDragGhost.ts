/**
 * Единое превью перетаскиваемой колонки (ghost для setDragImage):
 * белая карточка, бирюзовая обводка, заголовок + строка с ◇, блок-имитация строк, подвал.
 * Используется во всех таблицах с reorder колонок и в WorkspaceTableViewPage.
 */
export function createColumnDragGhostElement(label: string): HTMLDivElement {
  const ghost = document.createElement('div');
  ghost.setAttribute('data-column-drag-ghost', '1');
  ghost.style.cssText = [
    'position:fixed',
    'left:-9999px',
    'top:0',
    'box-sizing:border-box',
    'padding:12px 14px',
    'min-width:176px',
    'max-width:280px',
    'background:#ffffff',
    'border:2px solid #007f8c',
    'border-radius:10px',
    'box-shadow:0 12px 32px rgba(15,23,42,0.18)',
    'z-index:100000',
    'pointer-events:none',
    'font-family:Poppins,system-ui,-apple-system,sans-serif',
  ].join(';');

  const titleEl = document.createElement('div');
  titleEl.textContent = label;
  titleEl.style.cssText =
    'font-weight:600;font-size:13px;line-height:1.25;color:#0f172a;margin:0 0 4px 0;';

  const subRow = document.createElement('div');
  subRow.style.cssText =
    'display:flex;align-items:center;gap:5px;font-size:11px;line-height:1.2;color:#94a3b8;margin-bottom:10px;';
  const diamond = document.createElement('span');
  diamond.textContent = '◇';
  diamond.style.cssText = 'color:#0d9488;font-size:12px;line-height:1;flex-shrink:0;';
  const subLabel = document.createElement('span');
  subLabel.textContent = label;
  subLabel.style.cssText = 'opacity:0.85;font-weight:500;';
  subRow.appendChild(diamond);
  subRow.appendChild(subLabel);

  const previewShell = document.createElement('div');
  previewShell.style.cssText =
    'border-radius:8px;background:linear-gradient(180deg,#f1f5f9 0%,#e8eef4 100%);padding:8px;border:1px solid #e2e8f0;';

  const stripes = document.createElement('div');
  stripes.style.cssText =
    'height:40px;border-radius:6px;background:repeating-linear-gradient(#f8fafc 0 8px,#e2e8f0 8px 16px);margin-bottom:0;';

  const foot = document.createElement('div');
  foot.style.cssText =
    'display:flex;justify-content:space-between;align-items:center;margin-top:8px;padding-top:6px;border-top:1px solid #e2e8f0;';
  const hint = document.createElement('span');
  hint.textContent = '…';
  hint.style.cssText = 'font-size:10px;font-weight:500;color:#cbd5e1;letter-spacing:0.02em;';
  const iconWrap = document.createElement('span');
  iconWrap.textContent = '📄';
  iconWrap.style.cssText = 'display:flex;font-size:12px;line-height:1;opacity:0.55;flex-shrink:0;';
  iconWrap.setAttribute('aria-hidden', 'true');
  foot.appendChild(hint);
  foot.appendChild(iconWrap);

  previewShell.appendChild(stripes);
  previewShell.appendChild(foot);

  ghost.appendChild(titleEl);
  ghost.appendChild(subRow);
  ghost.appendChild(previewShell);

  return ghost;
}
