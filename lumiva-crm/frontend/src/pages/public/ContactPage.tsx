// «Контакты» — дизайн Claude Design contact-v2.html (lh-pages.jsx ContactPage, lh-pages.css .ct-*).
// Форма реально сохраняет заявку (POST /v1/public/demo-requests → pl1 + Telegram команды). Выдуманное в макете
// («ответим в течение часа», «47 минут», 9–20 МСК) заменено реальным графиком; карточка ИИ открывает живой чат сайта.
import React, { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Icon } from '../landing/LandingSections';
import { AiCharacter, AI_ROLE_PALETTE } from '../ai-employees/AiCharacter';
import { CONTACT_T, type ContactText, type ContactTopic } from './contactText';
import { CtaBox, FaqSection, SolutionShell, StepsSection } from './solutionKit';

const TOPICS: ContactTopic[] = ['demo', 'pricing', 'integration', 'support'];
const EMPTY = { name: '', email: '', company: '', phone: '', team: '', msg: '' };

/* открыто ли сейчас: Пн–Пт 9:00–18:00 по Москве (UTC+3, без перехода на летнее время) */
function useOpenNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);
  const msk = new Date(now.getTime() + 3 * 3600000);
  const d = msk.getUTCDay();
  const h = msk.getUTCHours();
  return d > 0 && d < 6 && h >= 9 && h < 18;
}

function utmFromUrl() {
  const p = new URLSearchParams(window.location.search);
  const u: Record<string, string> = {};
  ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'].forEach((k) => {
    const v = p.get(k);
    if (v) u[k] = v;
  });
  return u;
}

function Hero({ tx }: { tx: ContactText }) {
  return (
    <section className="in-hero pg-hero">
      <div className="lh-glow" />
      <div className="in-hero-c">
        <div className="in-kick">
          <span className="lh-live">
            <i />
          </span>
          {tx.kick}
        </div>
        <h1 className="in-h1">
          {tx.t1}
          <br />
          <em>{tx.t2}</em>
        </h1>
        <p className="in-sub">{tx.sub}</p>
      </div>
    </section>
  );
}

function ContactForm({ tx }: { tx: ContactText }) {
  const [f, setF] = useState(EMPTY);
  const [topic, setTopic] = useState<ContactTopic>('demo');
  const [st, setSt] = useState<'idle' | 'loading' | 'ok' | 'err'>('idle');
  const bot = useRef<HTMLInputElement>(null);
  const ch = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setF((p) => ({ ...p, [e.target.name]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (st === 'loading' || !f.name.trim() || !f.email.trim()) return;
    setSt('loading');
    try {
      const res = await fetch('/v1/public/demo-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: f.name,
          email: f.email,
          company: f.company,
          phone: f.phone,
          teamSize: f.team,
          message: f.msg,
          topic,
          contactMethod: 'email',
          botField: bot.current?.value || '',
          utm: utmFromUrl(),
        }),
      });
      setSt(res.ok ? 'ok' : 'err');
    } catch {
      setSt('err');
    }
  };

  if (st === 'ok') {
    return (
      <div className="ct-form lh-rv">
        <div className="ct-ok">
          <span className="ct-ok-ic">
            <Icon name="check" size={28} stroke={2.4} />
          </span>
          <h3>{tx.okT}</h3>
          <p>{tx.okD(f.name.trim().split(/\s+/)[0], f.email.trim())}</p>
          <button
            type="button"
            className="lh-btn gh"
            onClick={() => {
              setSt('idle');
              setF(EMPTY);
            }}
          >
            {tx.again}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="ct-form lh-rv">
      <form onSubmit={submit}>
        <h3>{tx.formT}</h3>
        <div className="ct-topics" role="radiogroup">
          {TOPICS.map((k) => (
            <button type="button" key={k} role="radio" aria-checked={topic === k} className={topic === k ? 'on' : ''} onClick={() => setTopic(k)}>
              {tx.topics[k]}
            </button>
          ))}
        </div>
        <div className="ct-row">
          <label className="ct-f">
            <span>{tx.name} *</span>
            <input name="name" required maxLength={120} autoComplete="name" value={f.name} onChange={ch} placeholder={tx.namePh} />
          </label>
          <label className="ct-f">
            <span>{tx.email} *</span>
            <input name="email" type="email" required maxLength={180} autoComplete="email" value={f.email} onChange={ch} placeholder={tx.emailPh} />
          </label>
        </div>
        <div className="ct-row">
          <label className="ct-f">
            <span>{tx.company}</span>
            <input name="company" maxLength={200} autoComplete="organization" value={f.company} onChange={ch} placeholder={tx.companyPh} />
          </label>
          <label className="ct-f">
            <span>{tx.phone}</span>
            <input name="phone" type="tel" maxLength={40} autoComplete="tel" value={f.phone} onChange={ch} placeholder={tx.phonePh} />
          </label>
        </div>
        <div className="ct-f">
          <span>{tx.team}</span>
          <div className="ct-seg" role="radiogroup">
            {tx.teamOpts.map((o) => (
              <button type="button" key={o} role="radio" aria-checked={f.team === o} className={f.team === o ? 'on' : ''} onClick={() => setF((p) => ({ ...p, team: p.team === o ? '' : o }))}>
                {o}
              </button>
            ))}
          </div>
        </div>
        <label className="ct-f">
          <span>{tx.msg}</span>
          <textarea name="msg" rows={4} maxLength={4000} value={f.msg} onChange={ch} placeholder={tx.msgPh} />
        </label>
        {/* ловушка для ботов: человек это поле не видит */}
        <input ref={bot} name="website" tabIndex={-1} autoComplete="off" aria-hidden className="ct-hp" />
        {st === 'err' && <p className="ct-err">{tx.err}</p>}
        <button className={'lh-btn lg block' + (st === 'loading' ? ' busy' : '')} type="submit" disabled={st === 'loading'}>
          {st === 'loading' ? (
            <span className="ct-spin" />
          ) : (
            <>
              {tx.send}
              <Icon name="arrow" size={15} stroke={2} />
            </>
          )}
        </button>
        <p className="ct-cons">
          {tx.cons1} <Link to="/privacy">{tx.cons2}</Link>
        </p>
      </form>
    </div>
  );
}

function Side({ tx }: { tx: ContactText }) {
  const open = useOpenNow();
  const pal = AI_ROLE_PALETTE.chat_operator;
  const openChat = () => (window as unknown as { LumivaChat?: { open: () => void } }).LumivaChat?.open();
  return (
    <aside className="ct-side">
      <div className="ct-card lh-rv">
        <h4>{tx.benT}</h4>
        {tx.ben.map((b, i) => (
          <div key={b} className="ct-ben" style={{ animationDelay: 0.3 + i * 0.08 + 's' }}>
            <i>
              <Icon name="check" size={11} stroke={2.6} />
            </i>
            {b}
          </div>
        ))}
      </div>
      <div className="ct-card lh-rv">
        <h4>{tx.waysT}</h4>
        <a className="ct-way" href="mailto:hello@lumiva.agency">
          <span>
            <Icon name="mail" size={16} />
          </span>
          <div>
            <b>Email</b>
            <em>hello@lumiva.agency</em>
          </div>
          <Icon name="arrow" size={13} />
        </a>
        <a className="ct-way" href="https://t.me/lumiva_crm" target="_blank" rel="noopener noreferrer">
          <span className="tg">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" aria-hidden>
              <path d="M21 4L3 11l6 2 2 6 3-4 5 4z" />
            </svg>
          </span>
          <div>
            <b>Telegram</b>
            <em>@lumiva_crm</em>
          </div>
          <Icon name="arrow" size={13} />
        </a>
      </div>
      <div className="ct-time lh-rv">
        <div>
          <b>{tx.hoursT}</b>
          <span>{tx.hoursD}</span>
        </div>
        <span className={'ct-open' + (open ? ' on' : '')}>
          <i />
          {open ? tx.openOn : tx.openOff}
        </span>
      </div>
      <div className="ct-ai lh-rv">
        <span className="lh-fl-av" style={{ background: pal.bg }}>
          <AiCharacter role="chat_operator" mood="on" />
        </span>
        <div>
          <b>{tx.aiT}</b>
          <span>{tx.aiD}</span>
          <button type="button" className="ct-ai-b" onClick={openChat}>
            {tx.aiBtn}
            <Icon name="arrow" size={12} stroke={2} />
          </button>
        </div>
      </div>
    </aside>
  );
}

export default function ContactPage() {
  const { i18n } = useTranslation();
  const code = (i18n.language || 'ru').slice(0, 2);
  const tx = CONTACT_T[code === 'en' || code === 'tr' ? code : 'ru'];
  return (
    <SolutionShell activeKey="contact">
      <Hero tx={tx} />
      <section className="lp-sec ct" id="contact-form">
        <div className="ct-g">
          <ContactForm tx={tx} />
          <Side tx={tx} />
        </div>
      </section>
      <StepsSection {...tx.next} />
      <FaqSection {...tx.faq} writeHref="#contact-form" />
      <CtaBox k={tx.cta.k} t={tx.cta.t} demo={tx.cta.demo} tryFree={tx.cta.tryFree} demoTo="/features" />
    </SolutionShell>
  );
}
