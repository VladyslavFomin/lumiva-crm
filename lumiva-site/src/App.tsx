import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { lazy, Suspense, useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import Layout from './components/Layout'
import { detectLangFromPath } from './i18n'

const GOOGLE_TAG_ID = 'G-PY7330Q8X2'
const YANDEX_METRIKA_ID = 109183320

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
    ym?: (...args: unknown[]) => void
  }
}

const HomePage = lazy(() => import('./pages/HomePage'))
const ServicesPage = lazy(() => import('./pages/ServicesPage'))
const DevelopmentPage = lazy(() => import('./pages/DevelopmentPage'))
const DesignPage = lazy(() => import('./pages/DesignPage'))
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'))
const StrategyPage = lazy(() => import('./pages/StrategyPage'))
const PerformancePage = lazy(() => import('./pages/PerformancePage'))
const ContentPage = lazy(() => import('./pages/ContentPage'))
const SEOPage = lazy(() => import('./pages/SEOPage'))
const SMMPage = lazy(() => import('./pages/SMMPage'))
const PrivacyPolicyPage = lazy(() => import('./pages/PrivacyPolicyPage'))
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'))

const BrandIdentityPage = lazy(() => import('./pages/design/BrandIdentityPage'))
const BrandbookPage = lazy(() => import('./pages/design/BrandbookPage'))
const VisualIdentityPage = lazy(() => import('./pages/design/VisualIdentityPage'))
const ProductUIPage = lazy(() => import('./pages/design/ProductUIPage'))
const PackagingPage = lazy(() => import('./pages/design/PackagingPage'))
const EditorialPage = lazy(() => import('./pages/design/EditorialPage'))
const MotionPage = lazy(() => import('./pages/design/MotionPage'))
const EnvironmentalPage = lazy(() => import('./pages/design/EnvironmentalPage'))
const SocialPage = lazy(() => import('./pages/design/SocialPage'))

const CorporateSitesPage = lazy(() => import('./pages/dev/CorporateSitesPage'))
const EcommercePage = lazy(() => import('./pages/dev/EcommercePage'))
const SaasPage = lazy(() => import('./pages/dev/SaasPage'))
const IntegrationsPage = lazy(() => import('./pages/dev/IntegrationsPage'))
const LandingsPage = lazy(() => import('./pages/dev/LandingsPage'))
const ConfiguratorsPage = lazy(() => import('./pages/dev/ConfiguratorsPage'))
const MobilePage = lazy(() => import('./pages/dev/MobilePage'))
const DevOpsPage = lazy(() => import('./pages/dev/DevOpsPage'))
const BlogPage = lazy(() => import('./pages/BlogPage'))
const BlogPostPage = lazy(() => import('./pages/BlogPostPage'))
const CasePage = lazy(() => import('./pages/CasePage'))
const CasesPage = lazy(() => import('./pages/CasesPage'))

const TermsOfServicePage = lazy(() => import('./pages/TermsOfServicePage'))
const CookiePolicyPage = lazy(() => import('./pages/CookiePolicyPage'))
const DigitalMarketingAntalyaPage = lazy(() => import('./pages/local/DigitalMarketingAntalyaPage'))
const SEOAgencyAntalyaPage = lazy(() => import('./pages/local/SEOAgencyAntalyaPage'))
const WebDevelopmentAntalyaPage = lazy(() => import('./pages/local/WebDevelopmentAntalyaPage'))
const CRMDevelopmentTurkeyPage = lazy(() => import('./pages/local/CRMDevelopmentTurkeyPage'))
const HotelMarketingTurkeyPage = lazy(() => import('./pages/local/HotelMarketingTurkeyPage'))

function LangSync() {
  const location = useLocation()
  const { i18n } = useTranslation()

  useEffect(() => {
    const lang = detectLangFromPath(location.pathname)
    if (i18n.language !== lang) {
      i18n.changeLanguage(lang)
    }
  }, [location.pathname, i18n])

  return null
}

function AnalyticsRouteTracker() {
  const location = useLocation()
  const initialPageviewHandled = useRef(false)

  useEffect(() => {
    if (!initialPageviewHandled.current) {
      initialPageviewHandled.current = true
      return
    }

    if (typeof window.gtag !== 'function') return

    window.gtag('config', GOOGLE_TAG_ID, {
      page_path: `${location.pathname}${location.search}${location.hash}`,
      page_location: window.location.href,
      page_title: document.title,
    })

    if (typeof window.ym === 'function') {
      window.ym(YANDEX_METRIKA_ID, 'hit', window.location.href)
    }
  }, [location.pathname, location.search, location.hash])

  return null
}

function AppRoutes() {
  return (
    <Routes>
      {/* ── English (default, no prefix) ────────── */}
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

      {/* ── Russian (/ru prefix) ─────────────────── */}
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

      {/* ── Turkish (/tr prefix) ─────────────────── */}
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

      {/* ── E-commerce URL deduplication ────────────── */}
      <Route path="/services/development/e-commerce" element={<Navigate to="/services/development/ecommerce" replace />} />
      <Route path="/services/development/e-commerce/*" element={<Navigate to="/services/development/ecommerce" replace />} />
      <Route path="/ru/services/development/e-commerce" element={<Navigate to="/ru/services/development/ecommerce" replace />} />
      <Route path="/ru/services/development/e-commerce/*" element={<Navigate to="/ru/services/development/ecommerce" replace />} />
      <Route path="/tr/services/development/e-commerce" element={<Navigate to="/tr/services/development/ecommerce" replace />} />
      <Route path="/tr/services/development/e-commerce/*" element={<Navigate to="/tr/services/development/ecommerce" replace />} />

      {/* ── Legacy WordPress blog category redirects ─── */}
      <Route path="/category/blog" element={<Navigate to="/blog" replace />} />
      <Route path="/category/blog/*" element={<Navigate to="/blog" replace />} />
      <Route path="/ru/category/blog" element={<Navigate to="/ru/blog" replace />} />
      <Route path="/ru/category/blog/*" element={<Navigate to="/ru/blog" replace />} />
      <Route path="/tr/category/blog" element={<Navigate to="/tr/blog" replace />} />
      <Route path="/tr/category/blog/*" element={<Navigate to="/tr/blog" replace />} />

      {/* ── Old WordPress article redirects ──────────── */}
      <Route path="/effektivnyj-marketing-s-n8n" element={<Navigate to="/ru/blog" replace />} />
      <Route path="/marketing-budjet-gostinichnogo-biznesa" element={<Navigate to="/ru/blog" replace />} />
      <Route path="/marketing-v-oteley-izuchite-ai" element={<Navigate to="/ru/blog" replace />} />
      <Route path="/her-zaman-beklenenden-fazlasini-yapin" element={<Navigate to="/tr/blog" replace />} />

      {/* ── WooCommerce routes → 404 ──────────────────── */}
      <Route path="/product-tag/*" element={<NotFoundPage />} />
      <Route path="/product-category/*" element={<NotFoundPage />} />
      <Route path="/product/*" element={<NotFoundPage />} />
      <Route path="/shop/*" element={<NotFoundPage />} />
      <Route path="/cart" element={<NotFoundPage />} />
      <Route path="/checkout" element={<NotFoundPage />} />
      <Route path="/my-account/*" element={<NotFoundPage />} />

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <LangSync />
      <AnalyticsRouteTracker />
      <Suspense fallback={null}>
        <AppRoutes />
      </Suspense>
    </BrowserRouter>
  )
}
