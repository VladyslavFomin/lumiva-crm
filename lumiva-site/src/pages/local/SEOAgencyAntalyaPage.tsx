import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import PageSEO from '../../components/PageSEO'
import RelatedServices from '../../components/RelatedServices'
import RelatedCases from '../../components/RelatedCases'
import { useLangPath } from '../../hooks/useLangPath'

const faqItems = [
  {
    q: 'What does an SEO agency in Antalya do?',
    a: 'An SEO agency in Antalya provides technical SEO audits, keyword research, on-page optimisation, content strategy, and link building to help businesses rank in Google and Yandex for relevant search queries in Turkish, English, and Russian.',
  },
  {
    q: 'How long does SEO take to show results in Turkey?',
    a: 'For competitive commercial keywords, expect meaningful ranking improvements in 3–6 months. Technical fixes and local SEO improvements often show results faster — within 4–8 weeks. We track position changes weekly.',
  },
  {
    q: 'Do you offer multilingual SEO in Antalya?',
    a: 'Yes. Lumiva handles SEO in Turkish, English, and Russian. We build separate keyword strategies for each language, implement hreflang correctly, and create content native to each market.',
  },
  {
    q: 'How much does SEO cost in Antalya?',
    a: 'SEO projects start from €3,500/month for ongoing work. One-time technical audits and strategy engagements start from €4,500. The exact scope depends on the number of languages, site size, and competition.',
  },
  {
    q: 'Can you do SEO for a hotel or tourism business in Antalya?',
    a: 'Absolutely. We have deep experience with hospitality SEO in Antalya — ranking hotel websites for direct booking keywords in Russian, German, English, and Turkish, reducing OTA dependency.',
  },
  {
    q: 'Do you guarantee specific Google rankings?',
    a: 'No agency can honestly guarantee specific positions — Google\'s algorithm changes constantly. What we commit to is a transparent, data-driven process with monthly reporting and a track record of measurable organic growth across our client portfolio.',
  },
  {
    q: 'Do you handle Yandex SEO as well as Google?',
    a: 'Yes. For businesses targeting Russian-speaking audiences, Yandex ranking factors differ meaningfully from Google — behavioural factors, regional relevance, and Yandex.Webmaster signals all matter. We optimise for both search engines in parallel.',
  },
  {
    q: 'What is included in your monthly SEO reporting?',
    a: 'Keyword position tracking, organic traffic and conversion trends, technical health (Core Web Vitals, crawl errors, indexation status), completed work for the month, and the priority list for the next month.',
  },
]

export default function SEOAgencyAntalyaPage() {
  const { i18n } = useTranslation()
  const { p, h } = useLangPath()

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Service',
      name: 'SEO Agency in Antalya',
      provider: { '@type': 'LocalBusiness', name: 'Lumiva Agency', url: 'https://lumiva.agency', telephone: '+90-538-365-96-78', address: { '@type': 'PostalAddress', addressLocality: 'Antalya', addressCountry: 'TR' } },
      areaServed: [{ '@type': 'City', name: 'Antalya' }, { '@type': 'Country', name: 'Turkey' }],
      serviceType: 'SEO',
      description: 'SEO agency in Antalya providing technical SEO, multilingual SEO in Turkish, English and Russian, content strategy, and link building for businesses in Turkey.',
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

  const tools = ['Semrush', 'Ahrefs', 'Screaming Frog', 'Google Search Console', 'Yandex Webmaster', 'DataForSEO', 'Surfer SEO', 'Yandex Metrica', 'GA4', 'Looker Studio']

  return (
    <>
      <PageSEO
        title="SEO Agency in Antalya"
        description="Lumiva Agency is an SEO agency in Antalya specialising in multilingual SEO for Turkish, English, and Russian markets. Technical SEO, content strategy, and link building for hotels, brands and businesses in Turkey."
        path="/seo-agency-antalya"
        jsonLd={jsonLd}
      />

      <header className="page-hero">
        <div className="wrap">
          <div className="crumbs">
            <Link to={p('/')}>Home</Link><span className="sep">/</span>
            <span>SEO Agency Antalya</span>
          </div>
          <div className="page-hero-grid">
            <div>
              <div className="page-eyebrow">SEO · Antalya · Turkey</div>
              <h1 className="page-title">SEO Agency in Antalya</h1>
            </div>
            <div className="page-hero-side">
              <p>Lumiva Agency is an SEO agency in Antalya delivering organic traffic growth in Turkish, English, and Russian. We combine technical excellence, content strategy, and data-driven link building for sustainable rankings — not short-lived tricks that disappear with the next algorithm update.</p>
              <div className="page-hero-actions">
                <a href={h('#contact')} className="btn btn-primary">Get an SEO audit<span className="arrow">↗</span></a>
                <Link to={p('/services/seo')} className="btn btn-ghost">SEO services<span className="arrow">↗</span></Link>
              </div>
              <div className="hero-side-stats">
                <div className="s"><div className="num">+340<em>%</em></div><div className="lbl">organic traffic growth</div></div>
                <div className="s"><div className="num">−55<em>%</em></div><div className="lbl">cost per lead</div></div>
                <div className="s"><div className="num">Top3</div><div className="lbl">positions reached</div></div>
                <div className="s"><div className="num">3<em>mo</em></div><div className="lbl">average time to results</div></div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">01</span>What We Deliver</div>
            <div>
              <h2 className="sec-title">SEO services for Antalya and Turkey</h2>
              <p className="sec-sub">Every engagement starts with a technical baseline, then builds semantic structure and authority on top of it — in that order, not the reverse.</p>
            </div>
          </div>
          <div className="deliv">
            {[
              { title: 'Technical SEO Audit', desc: 'Full crawl analysis, Core Web Vitals, indexation status, structured data validation, mobile usability, robots.txt and sitemap review. Actionable fix list with priorities.' },
              { title: 'Keyword Research', desc: 'Semantic core in Turkish, English, and Russian. Commercial, informational, and local intent. Grouped by page and funnel stage.' },
              { title: 'On-Page Optimisation', desc: 'Titles, meta descriptions, heading structure, canonical tags, hreflang, internal linking. Applied directly or provided as clear instructions for your team.' },
              { title: 'Content Strategy', desc: 'Content clusters mapped to target keywords. Article briefs, SEO copywriting, translation and localisation for multilingual sites.' },
              { title: 'Link Building', desc: 'White-hat link acquisition from relevant Turkish, Russian, and international sites. Outreach-based, no PBNs. Domain authority growth tracked monthly.' },
              { title: 'Local SEO', desc: 'Google Business Profile optimisation, local citation building, NAP consistency, schema markup for local businesses in Antalya and across Turkey.' },
              { title: 'Multilingual hreflang Setup', desc: 'Correct hreflang implementation for EN/RU/TR sites, avoiding duplicate-content penalties and ensuring each market sees the right language version.' },
              { title: 'SEO for AI Search', desc: 'Structuring content with clear answers, FAQ schema, and entity-rich copy so AI search engines and chat assistants can cite your pages accurately.' },
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
            <div className="sec-tag"><span className="num">02</span>Tools</div>
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
            <div className="sec-tag"><span className="num">03</span>Process</div>
            <div><h2 className="sec-title">How we work</h2></div>
          </div>
          <div className="pmini">
            {[
              { n: '01', h: 'Audit & Diagnostics', d: 'Full technical and content audit across 200+ factors. We identify what is blocking rankings today.' },
              { n: '02', h: 'Strategy & Semantics', d: 'Keyword clusters mapped to your site structure and to each target language.' },
              { n: '03', h: 'Technical Optimisation', d: 'Fixes applied directly to the codebase or handed to your team as a prioritised backlog.' },
              { n: '04', h: 'Content & Links', d: 'Ongoing content production and outreach-based link building, measured monthly against position data.' },
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
            <div className="sec-tag"><span className="num">04</span>Pricing</div>
            <div><h2 className="sec-title">Transparent pricing</h2></div>
          </div>
          <div className="pricing">
            <div className="tier">
              <div className="tier-badge">ONE-TIME</div>
              <div className="tier-name">Audit</div>
              <div className="tier-sub">Technical + content audit</div>
              <div className="tier-price">from €1,500</div>
              <ul className="tier-incl">
                <li>Technical audit (200+ factors)</li>
                <li>Semantic and content analysis</li>
                <li>Link profile audit</li>
                <li>Prioritised fixes plan</li>
                <li>Presentation with recommendations</li>
              </ul>
              <a href={h('#contact')} className="btn btn-ghost">Discuss<span className="arrow">↗</span></a>
            </div>
            <div className="tier featured">
              <div className="tier-badge">POPULAR</div>
              <div className="tier-name">Growth</div>
              <div className="tier-sub">Comprehensive SEO</div>
              <div className="tier-price">from €3,500<em>/mo</em></div>
              <ul className="tier-incl">
                <li>Technical optimisation</li>
                <li>SEO content (4–8 pieces/mo)</li>
                <li>Internal linking</li>
                <li>Link building</li>
                <li>Monthly position report</li>
              </ul>
              <a href={h('#contact')} className="btn">Request Audit<span className="arrow">↗</span></a>
            </div>
            <div className="tier">
              <div className="tier-badge">SCALE</div>
              <div className="tier-name">Multilingual</div>
              <div className="tier-sub">Dedicated SEO team, EN/RU/TR</div>
              <div className="tier-price">from €6,500<em>/mo</em></div>
              <ul className="tier-incl">
                <li>SEO strategist + tech SEO + editor</li>
                <li>Content factory in 3 languages</li>
                <li>Outreach and PR links</li>
                <li>Monthly strategy session</li>
              </ul>
              <a href={h('#contact')} className="btn btn-ghost">Discuss<span className="arrow">↗</span></a>
            </div>
          </div>
        </div>
      </section>

      <RelatedCases
        num="05"
        tag="Cases"
        heading="SEO results we have delivered"
        allLabel="All cases"
        keywords={['seo', 'organic', 'search']}
      />

      <section>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">06</span>FAQ</div>
            <div><h2 className="sec-title">Questions about SEO in Antalya</h2></div>
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
        num="07"
        tag="Related Services"
        heading="Pair SEO with"
        items={[
          { title: 'Digital Marketing Agency in Antalya', desc: 'The full marketing stack, with SEO as one of several coordinated channels.', to: p('/digital-marketing-agency-antalya') },
          { title: 'Web Development in Antalya', desc: 'A fast, SEO-ready site is the foundation every SEO campaign needs.', to: p('/web-development-antalya') },
          { title: 'Marketing Analytics', desc: 'Track organic traffic and its real contribution to revenue.', to: p('/services/analytics') },
        ]}
      />

      <section>
        <div className="wrap" style={{ textAlign: 'center', padding: '80px 0' }}>
          <h2 className="sec-title">Get a free SEO audit for your site</h2>
          <p style={{ marginBottom: 32, color: 'var(--muted)' }}>We'll review your site's current SEO state and identify the biggest growth opportunities.</p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href={h('#contact')} className="btn btn-primary">Request an SEO audit<span className="arrow">↗</span></a>
            <Link to={p('/cases')} className="btn btn-ghost">See our cases<span className="arrow">↗</span></Link>
          </div>
        </div>
      </section>
    </>
  )
}
