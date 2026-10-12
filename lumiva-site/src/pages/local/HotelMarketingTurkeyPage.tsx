import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import PageSEO from '../../components/PageSEO'
import RelatedServices from '../../components/RelatedServices'
import RelatedCases from '../../components/RelatedCases'
import { useLangPath } from '../../hooks/useLangPath'

const faqItems = [
  {
    q: 'What is hotel marketing and what does it include?',
    a: 'Hotel marketing covers all activities that drive direct bookings and reduce OTA dependency: SEO in multiple languages, Google Ads and Meta Ads, email marketing, CRM for guest communication, website development, social media management, and content production.',
  },
  {
    q: 'How can a hotel in Turkey increase direct bookings?',
    a: 'The most effective ways to increase direct bookings: (1) SEO for branded and destination keywords in Russian, English, and German, (2) Google Hotel Ads, (3) a fast, multilingual hotel website with booking engine, (4) email remarketing to past guests, (5) CRM to track and convert direct inquiries.',
  },
  {
    q: 'How much does hotel marketing cost in Turkey?',
    a: 'Full hotel marketing management (SEO + performance ads + CRM) starts from €8,000/month. Standalone SEO retainer starts from €3,500/month. Google Ads management starts from €2,500/month plus ad spend. We work with hotels of all sizes in Antalya, Bodrum, Istanbul, and beyond.',
  },
  {
    q: 'Do you work with all-inclusive hotels in Antalya?',
    a: 'Yes. We have experience with all-inclusive resorts, boutique hotels, and hotel chains in the Antalya region. We understand the seasonal patterns, key source markets (Russia, Germany, UK, Ukraine, CIS), and the competitive OTA landscape.',
  },
  {
    q: 'Can you create a multilingual hotel website?',
    a: 'Yes. We build hotel websites in Turkish, English, Russian, and German. Each language version has its own SEO strategy, keyword targeting, and localised content. We implement hreflang correctly and ensure Google indexes all language versions.',
  },
  {
    q: 'What results can a hotel expect from digital marketing?',
    a: 'Typical results after 6–12 months: 20–40% increase in direct booking revenue, 15–30% reduction in OTA commission spend, top-3 Google rankings for branded and destination keywords, and improved guest communication efficiency via CRM.',
  },
  {
    q: 'Do you handle seasonal campaign planning for hotels?',
    a: 'Yes. Hotel demand in Turkey is highly seasonal — we build media plans around booking windows (early-bird, peak season, last-minute) and adjust budget allocation across channels as the season progresses.',
  },
  {
    q: 'Can you integrate marketing with our existing PMS or booking engine?',
    a: 'Yes. We integrate CRM and analytics with most major property management systems and booking engines, so inquiry and booking data flows automatically without manual entry by your front-desk or reservations team.',
  },
]

export default function HotelMarketingTurkeyPage() {
  const { i18n } = useTranslation()
  const { p, h } = useLangPath()

  const jsonLd = [
    {
      '@context': 'https://schema.org',
      '@type': 'Service',
      name: 'Hotel Marketing Agency in Turkey',
      provider: { '@type': 'LocalBusiness', name: 'Lumiva Agency', url: 'https://lumiva.agency', telephone: '+90-538-365-96-78', address: { '@type': 'PostalAddress', addressLocality: 'Antalya', addressCountry: 'TR' } },
      areaServed: [{ '@type': 'Country', name: 'Turkey' }, { '@type': 'City', name: 'Antalya' }],
      serviceType: 'Hotel Marketing',
      description: 'Hotel marketing agency in Turkey specialising in direct booking growth, multilingual SEO, Google Ads, and CRM for hotels and resorts in Antalya, Bodrum, and Istanbul.',
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

  const tools = ['Google Hotel Ads', 'Google Ads', 'Meta Ads', 'GA4', 'Yandex Metrica', 'Lumiva CRM', 'Looker Studio', 'Semrush', 'Mailchimp', 'Telegram', 'Instagram']

  return (
    <>
      <PageSEO
        title="Hotel Marketing Agency in Turkey"
        description="Lumiva Agency is a hotel marketing agency in Turkey helping hotels and resorts increase direct bookings through SEO, Google Ads, CRM, and multilingual website development. Based in Antalya."
        path="/hotel-marketing-agency-turkey"
        jsonLd={jsonLd}
      />

      <header className="page-hero">
        <div className="wrap">
          <div className="crumbs">
            <Link to={p('/')}>Home</Link><span className="sep">/</span>
            <span>Hotel Marketing Agency Turkey</span>
          </div>
          <div className="page-hero-grid">
            <div>
              <div className="page-eyebrow">Hotel Marketing · Turkey</div>
              <h1 className="page-title">Hotel Marketing Agency in Turkey</h1>
            </div>
            <div className="page-hero-side">
              <p>Lumiva Agency helps hotels and resorts in Turkey grow direct booking revenue and reduce OTA dependency. We combine SEO in 3 languages, Google Ads, CRM, and website development into a single marketing system built around your booking calendar, not a generic retainer.</p>
              <div className="page-hero-actions">
                <a href={h('#contact')} className="btn btn-primary">Book a strategy call<span className="arrow">↗</span></a>
                <Link to={p('/cases')} className="btn btn-ghost">Hotel cases<span className="arrow">↗</span></Link>
              </div>
              <div className="hero-side-stats">
                <div className="s"><div className="num">+34<em>%</em></div><div className="lbl">direct booking growth</div></div>
                <div className="s"><div className="num">−28<em>%</em></div><div className="lbl">OTA commission spend</div></div>
                <div className="s"><div className="num">3</div><div className="lbl">languages: EN / RU / TR</div></div>
                <div className="s"><div className="num">6<em>mo</em></div><div className="lbl">average time to results</div></div>
              </div>
            </div>
          </div>
        </div>
      </header>

      <section>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">01</span>Services</div>
            <div>
              <h2 className="sec-title">Hotel marketing services in Turkey</h2>
              <p className="sec-sub">Every channel is built around your booking calendar — early-bird, peak season, and last-minute demand each need a different mix of SEO, paid media, and CRM follow-up.</p>
            </div>
          </div>
          <div className="deliv">
            {[
              { title: 'Multilingual Hotel SEO', desc: 'SEO strategy in Russian, English, Turkish, and German. Target destination keywords ("hotels in Antalya", "all-inclusive Turkey"), brand queries, and comparison terms. Hreflang, technical SEO, and content production included.' },
              { title: 'Google Hotel Ads & PPC', desc: 'Google Hotel Ads to appear directly in the booking comparison box. Plus Search and Display campaigns for brand protection and demand capture in key source markets.' },
              { title: 'Direct Booking Website', desc: 'Fast, multilingual hotel website with integrated booking engine, SEO architecture, and conversion optimisation. Built in Next.js for maximum performance and Google Core Web Vitals compliance.' },
              { title: 'Hotel CRM', desc: 'CRM system for managing direct inquiries, group bookings, corporate accounts, and guest communication via email, WhatsApp, and phone. Reduces response time and increases conversion from inquiry to booking.' },
              { title: 'Email Marketing', desc: 'Guest retention campaigns: post-stay review requests, early booking offers, loyalty updates, and seasonal promotions. Automated and personalised by guest segment.' },
              { title: 'Social Media & Content', desc: 'Hotel social media management on Instagram, Facebook, and VK. Photo and video content, Stories, and paid social campaigns for brand awareness and direct booking prompts.' },
              { title: 'Seasonal Campaign Planning', desc: 'Media plans aligned to your booking window — early-bird, peak season, and last-minute — with budget reallocated dynamically as the season progresses.' },
              { title: 'OTA Rate Parity & Strategy', desc: 'Guidance on rate parity strategy across OTAs and your direct channel, so direct booking incentives do not trigger parity disputes with major platforms.' },
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
            <div><h2 className="sec-title">Platforms we use</h2></div>
          </div>
          <div className="stack">
            {tools.map(c => <span key={c} className="chip"><span className="pip" />{c}</span>)}
          </div>
        </div>
      </section>

      <section>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">03</span>How We Work</div>
            <div><h2 className="sec-title">Our hotel marketing process</h2></div>
          </div>
          <div className="pmini">
            {[
              { n: '01', h: 'Discovery & Audit', d: 'We audit your current digital presence: website, SEO rankings, ad campaigns, booking channels, and competitive landscape. Output: a ranked list of opportunities and blockers.' },
              { n: '02', h: 'Strategy & Plan', d: 'We define target markets, seasonal priorities, channel mix, and KPIs. 90-day roadmap with clear deliverables and expected results at each stage.' },
              { n: '03', h: 'Execution', d: 'Website, SEO, ads, CRM, and content are launched in parallel or in sequence based on priority. Dedicated project manager, weekly status updates.' },
              { n: '04', h: 'Measurement & Optimisation', d: 'Monthly analytics reports with booking attribution, SEO position tracking, ad performance, and CRM conversion data. We iterate based on what works.' },
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
            <div><h2 className="sec-title">Engagement options</h2></div>
          </div>
          <div className="pricing">
            <div className="tier">
              <div className="tier-badge">START</div>
              <div className="tier-name">SEO Retainer</div>
              <div className="tier-sub">Organic visibility only</div>
              <div className="tier-price">from €3,500<em>/mo</em></div>
              <ul className="tier-incl">
                <li>Multilingual SEO (up to 2 languages)</li>
                <li>Monthly content production</li>
                <li>Monthly position report</li>
              </ul>
              <a href={h('#contact')} className="btn btn-ghost">Discuss<span className="arrow">↗</span></a>
            </div>
            <div className="tier featured">
              <div className="tier-badge">POPULAR</div>
              <div className="tier-name">Full Stack</div>
              <div className="tier-sub">SEO + Ads + CRM, coordinated</div>
              <div className="tier-price">from €8,000<em>/mo</em></div>
              <ul className="tier-incl">
                <li>SEO in 3 languages</li>
                <li>Google Hotel Ads + Search/Display</li>
                <li>CRM for direct inquiries</li>
                <li>Email marketing automation</li>
                <li>Monthly booking attribution report</li>
              </ul>
              <a href={h('#contact')} className="btn">Book a strategy call<span className="arrow">↗</span></a>
            </div>
            <div className="tier">
              <div className="tier-badge">SCALE</div>
              <div className="tier-name">Multi-Property</div>
              <div className="tier-sub">Hotel chains and groups</div>
              <div className="tier-price">Custom</div>
              <ul className="tier-incl">
                <li>Dedicated team per property cluster</li>
                <li>Group-level reporting and benchmarking</li>
                <li>Centralised CRM across properties</li>
              </ul>
              <a href={h('#contact')} className="btn btn-ghost">Discuss<span className="arrow">↗</span></a>
            </div>
          </div>
        </div>
      </section>

      <RelatedCases
        num="05"
        tag="Cases"
        heading="Hospitality results we have delivered"
        allLabel="All cases"
        keywords={['hotel', 'hospitality', 'travel', 'tourism']}
      />

      <section>
        <div className="wrap">
          <div className="sec-head">
            <div className="sec-tag"><span className="num">06</span>FAQ</div>
            <div><h2 className="sec-title">Hotel marketing questions</h2></div>
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
        heading="Pair hotel marketing with"
        items={[
          { title: 'CRM Development in Turkey', desc: 'A CRM built specifically around guest communication and group bookings.', to: p('/crm-development-turkey') },
          { title: 'SEO Agency in Antalya', desc: 'Deeper multilingual SEO for destination and brand keywords.', to: p('/seo-agency-antalya') },
          { title: 'Web Development in Antalya', desc: 'A faster, multilingual booking website built to convert.', to: p('/web-development-antalya') },
        ]}
      />

      <section>
        <div className="wrap" style={{ textAlign: 'center', padding: '80px 0' }}>
          <h2 className="sec-title">Ready to grow direct bookings for your hotel?</h2>
          <p style={{ marginBottom: 32, color: 'var(--muted)' }}>Book a strategy call. We'll audit your current digital presence and propose a growth plan within 3 business days.</p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <a href={h('#contact')} className="btn btn-primary">Book a strategy call<span className="arrow">↗</span></a>
            <Link to={p('/services/seo')} className="btn btn-ghost">Hotel SEO services<span className="arrow">↗</span></Link>
          </div>
        </div>
      </section>
    </>
  )
}
