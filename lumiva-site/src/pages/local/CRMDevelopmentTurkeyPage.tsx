import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import PageSEO from '../../components/PageSEO'
import RelatedServices from '../../components/RelatedServices'
import RelatedCases from '../../components/RelatedCases'
import { useLangPath } from '../../hooks/useLangPath'

const faqItems = [
  {
    q: 'What is custom CRM development in Turkey?',
    a: 'Custom CRM development means building a sales and client management system tailored to your specific business processes — not adapting your team to a generic off-the-shelf tool. We build CRM systems for Turkish and international companies from scratch, or deeply customise existing platforms.',
  },
  {
    q: 'When should I choose custom CRM over HubSpot or Bitrix24?',
    a: 'Choose custom CRM when your sales process is complex, when you need specific integrations (booking systems, local payment gateways, ERP), or when per-seat subscription costs of SaaS tools exceed the ROI. Custom CRM typically pays back in 12–18 months for teams of 10+ people.',
  },
  {
    q: 'How long does CRM development take in Turkey?',
    a: 'A basic CRM for lead management and sales tracking takes 8–12 weeks. A full CRM with integrations, reporting, and custom workflows takes 14–20 weeks. We use agile delivery so you can use core features from week 6.',
  },
  {
    q: 'How much does CRM development cost in Turkey?',
    a: 'Basic CRM systems start from €18,000. Complex CRM platforms with integrations, analytics, and mobile access start from €35,000. Maintenance and feature development continues monthly at €3,000–€8,000/month depending on scope.',
  },
  {
    q: 'Can you integrate CRM with Turkish platforms?',
    a: 'Yes. We integrate with YuKassa, Tinkoff Pay, SBP, Hepsiburada, Trendyol, local booking systems, accounting software, and any REST or webhook-based API. We also handle integrations with Google Workspace, Microsoft 365, Telegram, and WhatsApp Business.',
  },
  {
    q: 'Do you offer a ready-made CRM, or is everything custom-built?',
    a: 'Both. Lumiva CRM is our own product that can be deployed quickly and customised for your workflows. For businesses with highly specific processes, we build a fully bespoke system from the ground up.',
  },
  {
    q: 'Will our sales team need training to use the new CRM?',
    a: 'Yes, briefly. We run a structured onboarding session for your team and provide documentation. Because we design the CRM around your existing sales process rather than forcing a generic workflow, adoption is typically faster than with off-the-shelf tools.',
  },
  {
    q: 'Can the CRM scale as our business grows?',
    a: 'Yes. We build on PostgreSQL and Node.js with a modular architecture, so adding new pipelines, user roles, or integrations later does not require rebuilding the system from scratch.',
  },
]

export default function CRMDevelopmentTurkeyPage() {
  const { i18n } = useTranslation()
  const { p, h } = useLangPath()

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Service',
      name: 'CRM Development in Turkey',
      provider: { '@type': 'LocalBusiness', name: 'Lumiva Agency', url: 'https://lumiva.agency', telephone: '+90-538-365-96-78', address: { '@type': 'PostalAddress', addressLocality: 'Antalya', addressCountry: 'TR' } },
      areaServed: [{ '@type': 'Country', name: 'Turkey' }, { '@type': 'City', name: 'Antalya' }],
      serviceType: 'CRM Development',
      description: 'Custom CRM development for Turkish businesses. Sales management, lead tracking, integrations with local platforms. Built in Antalya, deployed globally.',
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: faqItems.map(item => ({
        '@type': 'Question',
        name: item.q,
        acceptedAnswer: { '@type': 'Answer', text: item.a },
      })),
    },
  ]

  const tools = ['Lumiva CRM', 'Node.js', 'PostgreSQL', 'Redis', 'Bitrix24', 'amoCRM', '1C:Trade', 'YuKassa', 'Tinkoff Pay', 'Telegram API', 'WhatsApp Business API', 'Metabase']

  return (
    <>
      <PageSEO
        title="CRM Development in Turkey"
        description="Lumiva Agency builds custom CRM systems for Turkish businesses. Sales management, lead tracking, booking integrations, and analytics. Based in Antalya, serving Turkey and international clients."
        path="/crm-development-turkey"
        jsonLd={jsonLd}
      />

      <header className="page-hero">
        <div className="wrap">
          <div className="crumbs">
            <Link to={p('/')}>Home</Link><span className="sep">/</span>
            <span>CRM Development Turkey</span>
          </div>
          <div className="page-hero-grid">
            <div>
              <div className="page-eyebrow">CRM Development · Turkey</div>
              <h1 className="page-title">CRM Development in Turkey</h1>
            </div>
            <div className="page-hero-side">
              <p>Lumiva Agency builds custom CRM systems for Turkish companies, hotels, travel agencies, and international businesses operating in Turkey. We design CRM around your sales process — not the other way around — and integrate it with the local platforms your business actually uses.</p>
              <div className="page-hero-actions">
                <a href={h('#contact')} className="btn btn-primary">Get a CRM consultation<span className="arrow">↗</span></a>
                <a href="https://crm.lumiva.agency/" target="_blank" rel="noopener noreferrer" className="btn btn-ghost">Lumiva CRM<span className="arrow">↗</span></a>
              </div>
              <div className="hero-side-stats">
                <div className="s"><div className="num">8<em>-20wk</em></div><div className="lbl">typical build time</div></div>
                <div className="s"><div className="num">40<em>-60%</em></div><div className="lbl">less manual work reported</div></div>
                <div className="s"><div className="num">12<em>-18mo</em></div><div className="lbl">typical payback period</div></div>
                <div className="s"><div className="num">3</div><div className="lbl">languages supported</div></div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">01</span>What We Build</div>
            <div>
              <h2 className="sec-title">CRM features for Turkish businesses</h2>
              <p className="sec-sub">A CRM is only useful if your team actually uses it. We build around the workflows your salespeople already follow, then automate the repetitive parts.</p>
            </div>
          </div>
          <div className="deliv">
            {[
              { title: 'Lead Management', desc: 'Capture leads from website forms, messengers, phone, and ads. Assign to managers, track status, set follow-up reminders. Never lose a lead again.' },
              { title: 'Sales Pipeline', desc: 'Visual pipeline with stages customised to your sales process. Drag-and-drop deal management, activity tracking, and win/loss analytics.' },
              { title: 'Client Database', desc: 'Full contact and company profiles with communication history, documents, payments, and notes. Accessible from any device.' },
              { title: 'Analytics & Reporting', desc: 'Sales KPIs, team performance, funnel conversion rates, revenue forecasting. Dashboards in Metabase or Looker Studio.' },
              { title: 'Integrations', desc: 'Connect to booking systems, payment gateways, email, Telegram, WhatsApp Business, Google Workspace, and accounting software.' },
              { title: 'Automation', desc: 'Auto-assign leads, send follow-up emails, trigger tasks based on deal stage changes. Reduce manual work by 40–60%.' },
              { title: 'Mobile Access', desc: 'Native-feeling mobile web app so field sales and account managers can update deals and contact clients away from their desk.' },
              { title: 'Role-Based Permissions', desc: 'Granular access control by team, role, and pipeline — so managers see everything and reps see only what they need.' },
            ].map((d, i) => (
              <div key={i} className="deliv-row">
                <div className="num">D/{String(i + 1).padStart(2, '0')}</div>
                <div><h4>{d.title}</h4><p>{d.desc}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">02</span>Industries</div>
            <div><h2 className="sec-title">CRM for specific industries in Turkey</h2></div>
          </div>
          <div className="deliv">
            {[
              { title: 'Hotels & Hospitality', desc: 'CRM for guest communication, group booking management, corporate client tracking, and direct sales funnels. Integrates with PMS and OTA channels.' },
              { title: 'Travel Agencies', desc: 'Inquiry management, tour proposal automation, multi-channel lead capture, and booking status tracking for tour operators.' },
              { title: 'Real Estate', desc: 'Property listings linked to leads, developer project pipelines, viewing scheduling, and multi-agent collaboration.' },
              { title: 'E-commerce & Retail', desc: 'Order management, VIP client tracking, loyalty programme integration, and repeat purchase automation.' },
            ].map((d, i) => (
              <div key={i} className="deliv-row">
                <div className="num">I/{String(i + 1).padStart(2, '0')}</div>
                <div><h4>{d.title}</h4><p>{d.desc}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">03</span>Tools</div>
            <div><h2 className="sec-title">What we build with</h2></div>
          </div>
          <div className="stack">
            {tools.map(c => <span key={c} className="chip"><span className="pip" />{c}</span>)}
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">04</span>Process</div>
            <div><h2 className="sec-title">How we build your CRM</h2></div>
          </div>
          <div className="pmini">
            {[
              { n: '01', h: 'Process Mapping', d: 'We map your actual sales process end to end — not a generic template — before any screen is designed.' },
              { n: '02', h: 'Architecture & Design', d: 'Data model, pipeline structure, and integrations are designed and signed off before development starts.' },
              { n: '03', h: 'Agile Build', d: 'Two-week sprints with working demos. Core features usable from week 6 onward.' },
              { n: '04', h: 'Rollout & Training', d: 'Team onboarding, documentation, and a support window to handle the first weeks of real usage.' },
            ].map((r, i) => (
              <div key={i} className="pmini-row">
                <div className="pmini-num">{r.n}</div>
                <div className="pmini-h">{r.h}</div>
                <div className="pmini-d">{r.d}</div>
                <div className="pmini-arr">↗</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">05</span>Pricing</div>
            <div><h2 className="sec-title">Transparent pricing</h2></div>
          </div>
          <div className="pricing">
            <div className="tier">
              <div className="tier-badge">START</div>
              <div className="tier-name">Basic CRM</div>
              <div className="tier-sub">Lead and sales tracking</div>
              <div className="tier-price">from €18,000</div>
              <ul className="tier-incl">
                <li>8–12 weeks</li>
                <li>Lead and pipeline management</li>
                <li>Basic reporting</li>
                <li>1 integration included</li>
              </ul>
              <a href={h('#contact')} className="btn btn-ghost">Discuss<span className="arrow">↗</span></a>
            </div>
            <div className="tier featured">
              <div className="tier-badge">POPULAR</div>
              <div className="tier-name">Full CRM</div>
              <div className="tier-sub">Integrations, reporting, automation</div>
              <div className="tier-price">from €35,000</div>
              <ul className="tier-incl">
                <li>14–20 weeks</li>
                <li>Custom workflows and automation</li>
                <li>Multiple integrations</li>
                <li>Analytics dashboards</li>
                <li>Mobile access</li>
              </ul>
              <a href={h('#contact')} className="btn">Get a CRM consultation<span className="arrow">↗</span></a>
            </div>
            <div className="tier">
              <div className="tier-badge">ONGOING</div>
              <div className="tier-name">Maintenance & Growth</div>
              <div className="tier-sub">Continuous feature development</div>
              <div className="tier-price">€3,000–€8,000<em>/mo</em></div>
              <ul className="tier-incl">
                <li>Bug fixes and uptime monitoring</li>
                <li>New features on a rolling basis</li>
                <li>Quarterly roadmap review</li>
              </ul>
              <a href={h('#contact')} className="btn btn-ghost">Discuss<span className="arrow">↗</span></a>
            </div>
          </div>
        </div>
      </section>

      <RelatedCases
        num="06"
        tag="Cases"
        heading="CRM and analytics work we have delivered"
        allLabel="All cases"
        keywords={['crm', 'analytics', 'data', 'tracking']}
      />

      <section>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">07</span>FAQ</div>
            <div><h2 className="sec-title">CRM development questions</h2></div>
          </div>
          <div className="faq">
            {faqItems.map((item, i) => (
              <div key={i} className="deliv-row">
                <div className="num">Q{i + 1}</div>
                <div><h4>{item.q}</h4><p>{item.a}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <RelatedServices
        num="08"
        tag="Related Services"
        heading="Pair CRM development with"
        items={[
          { title: 'Marketing Analytics', desc: 'Connect CRM data to full-funnel attribution and reporting.', to: p('/services/analytics') },
          { title: 'Web Development in Antalya', desc: 'A website that feeds leads directly into your new CRM.', to: p('/web-development-antalya') },
          { title: 'Hotel Marketing in Turkey', desc: 'CRM for guest communication paired with booking growth campaigns.', to: p('/hotel-marketing-agency-turkey') },
        ]}
      />

      <section>
        <div className="wrap" style={{ textAlign: 'center', padding: '80px 0' }}>
          <h2 className="sec-title">Ready to build your CRM in Turkey?</h2>
          <p style={{ marginBottom: 32, color: 'var(--muted)' }}>Book a CRM consultation. We'll map your sales process and propose a system architecture within 3 business days.</p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href={h('#contact')} className="btn btn-primary">Get a CRM consultation<span className="arrow">↗</span></a>
            <Link to={p('/cases')} className="btn btn-ghost">See our cases<span className="arrow">↗</span></Link>
          </div>
        </div>
      </section>
    </>
  )
}
