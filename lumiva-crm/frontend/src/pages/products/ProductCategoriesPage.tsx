// src/pages/products/ProductCategoriesPage.tsx
import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { ProductsSubnav } from './ProductsSubnav';
import {
  fetchProductCategoriesTree,
  createProductCategory,
  updateProductCategory,
  deleteProductCategory,
  type ProductCategoryWithCount,
} from '../../api/products';
import './products-design.css';

const CAT_COLORS = ['#222222', '#3b6cb6', '#1f8a5e', '#c08319', '#5a45a8', '#cc2f47', '#888888', '#214b8a'];

const I = {
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.5-4.5" />
    </>
  ),
  plus: (
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>
  ),
  chev: <path d="M6 9l6 6 6-6" />,
  drag: (
    <>
      <circle cx="9" cy="6" r="1" fill="currentColor" />
      <circle cx="9" cy="12" r="1" fill="currentColor" />
      <circle cx="9" cy="18" r="1" fill="currentColor" />
      <circle cx="15" cy="6" r="1" fill="currentColor" />
      <circle cx="15" cy="12" r="1" fill="currentColor" />
      <circle cx="15" cy="18" r="1" fill="currentColor" />
    </>
  ),
  edit: (
    <>
      <path d="M4 20h4l10-10-4-4L4 16z" />
      <path d="M14 6l4 4" />
    </>
  ),
  copy: (
    <>
      <rect x="8" y="8" width="12" height="12" rx="1.5" />
      <path d="M16 8V5a1 1 0 00-1-1H5a1 1 0 00-1 1v10a1 1 0 001 1h3" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16" />
      <path d="M9 7V4h6v3" />
      <path d="M6 7l1 13a1 1 0 001 1h8a1 1 0 001-1l1-13" />
    </>
  ),
};

const Icon: React.FC<{ d: React.ReactNode; size?: number }> = ({ d, size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
    {d}
  </svg>
);

type CategoryModalState = { mode: 'create' } | { mode: 'edit'; category: ProductCategoryWithCount } | null;

const CategoryModal: React.FC<{
  state: CategoryModalState;
  categories: ProductCategoryWithCount[];
  onClose: () => void;
  onSaved: () => void;
}> = ({ state, categories, onClose, onSaved }) => {
  const { t } = useTranslation();
  const { showAlert } = useAlertModal();
  const editing = state?.mode === 'edit' ? state.category : null;
  const [name, setName] = useState(editing?.name || '');
  const [slug, setSlug] = useState(editing?.slug || '');
  const [parentId, setParentId] = useState(editing?.parentId || '');
  const [color, setColor] = useState(editing?.color || CAT_COLORS[1]);
  const [saving, setSaving] = useState(false);

  if (!state) return null;

  const parentOptions = categories.filter((c) => c.id !== editing?.id);

  const handleSave = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      if (editing) {
        await updateProductCategory(editing.id, {
          name: name.trim(),
          slug: slug || undefined,
          parentId: parentId || null,
          color,
        });
      } else {
        await createProductCategory({ name: name.trim(), slug: slug || undefined, parentId: parentId || null, color });
      }
      onSaved();
      onClose();
    } catch (err: any) {
      showAlert(err.message || t('crm.products.attributes.errors.saveFailed'), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="pr-cat-modal-back" onClick={onClose}>
      <div className="pr-cat-modal" onClick={(e) => e.stopPropagation()}>
        <h3>{editing ? t('crm.products.categories.editTitle') : t('crm.products.categories.newTitle')}</h3>
        <div className="ai-field">
          <label className="ai-label">{t('crm.products.categories.nameLabel')}</label>
          <input
            className="ai-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t('crm.products.categories.namePlaceholder') || ''}
            autoFocus
          />
        </div>
        <div className="ai-field">
          <label className="ai-label">{t('crm.products.categories.slugLabel')}</label>
          <input className="ai-input" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="category-slug" />
        </div>
        <div className="ai-field">
          <label className="ai-label">{t('crm.products.categories.parentLabel')}</label>
          <select className="ai-select" value={parentId} onChange={(e) => setParentId(e.target.value)}>
            <option value="">{t('crm.products.categories.rootOption')}</option>
            {parentOptions.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
        </div>
        <div className="ai-field" style={{ marginBottom: 0 }}>
          <label className="ai-label">{t('crm.products.categories.colorLabel')}</label>
          <div className="pr-cat-swatches">
            {CAT_COLORS.map((c) => (
              <div
                key={c}
                className={`pr-cat-sw${color === c ? ' on' : ''}`}
                style={{ background: c }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
        </div>
        <div className="pr-cat-modal-foot">
          <button type="button" className="aib ghost" onClick={onClose}>
            {t('crm.products.fieldTypes.modal.cancel')}
          </button>
          <button type="button" className="aib" onClick={handleSave} disabled={saving || !name.trim()}>
            {editing ? t('crm.products.form.actions.save') : t('crm.products.form.actions.create')}
          </button>
        </div>
      </div>
    </div>
  );
};

export const ProductCategoriesPage: React.FC = () => {
  const { t } = useTranslation();
  const { showAlert, showConfirm } = useAlertModal();

  const [categories, setCategories] = useState<ProductCategoryWithCount[]>([]);
  const [uncategorizedCount, setUncategorizedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState<CategoryModalState>(null);

  const load = () => {
    setLoading(true);
    fetchProductCategoriesTree()
      .then((res) => {
        setCategories(res.categories);
        setUncategorizedCount(res.uncategorizedCount);
      })
      .catch((e) => showAlert(e.message || t('crm.products.attributes.errors.loadFailed'), { variant: 'error' }))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const tree = useMemo(() => {
    const byParent = new Map<string | null, ProductCategoryWithCount[]>();
    for (const c of categories) {
      const key = c.parentId || null;
      const arr = byParent.get(key) || [];
      arr.push(c);
      byParent.set(key, arr);
    }
    const roots = byParent.get(null) || [];
    const matches = (c: ProductCategoryWithCount) =>
      !search || c.name.toLowerCase().includes(search.toLowerCase()) || c.slug.toLowerCase().includes(search.toLowerCase());
    return roots
      .map((root) => ({ root, children: (byParent.get(root.id) || []) }))
      .filter(({ root, children }) => !search || matches(root) || children.some(matches));
  }, [categories, search]);

  const withSubCount = categories.filter((c) => categories.some((x) => x.parentId === c.id)).length;
  const totalProducts = categories.reduce((s, c) => s + c.productCount, 0);
  const depth = categories.some((c) => c.parentId) ? 2 : categories.length ? 1 : 0;

  const handleDelete = async (id: string) => {
    const ok = await showConfirm(t('crm.products.categories.deleteConfirm'), {
      title: t('crm.confirmModal.deleteTitle', { defaultValue: 'Удаление' }),
      confirmLabel: t('crm.confirmModal.deleteLabel', { defaultValue: 'Удалить' }),
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteProductCategory(id);
      load();
    } catch (err: any) {
      showAlert(err.message || t('crm.products.attributes.errors.saveFailed'), { variant: 'error' });
    }
  };

  const row = (c: ProductCategoryWithCount, isSub: boolean, parentSlug?: string) => (
    <tr key={c.id} className={`row${isSub ? ' sub' : ''}`} onClick={() => setModal({ mode: 'edit', category: c })}>
      <td onClick={(e) => e.stopPropagation()}>
        <span className="px-drag-handle"><Icon d={I.drag} size={13} /></span>
      </td>
      <td>
        <div className="px-cat-name">
          <span className="px-cat-sw" style={{ background: c.color, opacity: isSub ? 0.7 : 1 }} />
          <span className="n">{c.name}</span>
        </div>
      </td>
      <td><span className="px-slug">/{parentSlug ? `${parentSlug}/${c.slug}` : c.slug}</span></td>
      <td className="r">{c.productCount}</td>
      <td className="c"><span className="pr-badge active">{t('crm.products.categories.statusActive')}</span></td>
      <td onClick={(e) => e.stopPropagation()}>
        <div className="px-row-actions">
          <button type="button" title={t('crm.products.categories.editButton') || ''} onClick={() => setModal({ mode: 'edit', category: c })}>
            <Icon d={I.edit} size={13} />
          </button>
          <button type="button" title={t('crm.products.categories.duplicateButton') || ''}>
            <Icon d={I.copy} size={13} />
          </button>
          <button type="button" className="danger" title={t('crm.products.form.actions.delete') || ''} onClick={() => handleDelete(c.id)}>
            <Icon d={I.trash} size={13} />
          </button>
        </div>
      </td>
    </tr>
  );

  return (
    <MainLayout>
      <div className="px-scope">
        <div className="px-head">
          <div>
            <div className="kicker"><span className="dot" />{t('crm.products.list.title')}</div>
            <h1>{t('crm.products.categories.title')}</h1>
            <p className="sub">{t('crm.products.categories.subtitle')}</p>
          </div>
          <div className="px-head-actions">
            <button type="button" className="aib" onClick={() => setModal({ mode: 'create' })}>
              <Icon d={I.plus} size={15} />
              {t('crm.products.categories.addButton')}
            </button>
          </div>
        </div>

        <ProductsSubnav active="categories" />

        <div className="px-kpis">
          <div className="px-kpi">
            <div className="l">{t('crm.products.categories.kpis.total')}</div>
            <div className="v">{categories.length}</div>
            <div className="d">{t('crm.products.categories.kpis.totalHint', { count: withSubCount })}</div>
          </div>
          <div className="px-kpi">
            <div className="l">{t('crm.products.categories.kpis.products')}</div>
            <div className="v">{totalProducts}</div>
            <div className="d">{t('crm.products.categories.kpis.productsHint')}</div>
          </div>
          <div className="px-kpi">
            <div className="l">{t('crm.products.categories.kpis.uncategorized')}</div>
            <div className="v">{uncategorizedCount}</div>
            <div className="d warn">{t('crm.products.categories.kpis.uncategorizedHint')}</div>
          </div>
          <div className="px-kpi">
            <div className="l">{t('crm.products.categories.kpis.depth')}</div>
            <div className="v">{depth}</div>
            <div className="d">{t('crm.products.categories.kpis.depthHint')}</div>
          </div>
        </div>

        <div className="px-toolbar">
          <div className="tb-search" style={{ width: 240 }}>
            <Icon d={I.search} size={13} />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('crm.products.list.searchPlaceholder') || ''} />
          </div>
        </div>

        {loading ? (
          <div className="py-16 text-center text-[13px]" style={{ color: 'var(--fg-4)' }}>{t('crm.common.loading')}</div>
        ) : !tree.length ? (
          <div className="py-16 text-center text-[13px]" style={{ color: 'var(--fg-4)' }}>{t('crm.products.categories.empty')}</div>
        ) : (
          <div className="px-table-wrap">
            <table className="px-table">
              <thead>
                <tr>
                  <th style={{ width: 30 }} />
                  <th>{t('crm.products.categories.columns.category')}</th>
                  <th>{t('crm.products.categories.columns.slug')}</th>
                  <th className="r">{t('crm.products.categories.columns.products')}</th>
                  <th className="c">{t('crm.products.categories.columns.status')}</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {tree.map(({ root, children }) => (
                  <React.Fragment key={root.id}>
                    {row(root, false)}
                    {children.map((child) => row(child, true, root.slug))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <CategoryModal state={modal} categories={categories} onClose={() => setModal(null)} onSaved={load} />
      </div>
    </MainLayout>
  );
};
