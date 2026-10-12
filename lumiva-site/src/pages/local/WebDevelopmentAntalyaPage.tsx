import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import PageSEO from '../../components/PageSEO'
import RelatedServices from '../../components/RelatedServices'
import RelatedCases from '../../components/RelatedCases'
import { useLangPath } from '../../hooks/useLangPath'

const faqItems = [
  {
    q: 'How much does web development cost in Antalya?',
    a: 'A corporate website or landing page starts from €6,000–€15,000. E-commerce platforms start from €18,000. SaaS and custom web applications start from €30,000. The exact budget depends on complexity, integrations, and CMS requirements. We provide a fixed-price estimate after a discovery call.',
  },
  {
    q: 'How long does website development take in Antalya?',
    a: 'Landing pages: 2–3 weeks. Corporate websites: 4–8 weeks. E-commerce: 10–14 weeks. SaaS and complex web applications: 12–20 weeks. All timelines assume approved designs and content delivery on schedule.',
  },
  {
    q: 'What technologies do you use for web development?',
    a: 'We build with Next.js, React, TypeScript, and Tailwind CSS for the frontend. Node.js, PostgreSQL, and Redis for backend. Sanity, Contentful, or Strapi for CMS. Vercel, AWS, and Cloudflare for infrastructure.',
  },
  {
    q: 'Do you build SEO-friendly websites in Antalya?',
    a: 'Yes. Every site we build includes Core Web Vitals optimisation, proper heading structure, canonical tags, sitemap, schema markup, hreflang for multilingual sites, and fast page load times. SEO is part of the development process, not an afterthought.',
  },
  {
    q: 'Can you redesign an existing website?',
    a: 'Yes. We handle full redesigns, migrations from WordPress to Next.js, and performance optimisation of existing sites. We preserve SEO equity during migrations and handle 301 redirects systematically.',
  },
  {
    q: 'Do you provide server-side rendering or static generation?',
    a: 'Yes. For marketing and content-heavy sites we use static prerendering so every page loads instantly and is fully visible to search engines without requiring JavaScript execution — critical for SEO and Core Web Vitals.',
  },
  {
    q: 'Will I be able to update content myself after launch?',
    a: 'Yes. We build on headless CMS platforms (Sanity, Contentful, Strapi) so your team can publish and edit pages, blog posts, and case studies without needing a developer for routine content changes.',
  },
  {
    q: 'Do you offer ongoing maintenance after launch?',
    a: 'Yes. All projects include a post-launch support period, and we offer ongoing retainers with uptime SLAs up to 99.99% for clients who want a dedicated team monitoring and improving the site long-term.',
  },
]

export default function WebDevelopmentAntalyaPage() {
  const { i18n } = useTranslation()
  const { p, h } = useLangPath()

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Service',
      name: 'Web Development in Antalya',
      provider: { '@type': 'LocalBusiness', name: 'Lumiva Agency', url: 'https://lumiva.agency', telephone: '+90-538-365-96-78', address: { '@type': 'PostalAddress', addressLocality: 'Antalya', addressCountry: 'TR' } },
      areaServed: [{ '@type': 'City', name: 'Antalya' }, { '@type': 'Country', name: 'Turkey' }],
      serviceType: 'Web Development',
      description: 'Web development agency in Antalya. Corporate websites, landing pages, e-commerce, and SaaS development with React, Next.js, and modern tech stack.',
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

  const stacks: Record<string, string[]> = {
    Frontend: ['React', 'Next.js', 'TypeScript', 'Tailwind CSS', 'Framer Motion', 'GSAP'],
    Backend: ['Node.js', 'PostgreSQL', 'Redis', 'BullMQ'],
    CMS: ['Sanity', 'Contentful', 'Strapi', 'Directus'],
    'Infrastructure': ['Vercel', 'Cloudflare', 'AWS', 'Docker', 'GitHub Actions'],
  }

  return (
    <>
      <PageSEO
        title="Web Development in Antalya"
        description="Lumiva Agency builds modern websites, e-commerce stores, and SaaS applications in Antalya. React, Next.js, headless CMS. SEO-ready, fast, and built to convert."
        path="/web-development-antalya"
        jsonLd={jsonLd}
      />

      <header className="page-hero">
        <div className="wrap">
          <div className="crumbs">
            <Link to={p('/')}>Home</Link><span className="sep">/</span>
            <span>Web Development Antalya</span>
          </div>
          <div className="page-hero-grid">
            <div>
              <div className="page-eyebrow">Web Development · Antalya</div>
              <h1 className="page-title">Web Development in Antalya</h1>
            </div>
            <div className="page-hero-side">
              <p>Lumiva Agency is a web development studio in Antalya building corporate websites, e-commerce platforms, landing pages, and SaaS applications. We use React, Next.js, and modern headless CMS architecture — designed for speed, SEO, and conversion from day one.</p>
              <div className="page-hero-actions">
                <a href={h('#contact')} className="btn btn-primary">Discuss your project<span className="arrow">↗</span></a>
                <Link to={p('/services/development')} className="btn btn-ghost">Development services<span className="arrow">↗</span></Link>
              </div>
              <div className="hero-side-stats">
                <div className="s"><div className="num">38<em>+</em></div><div className="lbl">sites in production</div></div>
                <div className="s"><div className="num">99.97<em>%</em></div><div className="lbl">average uptime</div></div>
                <div className="s"><div className="num">&lt;1.2<em>s</em></div><div className="lbl">LCP on 3G</div></div>
                <div className="s"><div className="num">2<em>-14wk</em></div><div className="lbl">typical delivery window</div></div>
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
              <h2 className="sec-title">Web development formats we offer in Antalya</h2>
              <p className="sec-sub">From a single landing page to a full multi-tenant SaaS platform — built on the same performance-first foundation regardless of scope.</p>
            </div>
          </div>
          <div className="deliv">
            {[
              { title: 'Corporate Websites', desc: 'Multi-page websites for businesses, agencies, clinics, law firms, and services companies. Fast, SEO-ready, with content management via headless CMS.' },
              { title: 'Landing Pages', desc: 'Conversion-focused single-page sites for campaigns, products, and service offerings. A/B testing ready, built to track leads and conversions.' },
              { title: 'E-commerce Stores', desc: 'Full-featured online stores with payment integrations, inventory management, and CRM connectivity. Launch in 10–14 weeks.' },
              { title: 'SaaS Applications', desc: 'Multi-tenant web apps with user roles, billing, and API. MVP in 8–12 weeks. React frontend, Node.js backend, PostgreSQL.' },
              { title: 'Hotel Websites', desc: 'Direct booking websites for hotels and resorts in Antalya. Booking engine integration, multilingual support, SEO in Russian, English, and Turkish.' },
              { title: 'Integrations & APIs', desc: 'CRM integrations, payment systems, third-party APIs. We connect your website to any external system via REST or GraphQL.' },
              { title: 'Web App Redesigns', desc: 'Full redesigns and platform migrations of existing sites, preserving SEO equity through systematic 301 redirects and content migration.' },
              { title: 'Performance Audits', desc: 'Core Web Vitals diagnostics and fixes for existing sites — image optimisation, code splitting, font loading, and render-blocking script removal.' },
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
            <div className="sec-tag"><span className="num">02</span>Tech Stack</div>
            <div><h2 className="sec-title">Technologies we use</h2></div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
            {Object.entries(stacks).map(([label, chips]) => (
              <div key={label}>
                <div className="sec-tag" style={{ marginBottom: 12 }}><span className="num">{label[0]}</span>{label}</div>
                <div className="stack">
                  {chips.map(c => <span key={c} className="chip"><span className="pip" />{c}</span>)}
                </div>
              </div>
            ))}
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
              { n: '01', h: 'Discovery & UX', d: 'Audience, competitor and site analysis. Interactive prototype before design starts — we align on logic, not pixels.' },
              { n: '02', h: 'Architecture & Design', d: 'Unique Figma design with components, themes and guidelines. Responsive layout for all resolutions and browsers.' },
              { n: '03', h: 'Iterative Development', d: 'Layout, CMS, API, CRM. Two-week sprints with demos. No black boxes.' },
              { n: '04', h: 'Launch & Growth', d: 'Post-launch monitoring, updates, A/B tests. SLA on response time and improvement roadmap.' },
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
              <div className="tier-badge">START</div>
              <div className="tier-name">Sprint</div>
              <div className="tier-sub">Landing or lightweight site</div>
              <div className="tier-price">from €1,800</div>
              <ul className="tier-incl">
                <li>Up to 4 weeks</li>
                <li>UX + design + development</li>
                <li>Basic analytics</li>
                <li>1 month support</li>
              </ul>
              <a href={h('#contact')} className="btn btn-ghost">Discuss<span className="arrow">↗</span></a>
            </div>
            <div className="tier featured">
              <div className="tier-badge">POPULAR</div>
              <div className="tier-name">Project</div>
              <div className="tier-sub">Corporate site / e-commerce</div>
              <div className="tier-price">from €12,000</div>
              <ul className="tier-incl">
                <li>6–14 weeks</li>
                <li>UX research, design system</li>
                <li>CRM/ERP integrations</li>
                <li>A/B tests post-launch</li>
                <li>3 months support</li>
              </ul>
              <a href={h('#contact')} className="btn">Request a Quote<span className="arrow">↗</span></a>
            </div>
            <div className="tier">
              <div className="tier-badge">LONG-TERM</div>
              <div className="tier-name">Retainer</div>
              <div className="tier-sub">Dedicated team 3–6 people</div>
              <div className="tier-price">from €2,200<em>/mo</em></div>
              <ul className="tier-incl">
                <li>SLA 99.99%</li>
                <li>Roadmap and iterations</li>
                <li>Priority 24/7 support</li>
              </ul>
              <a href={h('#contact')} className="btn btn-ghost">Discuss<span className="arrow">↗</span></a>
            </div>
          </div>
        </div>
      </section>

      <RelatedCases
        num="05"
        tag="Cases"
        heading="Websites we have shipped"
        allLabel="All cases"
        keywords={['development', 'website', 'web']}
      />

      <section>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">06</span>FAQ</div>
            <div><h2 className="sec-title">Web development questions</h2></div>
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
        heading="Pair web development with"
        items={[
          { title: 'SEO Agency in Antalya', desc: 'Build SEO foundations into the site from day one.', to: p('/seo-agency-antalya') },
          { title: 'Digital Marketing Agency in Antalya', desc: 'Turn the new site into a full marketing system.', to: p('/digital-marketing-agency-antalya') },
          { title: 'CRM Development in Turkey', desc: 'Connect your new site to a CRM built around your sales process.', to: p('/crm-development-turkey') },
        ]}
      />

      <section>
        <div className="wrap" style={{ textAlign: 'center', padding: '80px 0' }}>
          <h2 className="sec-title">Ready to build your website in Antalya?</h2>
          <p style={{ marginBottom: 32, color: 'var(--muted)' }}>Tell us about your project. We'll prepare a proposal within 3 business days.</p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href={h('#contact')} className="btn btn-primary">Request a proposal<span className="arrow">↗</span></a>
            <Link to={p('/cases')} className="btn btn-ghost">See our work<span className="arrow">↗</span></Link>
          </div>
        </div>
      </section>
    </>
  )
}
