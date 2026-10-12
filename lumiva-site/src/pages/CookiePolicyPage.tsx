import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import PageSEO from '../components/PageSEO'
import { useLangPath } from '../hooks/useLangPath'

export default function CookiePolicyPage() {
  const { t } = useTranslation()
  const { p } = useLangPath()

  return (
    <>
      <PageSEO
        title="Cookie Policy"
        description="Cookie Policy for lumiva.agency — how we use cookies, what data we collect, and how to manage cookie preferences."
        path="/cookie-policy"
      />

      <section style={{ paddingTop: 120 }}>
        <div className="wrap" style={{ maxWidth: 760 }}>
          <div className="crumbs" style={{ marginBottom: 32 }}>
            <Link to={p('/')}>Home</Link><span className="sep">/</span>
            <span>Cookie Policy</span>
          </div>

          <h1 style={{ fontSize: 'clamp(28px, 4vw, 48px)', marginBottom: 8 }}>Cookie Policy</h1>
          <p style={{ color: 'var(--muted)', marginBottom: 48 }}>Last updated: June 21, 2026</p>

          <div className="prose" style={{ lineHeight: 1.7, color: 'rgba(255,255,255,0.85)' }}>

            <h2>1. What Are Cookies</h2>
            <p>Cookies are small text files stored on your device when you visit a website. They are widely used to make websites work efficiently and to provide information to the website owner.</p>

            <h2>2. How We Use Cookies</h2>
            <p>The website lumiva.agency uses the following categories of cookies:</p>

            <h3>2.1 Strictly Necessary Cookies</h3>
            <p>These cookies are essential for the website to function. They include session cookies and cookies that remember your cookie consent preference. You cannot opt out of these cookies.</p>
            <ul>
              <li><strong>lumiva_cookie_consent_v1</strong> — stores your cookie consent choice. Duration: persistent (until cleared).</li>
            </ul>

            <h3>2.2 Analytics Cookies</h3>
            <p>We use analytics cookies to understand how visitors interact with the website. This helps us improve the site and our services. These cookies are set only after you provide consent.</p>
            <ul>
              <li><strong>Google Analytics 4 (GA4)</strong> — collects anonymised data about page views, session duration, traffic sources, and user interactions. Data is processed by Google LLC. <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google Privacy Policy</a></li>
              <li><strong>Yandex Metrica</strong> — collects data about site usage for analytics. Data is processed by Yandex LLC. <a href="https://yandex.com/legal/confidential/" target="_blank" rel="noopener noreferrer">Yandex Privacy Policy</a></li>
            </ul>

            <h3>2.3 Marketing Cookies</h3>
            <p>Marketing cookies may be set when you follow links from paid advertising campaigns. These allow us to measure the effectiveness of our marketing campaigns.</p>

            <h2>3. Third-Party Cookies</h2>
            <p>Some cookies on this site are set by third-party services. We do not control these cookies. Third parties with cookies on our site include:</p>
            <ul>
              <li>Google LLC (Google Analytics, Google Ads)</li>
              <li>Yandex LLC (Yandex Metrica)</li>
            </ul>

            <h2>4. Managing Cookie Preferences</h2>
            <p>You can manage your cookie preferences at any time:</p>
            <ul>
              <li><strong>Browser settings</strong> — most browsers allow you to block or delete cookies. See your browser's help documentation for instructions.</li>
              <li><strong>Google Analytics opt-out</strong> — install the <a href="https://tools.google.com/dlpage/gaoptout" target="_blank" rel="noopener noreferrer">Google Analytics Opt-out Browser Add-on</a>.</li>
              <li><strong>Cookie banner</strong> — you can revisit your consent choice by clearing your browser's local storage (key: <code>lumiva_cookie_consent_v1</code>).</li>
            </ul>
            <p>Note: blocking cookies may affect the functionality of some features on this site.</p>

            <h2>5. Data Retention</h2>
            <p>Analytics data collected via Google Analytics is retained for 26 months. Yandex Metrica data is retained for 12 months. Cookie consent records are kept as long as you maintain your consent choice in your browser.</p>

            <h2>6. Contact</h2>
            <p>If you have questions about our use of cookies, contact us at <a href="mailto:vlad@lumiva.agency">vlad@lumiva.agency</a>.</p>

          </div>

          <div style={{ marginTop: 64, paddingTop: 32, borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <Link to={p('/privacy-policy')} className="btn btn-ghost">Privacy Policy<span className="arrow">↗</span></Link>
            <Link to={p('/terms-of-service')} className="btn btn-ghost">Terms of Service<span className="arrow">↗</span></Link>
          </div>
        </div>
      </section>
    </>
  )
}
