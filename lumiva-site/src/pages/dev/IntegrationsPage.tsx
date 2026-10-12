import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import PageSEO from '../../components/PageSEO'
import { useLangPath } from '../../hooks/useLangPath'

export default function IntegrationsPage() {
  const { t, i18n } = useTranslation()
  const { p, h } = useLangPath()
  const langKey = i18n.language?.startsWith('ru') ? 'ru' : i18n.language?.startsWith('tr') ? 'tr' : 'en'
  const priceFrom = langKey === 'ru' ? 'от' : langKey === 'tr' ? 'baslangic' : 'from'
  const monthShort = langKey === 'ru' ? 'мес' : langKey === 'tr' ? 'ay' : 'mo'

  useEffect(() => {
    const els = document.querySelectorAll<HTMLElement>('.deliv-row, .chip, .tier, .pmini-row, .cm')
    els.forEach(el => el.classList.add('reveal'))
    const observer = new IntersectionObserver(
      entries => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('in') }),
      { threshold: 0.08 }
    )
    els.forEach(el => observer.observe(el))
    window.scrollTo(0, 0)
    return () => observer.disconnect()
  }, [])

  const stacksByLang: Record<'en' | 'ru' | 'tr', Record<string, string[]>> = {
    en: {
      'API & Protocols': ['REST', 'GraphQL', 'gRPC', 'WebSocket', 'SOAP', 'EDI', 'SFTP', 'XML/JSON'],
      'Queues & ETL': ['Kafka', 'RabbitMQ', 'BullMQ', 'Apache Airflow', 'dbt', 'n8n', 'Temporal'],
      'CRM & ERP': ['1C:Enterprise', 'SAP', 'Oracle', 'Bitrix24', 'amoCRM', 'HubSpot', 'Salesforce'],
      'Warehouse & Logistics': ['MyWarehouse', 'CDEK', 'DPD', 'Boxberry', 'DHL', 'Yandex Market', 'OZON', 'WB'],
    },
    ru: {
      'API & Protocols': ['REST', 'GraphQL', 'gRPC', 'WebSocket', 'SOAP', 'EDI', 'SFTP', 'XML/JSON'],
      'Очереди & ETL': ['Kafka', 'RabbitMQ', 'BullMQ', 'Apache Airflow', 'dbt', 'n8n', 'Temporal'],
      'CRM & ERP': ['1С:Предприятие', 'SAP', 'Oracle', 'Bitrix24', 'amoCRM', 'HubSpot', 'Salesforce'],
      'Склад & логистика': ['МойСклад', 'СДЭК', 'DPD', 'Boxberry', 'DHL', 'Яндекс.Маркет', 'OZON', 'WB'],
    },
    tr: {
      'API & Protokoller': ['REST', 'GraphQL', 'gRPC', 'WebSocket', 'SOAP', 'EDI', 'SFTP', 'XML/JSON'],
      'Kuyruklar & ETL': ['Kafka', 'RabbitMQ', 'BullMQ', 'Apache Airflow', 'dbt', 'n8n', 'Temporal'],
      'CRM & ERP': ['1C:Enterprise', 'SAP', 'Oracle', 'Bitrix24', 'amoCRM', 'HubSpot', 'Salesforce'],
      'Depo & Lojistik': ['MyWarehouse', 'CDEK', 'DPD', 'Boxberry', 'DHL', 'Yandex Market', 'OZON', 'WB'],
    },
  }
  const stacks = stacksByLang[langKey]

  const delivs = [
    { n: 'IN/01', ta: 'd0_ta', te: 'd0_te', desc: 'd0_desc' },
    { n: 'IN/02', ta: 'd1_ta', te: 'd1_te', desc: 'd1_desc' },
    { n: 'IN/03', ta: 'd2_ta', te: 'd2_te', desc: 'd2_desc' },
    { n: 'IN/04', ta: 'd3_ta', te: 'd3_te', desc: 'd3_desc' },
    { n: 'IN/05', ta: 'd4_ta', te: 'd4_te', desc: 'd4_desc' },
    { n: 'IN/06', ta: 'd5_ta', te: 'd5_te', desc: 'd5_desc' },
    { n: 'IN/07', ta: 'd6_ta', te: 'd6_te', desc: 'd6_desc' },
    { n: 'IN/08', ta: 'd7_ta', te: 'd7_te', desc: 'd7_desc' },
  ]

  const process = [
    { n: '01', ha: 'p0_ha', he: 'p0_he', d: 'p0_d' },
    { n: '02', ha: 'p1_ha', he: 'p1_he', d: 'p1_d' },
    { n: '03', ha: 'p2_ha', he: 'p2_he', d: 'p2_d' },
    { n: '04', ha: 'p3_ha', he: 'p3_he', d: 'p3_d' },
  ]

  const cases = [
    { bg: '#f5f3ee', label: 'Helios', labelColor: '#222', result: '−70%', ci: 0 },
    { bg: '#1a1a1a', label: 'PALOMA', labelColor: '#fff', result: '×3', ci: 1 },
    { bg: '#e9e6dc', label: 'Nexus', labelColor: '#222', result: '99.98%', ci: 2 },
  ]

  return (
    <>
      <PageSEO
        title={t('integrations.seo_title')}
        description={t('integrations.seo_desc')}
        path={p('/services/development/integrations')}
        jsonLd={{ '@context': 'https://schema.org', '@type': 'Service', name: 'CRM and API Integrations', provider: { '@type': 'Organization', name: 'Lumiva Agency', url: 'https://lumiva.agency' }, areaServed: ['Turkey', 'Europe', 'CIS'], serviceType: 'API Integration' }}
      />
      <header className="page-hero">
        <div className="wrap">
          <div className="crumbs">
            <Link to={p('/')}>{t('crumbs.home')}</Link><span className="sep">/</span>
            <Link to={p('/services')}>{t('crumbs.services')}</Link><span className="sep">/</span>
            <Link to={p('/services/development')}>{t('crumbs.development')}</Link><span className="sep">/</span>
            <span>{t('integrations.crumb')}</span>
          </div>
          <div className="page-hero-grid">
            <div>
              <div className="page-eyebrow">D/04 · Integrations & API</div>
              <h1 className="page-title">{t('integrations.hero_title_pre')} <em>{t('integrations.hero_title_em')}</em></h1>
            </div>
            <div className="page-hero-side">
              <p>{t('integrations.hero_sub')}</p>
              <div className="page-hero-actions">
                <a href={h('#contact')} className="btn btn-primary">{t('cp.request_quote')}<span className="arrow">↗</span></a>
                <a href="#cases" className="btn btn-ghost">{t('cp.cases_link')}<span className="arrow">↗</span></a>
              </div>
              <div className="hero-side-stats">
                <div className="s"><div className="num">80<em>+</em></div><div className="lbl">{t('integrations.stat1_lbl')}</div></div>
                <div className="s"><div className="num">99.98<em>%</em></div><div className="lbl">{t('integrations.stat2_lbl')}</div></div>
                <div className="s"><div className="num">&lt;200<em>ms</em></div><div className="lbl">{t('integrations.stat3_lbl')}</div></div>
                <div className="s"><div className="num">0<em></em></div><div className="lbl">{t('integrations.stat4_lbl')}</div></div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">01</span>{t('cp.sec_included')}</div>
            <div>
              <h2 className="sec-title">{t('integrations.sec01_title_pre')} <em>{t('integrations.sec01_title_em')}</em></h2>
              <p className="sec-sub">{t('integrations.sec01_sub')}</p>
            </div>
            <a href={h('#contact')} className="show-all">{t('cp.request_quote')} <span className="arr">↗</span></a>
          </div>
          <div className="deliv">
            {delivs.map((d, i) => (
              <div key={i} className="deliv-row">
                <div className="num">{d.n}</div>
                <div><h4>{t(`integrations.${d.ta}`)}<em>{t(`integrations.${d.te}`)}</em></h4><p>{t(`integrations.${d.desc}`)}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">02</span>{t('cp.sec_stack')}</div>
            <div>
              <h2 className="sec-title">{t('integrations.sec02_title_pre')} <em>{t('integrations.sec02_title_em')}</em></h2>
              <p className="sec-sub">{t('integrations.sec02_sub')}</p>
            </div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
            {Object.entries(stacks).map(([label, chips]) => (
              <div key={label}>
                <div className="sec-tag" style={{ marginBottom: 14 }}>
                  <span className="num">{label[0]}</span>{label}
                </div>
                <div className="stack">
                  {chips.map(c => (
                    <span key={c} className="chip"><span className="pip" />{c}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">03</span>{t('cp.sec_process')}</div>
            <div>
              <h2 className="sec-title">{t('integrations.sec03_title_pre')} <em>{t('integrations.sec03_title_em')}</em></h2>
              <p className="sec-sub">{t('integrations.sec03_sub')}</p>
            </div>
          </div>
          <div className="pmini">
            {process.map((r, i) => (
              <div key={i} className="pmini-row">
                <div className="pmini-num">{r.n}</div>
                <div className="pmini-h">{t(`integrations.${r.ha}`)}<em>{t(`integrations.${r.he}`)}</em></div>
                <div className="pmini-d">{t(`integrations.${r.d}`)}</div>
                <div className="pmini-arr">↗</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">04</span>{t('cp.sec_pricing')}</div>
            <div>
              <h2 className="sec-title">{t('integrations.sec04_title_pre')} <em>{t('integrations.sec04_title_em')}</em></h2>
              <p className="sec-sub">{t('integrations.sec04_sub')}</p>
            </div>
          </div>
          <div className="pricing">
            <div className="tier">
              <div className="tier-badge">{t('integrations.t1_badge')}</div>
              <div className="tier-name">{t('integrations.t1_name')}</div>
              <div className="tier-sub">{t('integrations.t1_sub')}</div>
              <div className="tier-price">{priceFrom} 2 500<em>€</em></div>
              <ul className="tier-incl">
                {['t1_f1','t1_f2','t1_f3','t1_f4','t1_f5'].map(k => <li key={k}>{t(`integrations.${k}`)}</li>)}
              </ul>
              <a href={h('#contact')} className="btn btn-ghost">{t('cp.discuss')}<span className="arrow">↗</span></a>
            </div>
            <div className="tier featured">
              <div className="tier-badge">{t('integrations.t2_badge')}</div>
              <div className="tier-name">{t('integrations.t2_name')}</div>
              <div className="tier-sub">{t('integrations.t2_sub')}</div>
              <div className="tier-price">{priceFrom} 10 000<em>€</em></div>
              <ul className="tier-incl">
                {['t2_f1','t2_f2','t2_f3','t2_f4','t2_f5','t2_f6'].map(k => <li key={k}>{t(`integrations.${k}`)}</li>)}
              </ul>
              <a href={h('#contact')} className="btn">{t('cp.request_quote')}<span className="arrow">↗</span></a>
            </div>
            <div className="tier">
              <div className="tier-badge">{t('integrations.t3_badge')}</div>
              <div className="tier-name">{t('integrations.t3_name')}</div>
              <div className="tier-sub">{t('integrations.t3_sub')}</div>
              <div className="tier-price">{priceFrom} 2 000<em>€/{monthShort}</em></div>
              <ul className="tier-incl">
                {['t3_f1','t3_f2','t3_f3','t3_f4','t3_f5'].map(k => <li key={k}>{t(`integrations.${k}`)}</li>)}
              </ul>
              <a href={h('#contact')} className="btn btn-ghost">{t('cp.discuss')}<span className="arrow">↗</span></a>
            </div>
          </div>
        </div>
      </section>

      <section id="cases">
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">05</span>{t('cp.sec_cases')}</div>
            <div><h2 className="sec-title">{t('integrations.sec05_title_pre')} <em>{t('integrations.sec05_title_em')}</em></h2></div>
            <a href={h('#cases')} className="show-all">{t('cp.all_works')} <span className="arr">↗</span></a>
          </div>
          <div className="cases-mini">
            {cases.map((c, i) => (
              <div key={i} className="cm">
                <div className="cm-thumb">
                  <div className="cm-art" style={{ background: c.bg }}>
                    <div className="grid-deco" />
                    <div className="label serif italic" style={{ color: c.labelColor, fontSize: 64, letterSpacing: '-0.03em' }}>{c.label}</div>
                  </div>
                </div>
                <div className="cm-meta">
                  <div>
                    <div className="cm-name">{t(`integrations.c${c.ci}_name`)}</div>
                    <div className="cm-cat">{t(`integrations.c${c.ci}_cat`)}</div>
                  </div>
                  <div className="cm-result">{c.result}<em> {t(`integrations.c${c.ci}_rsub`)}</em></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="cta-strip" style={{ borderBottom: 0 }}>
        <div className="wrap">
          <div className="grid">
            <div>
              <h2>{t('integrations.cta_title_pre')} <em>{t('integrations.cta_title_em')}</em></h2>
              <p>{t('integrations.cta_sub')}</p>
              <div className="cta-actions">
                <a href={h('#contact')} className="btn btn-primary">{t('cp.request_quote')}<span className="arrow">↗</span></a>
                <a href={`mailto:${t('common.email')}`} className="btn btn-ghost">vlad@lumiva.agency<span className="arrow">↗</span></a>
              </div>
            </div>
            <div className="cta-side">
              <div className="row"><div className="lbl">{t('cp.slots_q3')}</div><div className="val">{t('cp.slots_val')}</div></div>
              <div className="row"><div className="lbl">{t('cp.start')}</div><div className="val">{t('cp.start_val')}</div></div>
              <div className="row" style={{ borderBottom: 0 }}><div className="lbl">{t('cp.resp')}</div><div className="val">{t('cp.resp_val')}</div></div>
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
