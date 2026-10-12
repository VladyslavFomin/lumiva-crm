import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import PageSEO from '../../components/PageSEO'
import RelatedServices from '../../components/RelatedServices'
import RelatedCases from '../../components/RelatedCases'
import { useLangPath } from '../../hooks/useLangPath'

const faqItems = [
  {
    q: 'What does a digital marketing agency in Antalya do?',
    a: 'A digital marketing agency in Antalya like Lumiva handles the full marketing stack: SEO, performance advertising (Google Ads, Meta), CRM implementation, web development, brand identity, analytics, and content strategy — tailored to businesses operating in Turkey and internationally.',
  },
  {
    q: 'Why hire a local digital marketing agency in Antalya?',
    a: 'A local agency understands the Turkish market, language, and consumer behaviour. Lumiva works with businesses in Antalya and across Turkey, combining local market expertise with international standards in performance and analytics.',
  },
  {
    q: 'How much does digital marketing cost in Antalya?',
    a: 'Project budgets start from €18,000. Monthly retainers for ongoing marketing management start from €4,500/month for a single channel, and from €9,000/month for a full-stack team. The exact cost depends on scope, channels, and team composition. We prepare a precise estimate after a discovery call.',
  },
  {
    q: 'Do you work with international companies based in Antalya?',
    a: 'Yes. We serve international businesses, hotels, travel companies, and startups operating from Antalya. Our team communicates in Russian, English, and Turkish.',
  },
  {
    q: 'What industries do you serve in Antalya and Turkey?',
    a: 'Hospitality (hotels and resorts), travel agencies, real estate, e-commerce, SaaS companies, professional services, and retail. We have deep experience with tourism and hospitality marketing in the Antalya region.',
  },
  {
    q: 'Can you manage a project remotely if I am not based in Antalya?',
    a: 'Yes. Most of our clients work with us remotely — we run projects through structured weekly calls, shared dashboards, and async reporting. Being based in Antalya gives us local market context, not a requirement that you visit in person.',
  },
  {
    q: 'Do you sign NDAs and work under contract?',
    a: 'Yes. Every engagement starts with a signed service agreement and we sign NDAs on request before any discovery work begins. Confidentiality of your business data and strategy is standard practice for us.',
  },
  {
    q: 'How do you report on results?',
    a: 'Monthly reporting calls with a live dashboard covering the metrics relevant to your contract — traffic, leads, CAC, ROAS, or revenue depending on the channels in scope. No vanity metrics, no static PDF decks nobody reads.',
  },
]

export default function DigitalMarketingAntalyaPage() {
  const { i18n } = useTranslation()
  const { p, h } = useLangPath()
  const lang = i18n.language || 'en'

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Service',
      name: 'Digital Marketing Agency in Antalya',
      provider: { '@type': 'LocalBusiness', name: 'Lumiva Agency', url: 'https://lumiva.agency', telephone: '+90-538-365-96-78', address: { '@type': 'PostalAddress', addressLocality: 'Antalya', addressCountry: 'TR' } },
      areaServed: [{ '@type': 'City', name: 'Antalya' }, { '@type': 'Country', name: 'Turkey' }],
      serviceType: 'Digital Marketing',
      description: 'Full-service digital marketing agency in Antalya. SEO, Google Ads, CRM, web development, analytics, and brand identity for businesses in Turkey and internationally.',
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

  const tools = ['Google Ads', 'Meta Ads', 'Yandex Direct', 'GA4', 'Yandex Metrica', 'Lumiva CRM', 'HubSpot', 'Bitrix24', 'Semrush', 'Screaming Frog', 'Looker Studio', 'Figma', 'Next.js', 'Google Search Console']

  return (
    <>
      <PageSEO
        title="Digital Marketing Agency in Antalya"
        description="Lumiva Agency is a full-service digital marketing agency in Antalya. SEO, Google Ads, CRM, web development, and analytics for hotels, brands and growth-focused businesses in Turkey."
        path="/digital-marketing-agency-antalya"
        jsonLd={jsonLd}
      />

      <header className="page-hero">
        <div className="wrap">
          <div className="crumbs">
            <Link to={p('/')}>Home</Link><span className="sep">/</span>
            <span>Digital Marketing Agency Antalya</span>
          </div>
          <div className="page-hero-grid">
            <div>
              <div className="page-eyebrow">Local SEO · Antalya</div>
              <h1 className="page-title">Digital Marketing Agency in Antalya</h1>
            </div>
            <div className="page-hero-side">
              <p>Lumiva Agency is a full-service digital marketing studio based in Antalya, Turkey. We help hotels, travel companies, brands and growing businesses build marketing systems that generate measurable revenue — not just impressions.</p>
              <div className="page-hero-actions">
                <a href={h('#contact')} className="btn btn-primary">Discuss your project<span className="arrow">↗</span></a>
                <Link to={p('/cases')} className="btn btn-ghost">Our cases<span className="arrow">↗</span></Link>
              </div>
              <div className="hero-side-stats">
                <div className="s"><div className="num">8+</div><div className="lbl">marketing disciplines in one team</div></div>
                <div className="s"><div className="num">3</div><div className="lbl">languages: EN / RU / TR</div></div>
                <div className="s"><div className="num">40<em>+</em></div><div className="lbl">businesses served in Turkey</div></div>
                <div className="s"><div className="num">12<em>-36mo</em></div><div className="lbl">average client relationship</div></div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">01</span>What We Do</div>
            <div>
              <h2 className="sec-title">Full-stack digital marketing for Antalya businesses</h2>
              <p className="sec-sub">Eight disciplines under one contract — strategy, design, development, and performance, coordinated by a single team instead of juggling separate vendors.</p>
            </div>
          </div>
          <div className="deliv">
            {[
              { title: 'SEO & Organic Growth', desc: 'Technical audit, semantic core, content strategy, link building. We rank you in Google and Yandex for commercial queries in Turkish, English, and Russian.' },
              { title: 'Performance Marketing', desc: 'Google Ads, Meta Ads, Yandex Direct. Media planning, launch, optimisation, and scaling across all paid channels. Every euro tracked to revenue.' },
              { title: 'CRM Development', desc: 'Custom CRM for sales, leads, and guest communication. From brief to launch in 8–14 weeks. Integrations with booking systems, email, and messaging.' },
              { title: 'Web Development', desc: 'Corporate sites, landing pages, e-commerce. React, Next.js, headless CMS. Fast, SEO-ready, and built to convert.' },
              { title: 'Analytics & BI', desc: 'GA4, BigQuery, Metabase, Looker Studio. Full attribution from ad click to closed deal. We make data actionable.' },
              { title: 'Brand Identity & Design', desc: 'Visual identity, brand guidelines, packaging, UI/UX. A brand system that lives for years, not a single season.' },
              { title: 'SMM & Content Production', desc: 'Content strategy and production for Telegram, Instagram, and YouTube. Community management and influencer campaigns across platforms.' },
              { title: 'Strategy & Positioning', desc: 'Brand audits, audience research, competitive analysis, and a 12-month roadmap before any execution begins. Strategy first, tactics second.' },
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
            <div className="sec-tag"><span className="num">02</span>Who We Serve</div>
            <div><h2 className="sec-title">Industries we work with in Antalya and Turkey</h2></div>
          </div>
          <div className="deliv">
            {[
              { title: 'Hotels & Resorts', desc: 'Direct booking growth, SEO in multiple languages, CRM for guest communication, performance marketing on Google and meta platforms.' },
              { title: 'Travel & Tour Agencies', desc: 'Lead generation funnels, CRM for inquiry management, SEO for destination keywords, Google Ads for seasonal campaigns.' },
              { title: 'Real Estate', desc: 'Landing pages for developments, lead tracking, CRM integration, SEO for property buyers in Russia, Europe, and Turkey.' },
              { title: 'E-commerce', desc: 'Online store development, marketplace integrations (OZON, Wildberries, Hepsiburada), performance campaigns, and analytics.' },
              { title: 'SaaS & Tech', desc: 'Product marketing, conversion optimisation, CRM for sales teams, SEO for SaaS keywords in English and Turkish.' },
              { title: 'Professional Services', desc: 'Law firms, consultancies, clinics. Local SEO, landing pages, Google Ads, lead management via CRM.' },
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
            <div className="sec-tag"><span className="num">03</span>Process</div>
            <div><h2 className="sec-title">How an engagement with Lumiva works</h2></div>
          </div>
          <div className="pmini">
            {[
              { n: '01', h: 'Discovery & Audit', d: 'We audit your current marketing, website, and competitive landscape. Output: a ranked list of opportunities and quick wins.' },
              { n: '02', h: 'Strategy & Roadmap', d: 'We define target channels, budget allocation, and KPIs. A 90-day roadmap with clear deliverables at each stage.' },
              { n: '03', h: 'Execution & Launch', d: 'Website, SEO, ads, CRM, and content are built and launched, in parallel or sequence based on priority and dependency.' },
              { n: '04', h: 'Optimisation & Reporting', d: 'Monthly analytics reviews with attribution data. We iterate on what works and cut what does not.' },
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
            <div className="sec-tag"><span className="num">04</span>Tools</div>
            <div><h2 className="sec-title">What we use</h2></div>
          </div>
          <div className="stack">
            {tools.map(c => <span key={c} className="chip"><span className="pip" />{c}</span>)}
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">05</span>Pricing</div>
            <div><h2 className="sec-title">Transparent engagement options</h2></div>
          </div>
          <div className="pricing">
            <div className="tier">
              <div className="tier-badge">START</div>
              <div className="tier-name">Single Channel</div>
              <div className="tier-sub">One discipline, full focus</div>
              <div className="tier-price">from €4,500<em>/mo</em></div>
              <ul className="tier-incl">
                <li>One channel: SEO, Ads, or CRM</li>
                <li>Monthly reporting call</li>
                <li>Dedicated point of contact</li>
                <li>3-month minimum commitment</li>
              </ul>
              <a href={h('#contact')} className="btn btn-ghost">Discuss<span className="arrow">↗</span></a>
            </div>
            <div className="tier featured">
              <div className="tier-badge">POPULAR</div>
              <div className="tier-name">Growth</div>
              <div className="tier-sub">Full-stack marketing team</div>
              <div className="tier-price">from €9,000<em>/mo</em></div>
              <ul className="tier-incl">
                <li>3–5 channels coordinated together</li>
                <li>Dedicated team of 3–5 specialists</li>
                <li>End-to-end analytics and attribution</li>
                <li>Bi-weekly strategy sessions</li>
                <li>Quarterly roadmap review</li>
              </ul>
              <a href={h('#contact')} className="btn">Book a strategy call<span className="arrow">↗</span></a>
            </div>
            <div className="tier">
              <div className="tier-badge">SCALE</div>
              <div className="tier-name">Multi-Market</div>
              <div className="tier-sub">For multi-location or multi-brand teams</div>
              <div className="tier-price">from €18,000<em>/mo</em></div>
              <ul className="tier-incl">
                <li>All disciplines, dedicated pod</li>
                <li>Multiple markets / languages</li>
                <li>Custom CRM and BI infrastructure</li>
                <li>Monthly executive reporting</li>
              </ul>
              <a href={h('#contact')} className="btn btn-ghost">Discuss<span className="arrow">↗</span></a>
            </div>
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">06</span>Why Lumiva</div>
            <div><h2 className="sec-title">Why Antalya businesses choose Lumiva Agency</h2></div>
          </div>
          <div className="deliv">
            {[
              { title: 'Local market expertise', desc: 'We understand the Turkish consumer, seasonal patterns, local platforms (Yandex, HepsiBurada, Sahibinden), and multilingual SEO for Russian, English, and Turkish audiences.' },
              { title: 'One team, all directions', desc: 'Strategy, design, development, SEO, paid media, CRM, and analytics — all in one contract. No coordination overhead between agencies.' },
              { title: 'Numbers first', desc: 'We measure everything: CPL, CAC, LTV, ROAS. Monthly reports with actual KPIs, not vanity metrics.' },
              { title: 'Long-term partnership', desc: 'We work in retainer and project formats. Most clients stay with us for 12–36 months. We grow as your business grows.' },
              { title: 'Transparent contracts', desc: 'No hidden fees, no lock-in beyond the agreed minimum term. You see exactly what you are paying for and why.' },
              { title: 'In-house, not outsourced', desc: 'Strategy, design, development, and media buying are handled by our own team — not subcontracted to third parties you never meet.' },
            ].map((d, i) => (
              <div key={i} className="deliv-row">
                <div className="num">{String(i + 1).padStart(2, '0')}</div>
                <div><h4>{d.title}</h4><p>{d.desc}</p></div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <RelatedCases
        num="07"
        tag="Cases"
        heading="Recent work in and around Antalya"
        allLabel="All cases"
        keywords={['antalya', 'turkey', 'hospitality', 'hotel', 'marketing']}
      />

      <section>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">08</span>FAQ</div>
            <div><h2 className="sec-title">Frequently asked questions</h2></div>
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
        num="09"
        tag="Related Services"
        heading="Explore specific services"
        items={[
          { title: 'SEO Agency in Antalya', desc: 'Multilingual SEO with technical audits, content, and link building.', to: p('/seo-agency-antalya') },
          { title: 'Web Development in Antalya', desc: 'Corporate sites, e-commerce, and SaaS development.', to: p('/web-development-antalya') },
          { title: 'Hotel Marketing in Turkey', desc: 'Direct booking growth for hotels and resorts.', to: p('/hotel-marketing-agency-turkey') },
        ]}
      />

      <section>
        <div className="wrap" style={{ textAlign: 'center', padding: '80px 0' }}>
          <h2 className="sec-title">Ready to grow your business in Antalya?</h2>
          <p style={{ marginBottom: 32, color: 'var(--muted)' }}>Book a strategy call. We'll analyse your market position and propose a plan within 3 business days.</p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href={h('#contact')} className="btn btn-primary">Book a strategy call<span className="arrow">↗</span></a>
            <Link to={p('/services')} className="btn btn-ghost">See all services<span className="arrow">↗</span></Link>
          </div>
        </div>
      </section>
    </>
  )
}
