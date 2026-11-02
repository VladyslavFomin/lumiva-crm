import React, { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import { useAlertModal } from '../../contexts/AlertModalContext';
import { BookingsSubnav } from './BookingsSubnav';
import { Ic, BK_ICON } from './BookingIcons';
import { fetchBookingProject } from '../../api/bookings';
import {
  fetchMenu,
  createMenuCategory,
  updateMenuCategory,
  deleteMenuCategory,
  reorderMenuCategories,
  createMenuItem,
  updateMenuItem,
  deleteMenuItem,
  setMenuItemAvailability,
  type MenuCategory,
  type MenuItem,
} from '../../api/bookingVerticals';
import { BkModal, EmptyState, MiniKpi, errMsg, fmtMoney, useDateLocale } from './verticalUi';
import './bookings-design.css';
import './bookings-verticals.css';

const TAGS = ['hit', 'new', 'spicy', 'vegan', 'vegetarian', 'gluten_free', 'kids', 'alcohol'];

const emptyItem = (categoryId: string | null, currency: string): Partial<MenuItem> => ({
  name: '',
  description: '',
  price: '',
  currency,
  portion: '',
  tags: [],
  imageUrl: '',
  prepMinutes: null,
  available: true,
  active: true,
  categoryId,
});

export const RestaurantMenuPage: React.FC = () => {
  const { t } = useTranslation();
  const { showAlert, showConfirm, showPrompt } = useAlertModal();
  const locale = useDateLocale();
  const [categories, setCategories] = useState<MenuCategory[]>([]);
  const [items, setItems] = useState<MenuItem[]>([]);
  const [currency, setCurrency] = useState('RUB');
  const [cat, setCat] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [onlyStop, setOnlyStop] = useState(false);
  const [edit, setEdit] = useState<Partial<MenuItem> | null>(null);
  const [saving, setSaving] = useState(false);

  const load = () =>
    fetchMenu()
      .then((m) => {
        setCategories(m.categories);
        setItems(m.items);
      })
      .catch((e) => showAlert(errMsg(e, t('crm.bookings.v.common.loadError')), { variant: 'error' }));

  useEffect(() => {
    load();
    fetchBookingProject().then((p) => setCurrency(p.currency)).catch(() => undefined);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter(
      (i) =>
        (cat === 'all' || (cat === 'none' ? !i.categoryId : i.categoryId === cat)) &&
        (!onlyStop || !i.available) &&
        (!q || i.name.toLowerCase().includes(q) || (i.description || '').toLowerCase().includes(q)),
    );
  }, [items, cat, search, onlyStop]);

  const addCategory = async () => {
    const name = await showPrompt({ title: t('crm.bookings.v.menu.addCategory'), label: t('crm.bookings.v.menu.categoryName'), placeholder: t('crm.bookings.v.menu.categoryPh') });
    if (!name?.trim()) return;
    try {
      const c = await createMenuCategory({ name: name.trim() });
      await load();
      setCat(c.id);
    } catch (e) {
      showAlert(errMsg(e, t('crm.bookings.v.common.saveError')), { variant: 'error' });
    }
  };

  const renameCategory = async (c: MenuCategory) => {
    const name = await showPrompt({ title: t('crm.bookings.v.menu.renameCategory'), label: t('crm.bookings.v.menu.categoryName'), defaultValue: c.name });
    if (!name?.trim() || name.trim() === c.name) return;
    await updateMenuCategory(c.id, { name: name.trim() }).then(load).catch((e) => showAlert(errMsg(e, t('crm.bookings.v.common.saveError')), { variant: 'error' }));
  };

  const removeCategory = async (c: MenuCategory) => {
    if (!(await showConfirm(t('crm.bookings.v.menu.deleteCategoryConfirm', { name: c.name }), { danger: true }))) return;
    await deleteMenuCategory(c.id).then(() => { setCat('all'); return load(); }).catch((e) => showAlert(errMsg(e, t('crm.bookings.v.common.saveError')), { variant: 'error' }));
  };

  const moveCategory = async (idx: number, dir: -1 | 1) => {
    const ids = categories.map((c) => c.id);
    const j = idx + dir;
    if (j < 0 || j >= ids.length) return;
    [ids[idx], ids[j]] = [ids[j], ids[idx]];
    const m = await reorderMenuCategories(ids).catch(() => null);
    if (m) setCategories(m.categories);
  };

  const saveItem = async () => {
    if (!edit) return;
    if (!edit.name?.trim()) {
      showAlert(t('crm.bookings.v.menu.nameRequired'), { variant: 'error' });
      return;
    }
    setSaving(true);
    const dto: Partial<MenuItem> = {
      ...edit,
      name: edit.name.trim(),
      price: String(Number(edit.price) || 0),
      prepMinutes: edit.prepMinutes === null || (edit.prepMinutes as any) === '' ? null : Number(edit.prepMinutes),
      imageUrl: edit.imageUrl?.trim() || null,
      portion: edit.portion?.trim() || null,
      description: edit.description?.trim() || null,
    };
    try {
      if (edit.id) await updateMenuItem(edit.id, dto);
      else await createMenuItem(dto);
      setEdit(null);
      await load();
    } catch (e) {
      showAlert(errMsg(e, t('crm.bookings.v.common.saveError')), { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const toggleStop = async (i: MenuItem) => {
    setItems((all) => all.map((x) => (x.id === i.id ? { ...x, available: !i.available } : x)));
    try {
      await setMenuItemAvailability(i.id, !i.available);
    } catch (e) {
      setItems((all) => all.map((x) => (x.id === i.id ? { ...x, available: i.available } : x)));
      showAlert(errMsg(e, t('crm.bookings.v.common.saveError')), { variant: 'error' });
    }
  };

  const removeItem = async (i: MenuItem) => {
    if (!(await showConfirm(t('crm.bookings.v.menu.deleteItemConfirm', { name: i.name }), { danger: true }))) return;
    await deleteMenuItem(i.id).then(load).catch((e) => showAlert(errMsg(e, t('crm.bookings.v.common.saveError')), { variant: 'error' }));
  };

  const stopCount = items.filter((i) => !i.available && i.active).length;
  const countIn = (id: string | null) => items.filter((i) => (id ? i.categoryId === id : !i.categoryId)).length;

  return (
    <MainLayout>
      <div className="px-scope">
        <BookingsSubnav active="menu" />
        <div className="bk-hero">
          <div>
            <div className="kicker"><span className="dot" />{t('crm.bookings.v.menu.kicker')}</div>
            <h1>{t('crm.bookings.v.menu.title')}</h1>
            <p className="sub">{t('crm.bookings.v.menu.subtitle')}</p>
          </div>
          <div className="bk-hero-r">
            <button className="btn btn-sm" onClick={addCategory}><Ic d={BK_ICON.plus} size={13} /> {t('crm.bookings.v.menu.addCategory')}</button>
            <button className="btn btn-primary btn-sm" onClick={() => setEdit(emptyItem(cat !== 'all' && cat !== 'none' ? cat : categories[0]?.id || null, currency))}>
              <Ic d={BK_ICON.plus} size={13} /> {t('crm.bookings.v.menu.addItem')}
            </button>
          </div>
        </div>

        <div className="bk-mini-kpis">
          <MiniKpi label={t('crm.bookings.v.menu.kpiItems')} value={items.filter((i) => i.active).length} />
          <MiniKpi label={t('crm.bookings.v.menu.kpiCategories')} value={categories.length} />
          <MiniKpi label={t('crm.bookings.v.menu.kpiStop')} value={stopCount} tone={stopCount ? 'warn' : undefined} />
        </div>

        <div className="mn-layout">
          <div className="bk-panel">
            <div className={`mn-cat${cat === 'all' ? ' active' : ''}`} onClick={() => setCat('all')}><span>{t('crm.bookings.v.menu.allItems')}</span><span className="cnt">{items.length}</span></div>
            {categories.map((c, i) => (
              <div key={c.id} className={`mn-cat${cat === c.id ? ' active' : ''}`} onClick={() => setCat(c.id)}>
                <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</span>
                {cat === c.id ? (
                  <span style={{ display: 'flex', gap: 2 }} onClick={(e) => e.stopPropagation()}>
                    <button className="bk-x" title="↑" onClick={() => moveCategory(i, -1)}>↑</button>
                    <button className="bk-x" title="↓" onClick={() => moveCategory(i, 1)}>↓</button>
                    <button className="bk-x" onClick={() => renameCategory(c)}><Ic d={BK_ICON.edit} size={12} /></button>
                    <button className="bk-x" onClick={() => removeCategory(c)}><Ic d={BK_ICON.trash} size={12} /></button>
                  </span>
                ) : (
                  <span className="cnt">{countIn(c.id)}</span>
                )}
              </div>
            ))}
            {countIn(null) > 0 && (
              <div className={`mn-cat${cat === 'none' ? ' active' : ''}`} onClick={() => setCat('none')}><span>{t('crm.bookings.v.menu.noCategory')}</span><span className="cnt">{countIn(null)}</span></div>
            )}
          </div>

          <div>
            <div className="bk-filters">
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--line-2)', borderRadius: 8, padding: '7px 12px', width: 240, background: '#fff' }}>
                <Ic d={BK_ICON.search} size={13} />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={t('crm.bookings.v.menu.search')} style={{ border: 0, outline: 'none', fontSize: 12.5, width: '100%' }} />
              </div>
              <span className={`bk-chip${onlyStop ? ' on' : ''}`} onClick={() => setOnlyStop((v) => !v)}>{t('crm.bookings.v.menu.onlyStop')}</span>
            </div>
            {visible.length === 0 ? (
              <div className="bk-panel">
                <EmptyState title={t('crm.bookings.v.menu.emptyTitle')} text={t('crm.bookings.v.menu.emptyText')} action={<button className="btn btn-primary btn-sm" onClick={() => setEdit(emptyItem(cat !== 'all' && cat !== 'none' ? cat : categories[0]?.id || null, currency))}>{t('crm.bookings.v.menu.addItem')}</button>} />
              </div>
            ) : (
              <div className="mn-grid">
                {visible.map((i) => (
                  <div key={i.id} className={`mn-card${!i.active ? ' off' : ''}`}>
                    <div className="img" style={i.imageUrl ? { backgroundImage: `url("${i.imageUrl}")` } : undefined}>
                      {!i.imageUrl && <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.4"><path d="M7 3v8a2 2 0 002 2v8" /><path d="M5 3v5" /><path d="M9 3v5" /><path d="M17 3c-2 2-2 6 0 8v10" /></svg>}
                    </div>
                    <div className="body">
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                        <div className="nm">{i.name}</div>
                        {!i.available && <span className="mn-stop">{t('crm.bookings.v.menu.stop')}</span>}
                      </div>
                      {i.description && <div className="ds">{i.description}</div>}
                      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 'auto', paddingTop: 4 }}>
                        {i.portion && <span className="mn-tag">{i.portion}</span>}
                        {i.prepMinutes ? <span className="mn-tag">{t('crm.bookings.v.common.minutesShort', { count: i.prepMinutes })}</span> : null}
                        {i.tags.map((tg) => <span key={tg} className="mn-tag">{t(`crm.bookings.v.menu.tag.${tg}`, { defaultValue: tg })}</span>)}
                      </div>
                    </div>
                    <div className="ft">
                      <span className="bk-money" style={{ fontWeight: 600 }}>{fmtMoney(i.price, i.currency, locale)}</span>
                      <span style={{ display: 'flex', gap: 4 }}>
                        <button className="btn btn-sm" style={{ padding: '4px 8px', fontSize: 11 }} onClick={() => toggleStop(i)}>{i.available ? t('crm.bookings.v.menu.toStop') : t('crm.bookings.v.menu.fromStop')}</button>
                        <button className="bk-x" onClick={() => setEdit({ ...i })}><Ic d={BK_ICON.edit} size={13} /></button>
                        <button className="bk-x" onClick={() => removeItem(i)}><Ic d={BK_ICON.trash} size={13} /></button>
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <BkModal
        open={!!edit}
        title={edit?.id ? t('crm.bookings.v.menu.editItem') : t('crm.bookings.v.menu.addItem')}
        onClose={() => setEdit(null)}
        footer={<><button className="btn btn-sm" onClick={() => setEdit(null)}>{t('crm.bookings.v.common.cancel')}</button><button className="btn btn-primary btn-sm" disabled={saving} onClick={saveItem}><Ic d={BK_ICON.check} size={13} /> {t('crm.bookings.v.common.save')}</button></>}
      >
        {edit && (
          <>
            <div className="bk-field"><label>{t('crm.bookings.v.menu.itemName')}</label><input autoFocus value={edit.name || ''} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></div>
            <div className="bk-row3">
              <div className="bk-field"><label>{t('crm.bookings.v.menu.price')}</label><input type="number" min={0} step="0.01" value={edit.price ?? ''} onChange={(e) => setEdit({ ...edit, price: e.target.value })} /></div>
              <div className="bk-field"><label>{t('crm.bookings.v.menu.currency')}</label><input value={edit.currency || ''} maxLength={3} onChange={(e) => setEdit({ ...edit, currency: e.target.value.toUpperCase() })} /></div>
              <div className="bk-field"><label>{t('crm.bookings.v.menu.portion')}</label><input value={edit.portion || ''} onChange={(e) => setEdit({ ...edit, portion: e.target.value })} placeholder={t('crm.bookings.v.menu.portionPh')} /></div>
            </div>
            <div className="bk-row2">
              <div className="bk-field"><label>{t('crm.bookings.v.menu.category')}</label>
                <select value={edit.categoryId || ''} onChange={(e) => setEdit({ ...edit, categoryId: e.target.value || null })}>
                  <option value="">{t('crm.bookings.v.menu.noCategory')}</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="bk-field"><label>{t('crm.bookings.v.menu.prep')}</label><input type="number" min={0} value={edit.prepMinutes ?? ''} onChange={(e) => setEdit({ ...edit, prepMinutes: e.target.value === '' ? null : Number(e.target.value) })} /></div>
            </div>
            <div className="bk-field"><label>{t('crm.bookings.v.menu.description')}</label><textarea rows={2} value={edit.description || ''} onChange={(e) => setEdit({ ...edit, description: e.target.value })} /></div>
            <div className="bk-field"><label>{t('crm.bookings.v.menu.image')}</label><input value={edit.imageUrl || ''} onChange={(e) => setEdit({ ...edit, imageUrl: e.target.value })} placeholder="https://…" /></div>
            <div className="bk-field"><label>{t('crm.bookings.v.menu.tags')}</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {TAGS.map((tg) => {
                  const on = (edit.tags || []).includes(tg);
                  return <span key={tg} className={`bk-chip${on ? ' on' : ''}`} onClick={() => setEdit({ ...edit, tags: on ? (edit.tags || []).filter((x) => x !== tg) : [...(edit.tags || []), tg] })}>{t(`crm.bookings.v.menu.tag.${tg}`)}</span>;
                })}
              </div>
            </div>
            <label className="bk-check"><input type="checkbox" checked={edit.available !== false} onChange={(e) => setEdit({ ...edit, available: e.target.checked })} /> {t('crm.bookings.v.menu.availableNow')}</label>
            <label className="bk-check"><input type="checkbox" checked={edit.active !== false} onChange={(e) => setEdit({ ...edit, active: e.target.checked })} /> {t('crm.bookings.v.menu.activeItem')}</label>
          </>
        )}
      </BkModal>
    </MainLayout>
  );
};
