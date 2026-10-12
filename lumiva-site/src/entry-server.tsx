import { renderToString } from 'react-dom/server'
import { StaticRouter } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import i18next from './i18n'
import { detectLangFromPath } from './i18n'

// Static imports — no lazy() in SSR
import HomePage from './pages/HomePage'
import ServicesPage from './pages/ServicesPage'
import DevelopmentPage from './pages/DevelopmentPage'
import DesignPage from './pages/DesignPage'
import AnalyticsPage from './pages/AnalyticsPage'
import StrategyPage from './pages/StrategyPage'
import PerformancePage from './pages/PerformancePage'
import ContentPage from './pages/ContentPage'
import SEOPage from './pages/SEOPage'
import SMMPage from './pages/SMMPage'
import NotFoundPage from './pages/NotFoundPage'
import BrandIdentityPage from './pages/design/BrandIdentityPage'
import BrandbookPage from './pages/design/BrandbookPage'
import VisualIdentityPage from './pages/design/VisualIdentityPage'
import ProductUIPage from './pages/design/ProductUIPage'
import PackagingPage from './pages/design/PackagingPage'
import EditorialPage from './pages/design/EditorialPage'
import MotionPage from './pages/design/MotionPage'
import EnvironmentalPage from './pages/design/EnvironmentalPage'
import SocialPage from './pages/design/SocialPage'
import CorporateSitesPage from './pages/dev/CorporateSitesPage'
import EcommercePage from './pages/dev/EcommercePage'
import SaasPage from './pages/dev/SaasPage'
import IntegrationsPage from './pages/dev/IntegrationsPage'
import LandingsPage from './pages/dev/LandingsPage'
import ConfiguratorsPage from './pages/dev/ConfiguratorsPage'
import MobilePage from './pages/dev/MobilePage'
import DevOpsPage from './pages/dev/DevOpsPage'
import BlogPage from './pages/BlogPage'
import BlogPostPage from './pages/BlogPostPage'
import CasesPage from './pages/CasesPage'
import CasePage from './pages/CasePage'
import PrivacyPolicyPage from './pages/PrivacyPolicyPage'
import TermsOfServicePage from './pages/TermsOfServicePage'
import CookiePolicyPage from './pages/CookiePolicyPage'
import DigitalMarketingAntalyaPage from './pages/local/DigitalMarketingAntalyaPage'
import SEOAgencyAntalyaPage from './pages/local/SEOAgencyAntalyaPage'
import WebDevelopmentAntalyaPage from './pages/local/WebDevelopmentAntalyaPage'
import CRMDevelopmentTurkeyPage from './pages/local/CRMDevelopmentTurkeyPage'
import HotelMarketingTurkeyPage from './pages/local/HotelMarketingTurkeyPage'

const PAGE_ROUTES = (
  <>
    <Route element={<Layout />}>
      <Route path="/" element={<HomePage />} />
      <Route path="/services" element={<ServicesPage />} />
      <Route path="/services/development" element={<DevelopmentPage />} />
      <Route path="/services/development/corporate-sites" element={<CorporateSitesPage />} />
      <Route path="/services/development/ecommerce" element={<EcommercePage />} />
      <Route path="/services/development/saas" element={<SaasPage />} />
      <Route path="/services/development/integrations" element={<IntegrationsPage />} />
      <Route path="/services/development/landings" element={<LandingsPage />} />
      <Route path="/services/development/configurators" element={<ConfiguratorsPage />} />
      <Route path="/services/development/mobile" element={<MobilePage />} />
      <Route path="/services/development/devops" element={<DevOpsPage />} />
      <Route path="/services/design" element={<DesignPage />} />
      <Route path="/services/design/brand-identity" element={<BrandIdentityPage />} />
      <Route path="/services/design/brandbook" element={<BrandbookPage />} />
      <Route path="/services/design/visual-identity" element={<VisualIdentityPage />} />
      <Route path="/services/design/product-ui" element={<ProductUIPage />} />
      <Route path="/services/design/packaging" element={<PackagingPage />} />
      <Route path="/services/design/editorial" element={<EditorialPage />} />
      <Route path="/services/design/motion" element={<MotionPage />} />
      <Route path="/services/design/environmental" element={<EnvironmentalPage />} />
      <Route path="/services/design/social" element={<SocialPage />} />
      <Route path="/services/analytics" element={<AnalyticsPage />} />
      <Route path="/services/strategy" element={<StrategyPage />} />
      <Route path="/services/performance" element={<PerformancePage />} />
      <Route path="/services/content" element={<ContentPage />} />
      <Route path="/services/seo" element={<SEOPage />} />
      <Route path="/services/smm" element={<SMMPage />} />
      <Route path="/blog" element={<BlogPage />} />
      <Route path="/blog/:slug" element={<BlogPostPage />} />
      <Route path="/cases" element={<CasesPage />} />
      <Route path="/cases/:slug" element={<CasePage />} />
      <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
      <Route path="/terms-of-service" element={<TermsOfServicePage />} />
      <Route path="/cookie-policy" element={<CookiePolicyPage />} />
      <Route path="/digital-marketing-agency-antalya" element={<DigitalMarketingAntalyaPage />} />
      <Route path="/seo-agency-antalya" element={<SEOAgencyAntalyaPage />} />
      <Route path="/web-development-antalya" element={<WebDevelopmentAntalyaPage />} />
      <Route path="/crm-development-turkey" element={<CRMDevelopmentTurkeyPage />} />
      <Route path="/hotel-marketing-agency-turkey" element={<HotelMarketingTurkeyPage />} />
    </Route>

    <Route path="/ru" element={<Layout />}>
      <Route index element={<HomePage />} />
      <Route path="services" element={<ServicesPage />} />
      <Route path="services/development" element={<DevelopmentPage />} />
      <Route path="services/development/corporate-sites" element={<CorporateSitesPage />} />
      <Route path="services/development/ecommerce" element={<EcommercePage />} />
      <Route path="services/development/saas" element={<SaasPage />} />
      <Route path="services/development/integrations" element={<IntegrationsPage />} />
      <Route path="services/development/landings" element={<LandingsPage />} />
      <Route path="services/development/configurators" element={<ConfiguratorsPage />} />
      <Route path="services/development/mobile" element={<MobilePage />} />
      <Route path="services/development/devops" element={<DevOpsPage />} />
      <Route path="services/design" element={<DesignPage />} />
      <Route path="services/design/brand-identity" element={<BrandIdentityPage />} />
      <Route path="services/design/brandbook" element={<BrandbookPage />} />
      <Route path="services/design/visual-identity" element={<VisualIdentityPage />} />
      <Route path="services/design/product-ui" element={<ProductUIPage />} />
      <Route path="services/design/packaging" element={<PackagingPage />} />
      <Route path="services/design/editorial" element={<EditorialPage />} />
      <Route path="services/design/motion" element={<MotionPage />} />
      <Route path="services/design/environmental" element={<EnvironmentalPage />} />
      <Route path="services/design/social" element={<SocialPage />} />
      <Route path="services/analytics" element={<AnalyticsPage />} />
      <Route path="services/strategy" element={<StrategyPage />} />
      <Route path="services/performance" element={<PerformancePage />} />
      <Route path="services/content" element={<ContentPage />} />
      <Route path="services/seo" element={<SEOPage />} />
      <Route path="services/smm" element={<SMMPage />} />
      <Route path="blog" element={<BlogPage />} />
      <Route path="blog/:slug" element={<BlogPostPage />} />
      <Route path="cases" element={<CasesPage />} />
      <Route path="cases/:slug" element={<CasePage />} />
      <Route path="privacy-policy" element={<PrivacyPolicyPage />} />
    </Route>

    <Route path="/tr" element={<Layout />}>
      <Route index element={<HomePage />} />
      <Route path="services" element={<ServicesPage />} />
      <Route path="services/development" element={<DevelopmentPage />} />
      <Route path="services/development/corporate-sites" element={<CorporateSitesPage />} />
      <Route path="services/development/ecommerce" element={<EcommercePage />} />
      <Route path="services/development/saas" element={<SaasPage />} />
      <Route path="services/development/integrations" element={<IntegrationsPage />} />
      <Route path="services/development/landings" element={<LandingsPage />} />
      <Route path="services/development/configurators" element={<ConfiguratorsPage />} />
      <Route path="services/development/mobile" element={<MobilePage />} />
      <Route path="services/development/devops" element={<DevOpsPage />} />
      <Route path="services/design" element={<DesignPage />} />
      <Route path="services/design/brand-identity" element={<BrandIdentityPage />} />
      <Route path="services/design/brandbook" element={<BrandbookPage />} />
      <Route path="services/design/visual-identity" element={<VisualIdentityPage />} />
      <Route path="services/design/product-ui" element={<ProductUIPage />} />
      <Route path="services/design/packaging" element={<PackagingPage />} />
      <Route path="services/design/editorial" element={<EditorialPage />} />
      <Route path="services/design/motion" element={<MotionPage />} />
      <Route path="services/design/environmental" element={<EnvironmentalPage />} />
      <Route path="services/design/social" element={<SocialPage />} />
      <Route path="services/analytics" element={<AnalyticsPage />} />
      <Route path="services/strategy" element={<StrategyPage />} />
      <Route path="services/performance" element={<PerformancePage />} />
      <Route path="services/content" element={<ContentPage />} />
      <Route path="services/seo" element={<SEOPage />} />
      <Route path="services/smm" element={<SMMPage />} />
      <Route path="blog" element={<BlogPage />} />
      <Route path="blog/:slug" element={<BlogPostPage />} />
      <Route path="cases" element={<CasesPage />} />
      <Route path="cases/:slug" element={<CasePage />} />
      <Route path="privacy-policy" element={<PrivacyPolicyPage />} />
    </Route>

    <Route path="*" element={<NotFoundPage />} />
  </>
)

function ServerApp({ url }: { url: string }) {
  return (
    <StaticRouter location={url}>
      <Routes>
        {PAGE_ROUTES}
      </Routes>
    </StaticRouter>
  )
}

// react-helmet-async v3 + React 19 renders head tags inline in appHtml during SSR.
// title/meta/link are hoisted to the front; script[ld+json] stay at their component position.
function extractHeadHtml(appHtml: string): { headHtml: string; cleanAppHtml: string } {
  // Step 1: pull leading head-level tags from the start of appHtml
  const leadingSegments: string[] = []
  let rest = appHtml

  const leadingPatterns = [
    /^<title[^>]*>[\s\S]*?<\/title>/,
    /^<html[^>]*\/?>/,
    /^<base[^>]*\/?>/,
    /^<meta[^>]*\/?>/,
    /^<link[^>]*\/?>/,
  ]

  let found = true
  while (found && rest.length > 0) {
    found = false
    for (const pat of leadingPatterns) {
      const m = rest.match(pat)
      if (m) {
        leadingSegments.push(m[0])
        rest = rest.slice(m[0].length)
        found = true
        break
      }
    }
  }

  // Step 2: extract all JSON-LD scripts from anywhere in the remaining body
  const ldSegments: string[] = []
  const cleanBody = rest.replace(
    /<script type="application\/ld\+json">[\s\S]*?<\/script>/g,
    (match) => { ldSegments.push(match); return '' }
  )

  const headHtml = [...leadingSegments, ...ldSegments].join('\n    ')
  return { headHtml, cleanAppHtml: cleanBody }
}

export function render(url: string) {
  const lang = detectLangFromPath(url)
  i18next.changeLanguage(lang)

  const helmetContext: Record<string, unknown> = {}

  const rawAppHtml = renderToString(
    <HelmetProvider context={helmetContext}>
      <ServerApp url={url} />
    </HelmetProvider>
  )

  const { headHtml, cleanAppHtml } = extractHeadHtml(rawAppHtml)

  return { appHtml: cleanAppHtml, headHtml }
}
