import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MainLayout } from '../../layout/MainLayout';
import { fetchSites, type Site } from '../../api/sites';
import { fetchEmbedForms, type EmbedFormRow } from '../../api/embedForms';
import {
  ADDABLE_FIELD_TYPES,
  FIELD_TYPE_LABELS,
  DEFAULT_DESIGN,
  VISUAL_PRESETS,
} from './WebFormEditorPage';
import '../bookings/bookings-design.css';
import './WebForms.css';

const cx = (...a: Array<string | false | null | undefined>) => a.filter(Boolean).join(' ');

const TABS = ['Основное', 'Поля и шаги', 'Дизайн по умолчанию', 'Уведомления', 'Домены и безопасность', 'Интеграции', 'Роли и доступ'] as const;
type TabKey = (typeof TABS)[number];

export const WebFormsSettingsPage: React.FC = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabKey>('Основное');
  const [sites, setSites] = useState<Site[]>([]);
  const [rows, setRows] = useState<EmbedFormRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([fetchSites(), fetchEmbedForms()])
      .then(([s, r]) => {
        setSites(s);
        setRows(r);
      })
      .catch(() => {
        // информационная страница — молча показываем то, что успело загрузиться
      })
      .finally(() => setLoading(false));
  }, []);

  const sitesUsage = useMemo(() => sites.map((s) => {
    const forms = rows.filter((r) => r.siteId === s.id);
    return { site: s, total: forms.length, published: forms.filter((f) => f.published).length };
  }), [sites, rows]);

  const classicPreset = VISUAL_PRESETS.find((p) => p.key === 'classic');

  return (
    <MainLayout>
      <div className="px-scope lv-embed-page w-full min-w-0 max-w-none px-2 sm:px-4 md:px-6 lg:px-8 py-6 md:py-8 pb-16">
        <button type="button" onClick={() => navigate('/web-forms')} className="lv-embed-back">
          ← {t('crm.embedForms.list.title')}
        </button>

        <div className="bk-hero">
          <div>
            <div className="kicker"><span className="dot" />{t('crm.embedForms.kicker')}</div>
            <h1>Настройки веб-форм</h1>
            <p className="sub">Значения по умолчанию для новых форм, статус спам-защиты и домены, которым разрешено встраивание.</p>
          </div>
        </div>

        <div className="bk-tabs" style={{ marginTop: 16 }}>
          {TABS.map((tb) => (
            <div key={tb} className={cx('bk-tab', tb === tab && 'active')} onClick={() => setTab(tb)}>{tb}</div>
          ))}
        </div>

        {tab === 'Основное' && (
          <div className="bk-panel">
            <div className="bk-panel-head"><div className="t">Значения по умолчанию для новых форм</div></div>
            <div className="bk-panel-body" style={{ padding: '6px 18px 14px' }}>
              <div className="bk-info-row"><span className="l">Стиль оформления</span><span className="v">{classicPreset?.name || 'Classic'}</span></div>
              <div className="bk-info-row"><span className="l">Ширина формы по умолчанию</span><span className="v">{String(DEFAULT_DESIGN.formMaxWidthPx)} px</span></div>
              <div className="bk-info-row"><span className="l">Скругление полей</span><span className="v">{String(DEFAULT_DESIGN.borderRadiusPx)} px</span></div>
              <div className="bk-info-row"><span className="l">Согласие на обработку данных</span><span className="v"><span className="bk-badge confirmed">Обязательно для лид-форм</span></span></div>
              <div className="bk-info-row"><span className="l">Публикация после создания</span><span className="v" style={{ fontWeight: 400, color: 'var(--fg-3)' }}>Черновик — публикуется вручную в редакторе</span></div>
            </div>
          </div>
        )}

        {tab === 'Поля и шаги' && (
          <div className="bk-panel">
            <div className="bk-panel-head"><div className="t">Доступные типы полей</div></div>
            <div className="bk-panel-body" style={{ padding: '6px 18px 14px' }}>
              <div className="bk-info-row"><span className="l">Типов полей доступно</span><span className="v">{ADDABLE_FIELD_TYPES.length}</span></div>
              <div className="bk-info-row"><span className="l">Составные поля (товары / запись / отель)</span><span className="v">product_cart, service_booking, hotel_booking — по одному на форму</span></div>
              <div className="bk-info-row"><span className="l">Многошаговые формы</span><span className="v"><span className="bk-badge confirmed">Поддерживаются</span></span></div>
              <div className="bk-info-row"><span className="l">Условная логика показа/скрытия</span><span className="v"><span className="bk-badge confirmed">Поддерживается</span></span></div>
              <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {ADDABLE_FIELD_TYPES.map((ft) => (
                  <span key={ft} className="lv-embed-badge">{FIELD_TYPE_LABELS[ft] || ft}</span>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'Дизайн по умолчанию' && (
          <div className="bk-panel">
            <div className="bk-panel-head"><div className="t">Готовые визуальные стили</div></div>
            <div className="bk-panel-body" style={{ padding: '14px 18px' }}>
              <p style={{ fontSize: 11.5, color: 'var(--fg-3)', marginBottom: 14, lineHeight: 1.5 }}>
                Применяются на вкладке «Дизайн» в редакторе формы — можно выбрать пресет или настроить оформление вручную.
              </p>
              <div className="lv-embed-preset-grid">
                {VISUAL_PRESETS.map((p) => (
                  <div key={p.key} className={cx('lv-embed-preset-card', p.key === 'classic' && 'is-active')}>
                    <div className="sw">
                      <span style={{ background: String(p.patch.backgroundColor || '#fff') }} />
                      <span style={{ background: String(p.patch.fieldBackground || '#eee') }} />
                      <span style={{ background: String(p.patch.buttonBackground || '#222') }} />
                    </div>
                    <div className="nm">{p.name}</div>
                    <div className="desc">{p.description}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {tab === 'Уведомления' && (
          <div className="bk-panel">
            <div className="bk-panel-head"><div className="t">Уведомления о заявках</div></div>
            <div className="bk-panel-body" style={{ padding: '6px 18px 14px' }}>
              <div className="bk-info-row"><span className="l">Новая заявка</span><span className="v">Попадает в лиды / продажи / бронирования CRM мгновенно</span></div>
              <div className="bk-info-row"><span className="l">Уведомления сотрудникам</span><span className="v" style={{ fontWeight: 400, color: 'var(--fg-3)' }}>Настраиваются в Хэлпдеске и Автоматизациях</span></div>
            </div>
          </div>
        )}

        {tab === 'Домены и безопасность' && (
          <div className="bk-panel">
            <div className="bk-panel-head"><div className="t">Домены, которым разрешено встраивание</div></div>
            <div className="bk-panel-body" style={{ padding: '14px 18px' }}>
              <p style={{ fontSize: 11.5, color: 'var(--fg-3)', marginBottom: 12, lineHeight: 1.5 }}>
                Форма привязана к сайту при создании — встроить её можно только на страницах домена этого сайта. Список сайтов управляется в Маркетинг → SEO.
              </p>
              {loading ? (
                <p className="text-sm text-slate-500">Загрузка…</p>
              ) : sites.length === 0 ? (
                <p style={{ fontSize: 12.5, color: 'var(--fg-3)' }}>Сайты ещё не добавлены.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {sites.map((s) => (
                    <div key={s.id} className="bk-info-row">
                      <span className="l" style={{ fontFamily: 'var(--ff-mono)', color: 'var(--ink)' }}>{s.domain}</span>
                      <span className="v" style={{ fontWeight: 400, color: 'var(--fg-3)' }}>{s.name || '—'}</span>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ marginTop: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div className="bk-info-row"><span className="l">Защита от спама</span><span className="v"><span className="bk-badge confirmed">Honeypot-поле на каждой форме</span></span></div>
                <div className="bk-info-row"><span className="l">Проверка origin</span><span className="v"><span className="bk-badge confirmed">По домену привязанного сайта</span></span></div>
              </div>
            </div>
          </div>
        )}

        {tab === 'Интеграции' && (
          <div className="bk-panel">
            <div className="bk-panel-head"><div className="t">Сайты, использующие веб-формы</div></div>
            <div className="bk-panel-body" style={{ padding: '6px 18px 14px' }}>
              {loading ? (
                <p className="text-sm text-slate-500">Загрузка…</p>
              ) : sitesUsage.length === 0 ? (
                <p style={{ fontSize: 12.5, color: 'var(--fg-3)' }}>Сайты ещё не добавлены.</p>
              ) : (
                sitesUsage.map(({ site, total, published }) => (
                  <div key={site.id} className="bk-info-row">
                    <span className="l" style={{ fontFamily: 'var(--ff-mono)', color: 'var(--ink)' }}>{site.domain}</span>
                    <span className="v" style={{ fontWeight: 400, color: 'var(--fg-3)' }}>{total ? `${published} из ${total} форм опубликовано` : 'форм пока нет'}</span>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {tab === 'Роли и доступ' && (
          <div className="bk-panel">
            <div className="bk-panel-head"><div className="t">Кто может управлять веб-формами</div></div>
            <div className="bk-panel-body" style={{ padding: '14px 18px' }}>
              <p style={{ fontSize: 12.5, color: 'var(--fg-3)', lineHeight: 1.6, marginBottom: 12 }}>
                Доступ к разделу «Веб-формы» и другим модулям CRM управляется ролями сотрудников.
              </p>
              <button type="button" className="btn btn-sm" onClick={() => navigate('/app/staff/permissions')}>
                Открыть роли и права доступа
              </button>
            </div>
          </div>
        )}
      </div>
    </MainLayout>
  );
};
