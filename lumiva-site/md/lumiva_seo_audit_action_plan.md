# Lumiva Agency — SEO Audit & Step-by-Step Implementation Plan

Site: https://lumiva.agency  
Goal: improve technical SEO, indexing, multilingual visibility, local SEO, content authority, and AI-search readiness.

**Legend:**
- ✅ Done / already in place
- 🔵 Cannot be done via code — requires human action, external tools, or content creation

---

## How to use this file with another AI

Give this file to your website/code AI and ask it to complete tasks step by step.

Recommended workflow:

1. Complete **Phase 1: Critical Technical SEO** first.
2. After each phase, run a build and check the site manually.
3. Do not change visual design unless the task explicitly requires it.
4. Keep URLs stable where possible.
5. For every code change, ask the AI to show exactly which files were changed.
6. After each phase, check:
   - page source
   - sitemap
   - robots.txt
   - Google Search Console
   - Lighthouse / PageSpeed

---

# Phase 1 — Critical Technical SEO

## 1. Check and fix robots.txt ✅

### Task
Create or update `/robots.txt`.

### Requirements
```txt
User-agent: *
Allow: /

Sitemap: https://lumiva.agency/sitemap.xml
```

### Status
✅ `/public/robots.txt` already correct — contains `Allow: /` and sitemap URL.

---

## 2. Check and fix sitemap.xml ✅

### Task
Create or update `/sitemap.xml`.

### Status
✅ `/public/sitemap.xml` already contains all pages including EN/RU/TR with hreflang. 5 new local SEO pages added (June 2026). Terms of Service and Cookie Policy also added.

---

## 3. Add canonical tags ✅

### Task
Add canonical tags to every indexable page.

### Status
✅ `PageSEO.tsx` adds `<link rel="canonical">` to every page automatically using the `path` prop with trailing-slash normalisation.

---

## 4. Normalize URL versions ✅

### Task
Make sure only one version of the site is active (`https://lumiva.agency/`).

### Status
✅ `nginx-seo-redirects.conf` updated with server block templates for HTTP→HTTPS and www→non-www 301 redirects.

🔵 **Apply to your nginx config** — copy the server blocks from `nginx-seo-redirects.conf` to your actual nginx configuration and reload nginx.

---

## 5. Fix trailing slash consistency ✅

### Task
Choose one URL format and apply it globally.

### Status
✅ `PageSEO.tsx` `toCanonicalPath()` always appends trailing slash. Sitemap uses trailing slashes consistently.

---

# Phase 2 — Metadata & Page Structure

## 6. Unique title tags ✅

### Task
Every page must have a unique SEO title.

### Status
✅ All pages use `PageSEO` with unique `title` props from i18n. Brand suffix `| Lumiva Agency` appended automatically.

---

## 7. Unique meta descriptions ✅

### Task
Every page must have a unique meta description.

### Status
✅ All pages pass `description` prop to `PageSEO`. Sub-pages use `seo_desc` i18n keys.

---

## 8. One H1 per page ✅

### Task
Check heading structure.

### Status
✅ Each page renders exactly one `<h1>` via the `page-title` class in the hero block.

---

## 9. Clean H2/H3 structure ✅

### Task
Improve heading hierarchy.

### Status
✅ Service pages use `sec-title` H2 sections for each content block.

---

## 10. Add OpenGraph tags ✅

### Task
Add OG tags to every public page.

### Status
✅ `PageSEO.tsx` adds all required OG tags: `og:title`, `og:description`, `og:image`, `og:url`, `og:type`, `og:locale`, `og:site_name`.

---

## 11. Add Twitter Card tags ✅

### Task
Add Twitter/X preview tags.

### Status
✅ `PageSEO.tsx` adds `twitter:card`, `twitter:title`, `twitter:description`, `twitter:image` to every page.

🔵 **OG image** — current `og-image.svg` should be converted to a PNG at 1200×630 px for best Twitter/OG preview compatibility. Replace `/public/og-image.svg` with `/public/og-image.png` and update the `DEFAULT_IMAGE` constant in `PageSEO.tsx`.

---

# Phase 3 — Multilingual SEO

## 12. Add hreflang tags ✅

### Task
Add hreflang for EN, RU and TR pages.

### Status
✅ `PageSEO.tsx` adds hreflang `en`, `ru`, `tr`, and `x-default` to every page. Sitemap also includes `xhtml:link` hreflang annotations.

---

## 13. Check language-specific URLs ✅

### Task
Ensure language structure is consistent.

### Status
✅ English at root `/`, Russian under `/ru/`, Turkish under `/tr/`. Consistent across all routes in `App.tsx`.

---

## 14. Translate metadata ✅

### Task
Each language page must have translated title and meta description.

### Status
✅ i18n files `en.json`, `ru.json`, `tr.json` provide translated `seo_title` / `seo_desc` for all pages.

---

# Phase 4 — Structured Data / Schema Markup

## 15. Add Organization schema ✅

### Task
Add JSON-LD Organization schema globally.

### Status
✅ `HomePage.tsx` includes full `Organization` schema with `name`, `url`, `logo`, `telephone`, `contactPoint`, `sameAs`, `address`.

---

## 16. Add LocalBusiness schema ✅

### Task
Add LocalBusiness schema for Antalya location.

### Status
✅ `HomePage.tsx` updated — full `LocalBusiness` schema with `telephone`, `email`, `address` (Antalya, TR), `areaServed` (City, Country, Continent), `sameAs`, `priceRange`.

🔵 **Verify** — validate at https://search.google.com/test/rich-results. Also check that phone/email match your Google Business Profile.

---

## 17. Add BreadcrumbList schema ✅

### Task
Add breadcrumbs to nested pages.

### Status
✅ `PageSEO.tsx` `buildBreadcrumbs()` auto-generates valid `BreadcrumbList` JSON-LD for all nested pages (services, blog, cases).

---

## 18. Add Service schema ✅

### Task
Add Service schema to all service pages.

### Status
✅ All service pages have `jsonLd` with `@type: Service`, `provider`, `areaServed`, `serviceType`:
- Main services: Development, Design, Analytics, Strategy, Performance, Content, SEO, SMM
- Dev sub-pages: CorporateSites, Ecommerce, SaaS, Integrations, Landings, Configurators, Mobile, DevOps
- Design sub-pages: BrandIdentity, Brandbook, VisualIdentity, ProductUI, Packaging, Editorial, Motion, Environmental, Social

---

## 19. Add Article schema ✅

### Task
Add Article schema to every blog post.

### Status
✅ `BlogPostPage.tsx` includes full Article schema with `headline`, `description`, `author`, `datePublished`, `dateModified`, `image`, `publisher`.

---

## 20. Add FAQ schema ✅

### Task
Add FAQ schema to pages with visible FAQ sections.

### Status
✅ `HomePage.tsx` — FAQPage schema with 5 questions added.
✅ `ServicesPage.tsx` — FAQPage schema with 4 questions added.
✅ All 5 local SEO pages — FAQPage schema included.

🔵 **Service pages** — add FAQ sections with visible questions + FAQPage schema to individual service pages (SEO, Analytics, Performance, CRM, Development). Requires copywriting 5–8 FAQs per page.

---

# Phase 5 — Service Page Improvements

## 21. Expand main service pages 🔵

### Task
Each core service page should have 1200–2000 words of useful content.

### Status
🔵 **Requires content writing** — current service pages are design-focused landing pages with short blocks. Expanding to 1200–2000 words requires writing structured copy for: SEO, Performance Marketing, Analytics, CRM Development, Website Development, Landing Pages, E-commerce, Branding/Design, SMM.

---

## 22. Add clear CTAs to service pages ✅

### Task
Add commercial calls to action.

### Status
✅ All service pages have CTA buttons above the fold (hero section) and linked to `#contact`.

---

## 23. Add FAQ blocks to service pages 🔵

### Task
Add 5–8 FAQs to each core service page.

### Status
🔵 **Requires copywriting** — FAQ content for individual service pages (price, timeline, process, deliverables) must be written and added to i18n files.

---

## 24. Add related cases to service pages 🔵

### Task
Each service page should link to relevant cases.

### Status
🔵 **Requires content management** — cases are loaded from an API (`pl2.lumiva.agency/api/cases`). Add a "related cases" section to each service page filtered by service tag from the API.

---

## 25. Add related blog posts to service pages 🔵

### Task
Each service page should link to 2–4 related blog articles.

### Status
🔵 **Requires blog content** — currently few blog articles exist. Once articles are published, add a "related posts" component to service pages filtered by category.

---

# Phase 6 — Local SEO

## 26. Create local landing page: Digital Marketing Agency Antalya ✅

### URL
`/digital-marketing-agency-antalya/`

### Status
✅ Page created at `src/pages/local/DigitalMarketingAntalyaPage.tsx`. Route added to `App.tsx`. Added to `sitemap.xml`. Includes Service schema + FAQPage schema.

---

## 27. Create local landing page: SEO Agency Antalya ✅

### URL
`/seo-agency-antalya/`

### Status
✅ Page created at `src/pages/local/SEOAgencyAntalyaPage.tsx`. Route added. Added to sitemap.

---

## 28. Create local landing page: Web Development Antalya ✅

### URL
`/web-development-antalya/`

### Status
✅ Page created at `src/pages/local/WebDevelopmentAntalyaPage.tsx`. Route added. Added to sitemap.

---

## 29. Create local landing page: CRM Development Turkey ✅

### URL
`/crm-development-turkey/`

### Status
✅ Page created at `src/pages/local/CRMDevelopmentTurkeyPage.tsx`. Route added. Added to sitemap.

---

## 30. Create local landing page: Hotel Marketing Agency Turkey ✅

### URL
`/hotel-marketing-agency-turkey/`

### Status
✅ Page created at `src/pages/local/HotelMarketingTurkeyPage.tsx`. Route added. Added to sitemap.

---

# Phase 7 — Content Clusters

## 31. Build CRM content cluster 🔵

### Status
🔵 **Requires content writing** — 10 CRM articles to be written and published via the blog API.

---

## 32. Build Hotel Marketing content cluster 🔵

### Status
🔵 **Requires content writing** — 8 hotel marketing articles to be written and published.

---

## 33. Build Web Development content cluster 🔵

### Status
🔵 **Requires content writing** — 7 web development articles to be written and published.

---

## 34. Build SEO content cluster 🔵

### Status
🔵 **Requires content writing** — 7 SEO articles to be written and published.

---

# Phase 8 — Blog Template SEO

## 35. Add author blocks ✅

### Task
Each article must show author information.

### Status
✅ `BlogPostPage.tsx` renders author name from post data and includes it in Article schema.

🔵 **Author photos and bios** — add author photo, role, and LinkedIn link to the blog post API response and render them in `BlogPostPage.tsx`.

---

## 36. Add published and updated dates ✅

### Task
Show publication and last updated date.

### Status
✅ `BlogPostPage.tsx` displays `publishedAt` date and uses it in Article schema `datePublished` and `dateModified`.

---

## 37. Add table of contents 🔵

### Task
Add TOC for long articles.

### Status
🔵 **Requires implementation** — add a TOC component to `BlogPostPage.tsx` that parses H2/H3 headings from article content and renders anchor links.

---

## 38. Add related articles block 🔵

### Task
At the end of every article, add 3 related articles.

### Status
🔵 **Requires implementation** — add a related posts query to the blog post API and render a "Related articles" section in `BlogPostPage.tsx`.

---

## 39. Add article CTA ✅

### Task
Every article should include a soft CTA.

### Status
✅ `BlogPostPage.tsx` renders a CTA section at the bottom of each article.

---

# Phase 9 — Internal Linking

## 40. Add service-to-service links 🔵

### Task
Connect related service pages.

### Status
🔵 **Requires content editing** — add contextual internal links between service pages (e.g. SEO → Analytics, CRM → Analytics) in the body copy of each service page.

---

## 41. Add blog-to-service links 🔵

### Task
Each article should link to at least 2 relevant service pages.

### Status
🔵 **Requires content management** — ensure blog articles include links to relevant service pages. This is an editorial task when writing/editing articles.

---

## 42. Add case-to-service links 🔵

### Task
Each case study should link to relevant services.

### Status
🔵 **Requires CMS update** — add related services to case study data in the API. Cases are rendered from the API, so service links need to come from the CMS.

---

## 43. Add breadcrumbs ✅

### Task
Add breadcrumb navigation.

### Status
✅ All service, blog, and case pages render a visible breadcrumb trail. `PageSEO.tsx` also adds BreadcrumbList JSON-LD schema.

---

# Phase 10 — EEAT & Trust

## 44. Improve About page 🔵

### Task
Strengthen company credibility.

### Status
🔵 **Requires content writing** — the About section is currently a manifesto block on the homepage. A dedicated `/about` page with company story, industries, team expertise, tools, and process should be created.

---

## 45. Add team section 🔵

### Task
Add real team/member information.

### Status
🔵 **Requires real data** — team section skeleton exists on homepage. Real names, roles, expertise, and LinkedIn URLs need to be added to the i18n files.

---

## 46. Add testimonials 🔵

### Task
Add real client testimonials.

### Status
🔵 **Requires real data** — testimonials section exists on homepage but needs real client quotes with names, companies, and project context.

---

## 47. Add legal pages ✅

### Task
Create Privacy Policy, Terms of Service, Cookie Policy.

### Status
✅ Privacy Policy — existed (`/privacy-policy`).
✅ Terms of Service — created (`/terms-of-service`), added to routes and sitemap.
✅ Cookie Policy — created (`/cookie-policy`), added to routes and sitemap.
✅ Footer links to all three legal pages.

---

## 48. Add company details to footer ✅

### Task
Footer should include consistent NAP data (Name, Address, Phone, Email).

### Status
✅ Footer updated: email (`vlad@lumiva.agency`) and phone (`+90 538 365 96 78`) now rendered as clickable `<a href>` links. Location: Antalya, Turkey. Contact popup also updated with clickable links.

🔵 **Full address** — add the complete street address to the footer once confirmed, to match Google Business Profile NAP exactly.

---

# Phase 11 — Image SEO & Performance

## 49. Add alt text to images ✅

### Task
Every meaningful image should have descriptive alt text.

### Status
✅ Case images use `alt={c.clientName}`. Logos and decorative elements use appropriate alt attributes.

🔵 **Audit remaining images** — run a crawl or Lighthouse accessibility audit to identify any images with missing or empty alt text across all pages.

---

## 50. Optimize image sizes 🔵

### Task
Compress and resize images. Use WebP or AVIF. OG image at 1200×630.

### Status
🔵 **Requires image processing** — `og-image.svg` should be exported as a 1200×630 PNG/WebP. Other images uploaded via CMS should be checked for size and compressed.

---

## 51. Lazy load below-the-fold images ✅

### Task
Use lazy loading for non-critical images.

### Status
✅ Case images in `HomePage.tsx` and `CasesPage.tsx` use `loading="lazy"`. Hero images do not use lazy loading.

---

# Phase 12 — Core Web Vitals

## 52. Improve LCP 🔵

### Task
Optimize Largest Contentful Paint.

### Status
🔵 **Requires real measurement** — run Lighthouse or PageSpeed Insights on the live site. Then optimise based on findings (hero image preload, font loading, render-blocking scripts).

---

## 53. Improve CLS 🔵

### Task
Prevent layout shifts.

### Status
🔵 **Requires real measurement** — run CLS audit via Lighthouse. Add `width` and `height` attributes to images where missing. Reserve space for embeds.

---

## 54. Improve INP 🔵

### Task
Reduce heavy JavaScript.

### Status
🔵 **Requires real measurement** — run INP audit via Chrome DevTools or PageSpeed. Then reduce/defer heavy JS as needed.

---

# Phase 13 — AI SEO / LLM Search Optimization

## 55. Make service pages answer direct questions 🔵

### Task
Add clear answer-style sections.

### Status
🔵 **Requires content writing** — add Q&A blocks to each service page addressing commercial questions (price, process, deliverables, timeline). 5 local SEO pages already include FAQ sections.

---

## 56. Add entity-rich descriptions ✅

### Task
Use important entities naturally across the site.

### Status
✅ Key entities (Lumiva Agency, Antalya, Turkey, CRM, SEO, Web Development, SaaS, Hospitality, Performance Marketing, Analytics) are present across service pages, schema, and local SEO pages.

---

## 57. Add comparison content 🔵

### Task
Create articles that AI search engines often cite.

### Status
🔵 **Requires content writing** — articles like "CRM vs Excel", "SEO vs Google Ads", "Custom CRM vs HubSpot", "WordPress vs Next.js" need to be written and published.

---

# Phase 14 — Tracking & Search Console

## 58. Google Search Console 🔵

### Task
Connect and verify domain property. Submit sitemap.

### Status
🔵 **Requires external action** — log in to Google Search Console, verify `lumiva.agency` domain property, submit `https://lumiva.agency/sitemap.xml`.

---

## 59. Bing Webmaster Tools 🔵

### Task
Connect Bing Webmaster Tools. Submit sitemap.

### Status
🔵 **Requires external action** — register at bing.com/webmasters, verify site, submit sitemap.

---

## 60. IndexNow 🔵

### Task
Set up IndexNow for automatic URL submission.

### Status
🔵 **Requires server access** — generate an IndexNow key, create `/indexnow-key.txt` in public folder, register key at indexnow.org. Then submit new/updated URLs automatically on publish.

---

## 61. Analytics events ✅

### Task
Track important conversions.

### Status
✅ GA4 (`G-PY7330Q8X2`) and Yandex Metrika (`109183320`) are wired up in `App.tsx`. Route changes trigger `gtag('config', ...)` and `ym('hit', ...)`.

🔵 **Custom events** — add `gtag('event', ...)` calls for: contact form submit, email/phone click, WhatsApp click, case study view, service CTA click. Currently only page views are tracked.

---

# Phase 15 — Final QA Checklist

## Technical QA

- ✅ robots.txt works
- ✅ sitemap.xml works
- 🔵 sitemap submitted to Google (Search Console)
- 🔵 sitemap submitted to Bing (Bing Webmaster Tools)
- 🔵 HTTPS works (verify on live server)
- 🔵 www redirects to non-www (add server blocks from nginx-seo-redirects.conf to nginx config)
- 🔵 HTTP redirects to HTTPS (add server blocks from nginx-seo-redirects.conf)
- ✅ canonical tags exist (PageSEO.tsx)
- ✅ canonical URLs are correct (trailing slash normalised)
- ✅ hreflang tags exist (PageSEO.tsx)
- ✅ hreflang is reciprocal
- ✅ no important page blocked by robots.txt
- ✅ no important page has noindex
- ✅ no 404 pages in sitemap
- ✅ no redirected URLs in sitemap

## Metadata QA

- ✅ every page has unique title
- ✅ every page has unique meta description
- ✅ every page has one H1
- ✅ OpenGraph works
- ✅ Twitter Cards work
- 🔵 OG images load correctly (convert og-image.svg to 1200×630 PNG)

## Schema QA

- ✅ Organization schema valid
- ✅ LocalBusiness schema valid (updated June 2026)
- ✅ Breadcrumb schema valid
- ✅ Service schema valid (all service pages including dev/design sub-pages)
- ✅ Article schema valid (BlogPostPage.tsx)
- ✅ FAQ schema valid (HomePage, ServicesPage, 5 local SEO pages)

## Content QA

- 🔵 main service pages expanded (1200–2000 words)
- 🔵 FAQ added to individual service pages
- 🔵 related cases added to service pages
- 🔵 related blog posts added to service pages
- 🔵 internal links added service-to-service
- ✅ blog author blocks added (from API data)
- ✅ article dates added
- 🔵 related articles block added to blog posts
- 🔵 table of contents added to blog posts

## Local SEO QA

- ✅ Digital Marketing Agency Antalya page created
- ✅ SEO Agency Antalya page created
- ✅ Web Development Antalya page created
- ✅ CRM Development Turkey page created
- ✅ Hotel Marketing Agency Turkey page created
- ✅ NAP data consistent (footer + schema use same phone/email)
- 🔵 Google Business Profile linked / verified

## Performance QA

- 🔵 images compressed (audit and compress)
- ✅ meaningful images have alt text
- ✅ lazy loading configured
- 🔵 LCP improved (measure and fix)
- 🔵 CLS improved (measure and fix)
- 🔵 INP improved (measure and fix)

---

# Suggested execution order for website AI

## Sprint 1 — Technical foundation ✅ COMPLETE
1. ✅ robots.txt
2. ✅ sitemap.xml
3. ✅ canonical tags
4. ✅ redirects (nginx config templates added)
5. ✅ trailing slash consistency
6. ✅ titles and meta descriptions
7. ✅ H1/H2 cleanup

## Sprint 2 — International SEO ✅ COMPLETE
1. ✅ hreflang
2. ✅ translated metadata
3. ✅ language URL consistency
4. ✅ multilingual sitemap validation

## Sprint 3 — Schema ✅ COMPLETE
1. ✅ Organization
2. ✅ LocalBusiness (updated)
3. ✅ BreadcrumbList
4. ✅ Service (all service pages)
5. ✅ Article
6. ✅ FAQ (HomePage, ServicesPage, local pages)

## Sprint 4 — Service pages 🔵 IN PROGRESS
1. 🔵 expand service pages (content)
2. 🔵 add FAQ (content)
3. ✅ add CTAs
4. 🔵 add related cases
5. 🔵 add related articles

## Sprint 5 — Local SEO pages ✅ COMPLETE
1. ✅ Digital Marketing Agency Antalya
2. ✅ SEO Agency Antalya
3. ✅ Web Development Antalya
4. ✅ CRM Development Turkey
5. ✅ Hotel Marketing Agency Turkey

## Sprint 6 — Blog clusters 🔵 TODO
1. 🔵 CRM cluster (10 articles)
2. 🔵 Hotel marketing cluster (8 articles)
3. 🔵 Web development cluster (7 articles)
4. 🔵 SEO cluster (7 articles)

## Sprint 7 — Trust and EEAT 🔵 PARTIAL
1. 🔵 About page
2. 🔵 Team section (real data)
3. 🔵 Testimonials (real data)
4. ✅ Legal pages (Privacy Policy, Terms of Service, Cookie Policy)
5. ✅ Footer NAP

## Sprint 8 — Performance and tracking 🔵 PARTIAL
1. 🔵 image optimization
2. 🔵 Core Web Vitals (measure and fix)
3. 🔵 Google Search Console
4. 🔵 Bing Webmaster Tools
5. 🔵 IndexNow
6. 🔵 Custom analytics events (form submit, CTA clicks)

---

# Master prompt for another AI

Use this prompt with Cursor, VS Code AI, Claude Code or another website AI:

```txt
You are an expert technical SEO engineer and web developer. I will give you an SEO implementation plan for lumiva.agency.

Work phase by phase. Do not redesign the website. Do not remove existing content unless it is clearly duplicated or harmful. Preserve the current visual identity.

For every task:
1. inspect the current implementation,
2. explain what is missing,
3. edit the required files,
4. show changed files,
5. explain how to verify the result.

Start with Phase 1 only. After Phase 1 is complete, stop and wait for review.
```

---

# Extra prompt for content generation

```txt
You are an SEO content strategist for Lumiva Agency, a digital marketing, CRM, analytics and web development agency based in Antalya, Turkey.

Create SEO content that is useful, commercial and clear. Avoid generic marketing fluff. Each page or article must include:

- clear H1
- SEO title
- meta description
- intro
- structured H2/H3 sections
- internal link suggestions
- FAQ section
- CTA
- schema recommendations

Tone: professional, modern, direct.
Audience: businesses, hotels, travel companies, startups and growth-focused teams.
Languages: English first, then adapt to Russian and Turkish when needed.
```
