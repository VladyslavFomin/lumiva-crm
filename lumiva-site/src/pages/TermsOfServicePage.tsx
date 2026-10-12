import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import PageSEO from '../components/PageSEO'
import { useLangPath } from '../hooks/useLangPath'

export default function TermsOfServicePage() {
  const { t } = useTranslation()
  const { p } = useLangPath()

  return (
    <>
      <PageSEO
        title="Terms of Service"
        description="Terms of service for Lumiva Agency — rules governing the use of lumiva.agency and the provision of digital marketing, web development, and CRM services."
        path="/terms-of-service"
      />

      <section style={{ paddingTop: 120 }}>
        <div className="wrap" style={{ maxWidth: 760 }}>
          <div className="crumbs" style={{ marginBottom: 32 }}>
            <Link to={p('/')}>Home</Link><span className="sep">/</span>
            <span>Terms of Service</span>
          </div>

          <h1 style={{ fontSize: 'clamp(28px, 4vw, 48px)', marginBottom: 8 }}>Terms of Service</h1>
          <p style={{ color: 'var(--muted)', marginBottom: 48 }}>Last updated: June 21, 2026</p>

          <div className="prose" style={{ lineHeight: 1.7, color: 'rgba(255,255,255,0.85)' }}>

            <h2>1. About Lumiva Agency</h2>
            <p>Lumiva Agency ("Lumiva", "we", "us", or "our") is a digital marketing studio based in Antalya, Turkey, providing services including SEO, performance marketing, web development, CRM development, brand design, analytics, and content production.</p>
            <p>Website: <a href="https://lumiva.agency">https://lumiva.agency</a><br />
            Email: <a href="mailto:vlad@lumiva.agency">vlad@lumiva.agency</a><br />
            Phone: <a href="tel:+905383659678">+90 538 365 96 78</a></p>

            <h2>2. Acceptance of Terms</h2>
            <p>By using the website lumiva.agency, submitting a contact form, or engaging Lumiva Agency for services, you agree to these Terms of Service. If you do not agree, please do not use this website or our services.</p>

            <h2>3. Services</h2>
            <p>Lumiva Agency provides the following categories of services:</p>
            <ul>
              <li>Search Engine Optimisation (SEO)</li>
              <li>Performance marketing (Google Ads, Meta Ads, Yandex Direct)</li>
              <li>Web development (websites, landing pages, e-commerce, SaaS)</li>
              <li>CRM development and implementation</li>
              <li>Brand identity and design</li>
              <li>Marketing analytics and BI</li>
              <li>Content production and social media management</li>
            </ul>
            <p>The specific scope, deliverables, timeline, and pricing for each engagement are defined in a separate Service Agreement or Statement of Work signed by both parties.</p>

            <h2>4. Intellectual Property</h2>
            <p>Upon full payment, all custom deliverables created specifically for the client (website code, design assets, content) become the intellectual property of the client, unless otherwise specified in the Service Agreement.</p>
            <p>Lumiva Agency retains the right to display work in its portfolio unless the client requests confidentiality in writing.</p>
            <p>Third-party tools, frameworks, fonts, and libraries used in delivery remain subject to their own licences.</p>

            <h2>5. Confidentiality</h2>
            <p>Lumiva Agency treats all client business information as confidential. We sign NDAs upon request. We do not share client data, strategies, or results with third parties without explicit written consent.</p>

            <h2>6. Payment Terms</h2>
            <p>Payment terms are defined in each Service Agreement. Standard terms are:</p>
            <ul>
              <li>50% prepayment before project commencement</li>
              <li>50% upon project completion or as agreed in milestones</li>
              <li>Retainer engagements are invoiced monthly in advance</li>
            </ul>
            <p>Late payments may result in work being paused until outstanding invoices are settled.</p>

            <h2>7. Limitation of Liability</h2>
            <p>Lumiva Agency's liability for any claim arising from service delivery is limited to the fees paid for the specific service in question during the preceding 3 months.</p>
            <p>We are not liable for indirect, incidental, or consequential damages, including loss of revenue, loss of data, or reputational damage.</p>

            <h2>8. Governing Law</h2>
            <p>These terms are governed by the laws of the Republic of Turkey. Any disputes shall be resolved in the competent courts of Antalya, Turkey.</p>

            <h2>9. Changes to These Terms</h2>
            <p>We may update these Terms of Service from time to time. The current version is always available at <a href="https://lumiva.agency/terms-of-service">lumiva.agency/terms-of-service</a>. Continued use of our services after an update constitutes acceptance of the revised terms.</p>

            <h2>10. Contact</h2>
            <p>For questions about these Terms of Service, contact us at <a href="mailto:vlad@lumiva.agency">vlad@lumiva.agency</a> or by phone at <a href="tel:+905383659678">+90 538 365 96 78</a>.</p>

          </div>

          <div style={{ marginTop: 64, paddingTop: 32, borderTop: '1px solid rgba(255,255,255,0.1)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <Link to={p('/privacy-policy')} className="btn btn-ghost">Privacy Policy<span className="arrow">↗</span></Link>
            <Link to={p('/cookie-policy')} className="btn btn-ghost">Cookie Policy<span className="arrow">↗</span></Link>
          </div>
        </div>
      </section>
    </>
  )
}
