export const GITHUB_REPO_URL_REG = /github.com\/(\S*?\/\S*)/

export const ANIMATION_DURATION = 1000

export const MIN_CHART_WIDTH = 600

export const EASTER_EGG_REPOS = new Set(["openclaw/openclaw"])

// On Vercel the site and API are served from the same origin (see the /svg
// rewrite in vercel.json), so the SVG API can use relative URLs. SITE_URL
// keeps an absolute origin for SEO metadata (og:url, canonical, sitemap).
const isVercel = Boolean(process.env.NEXT_PUBLIC_VERCEL || process.env.VERCEL)
// NEXT_PUBLIC_VERCEL_URL can be set (e.g. to the production domain) so SEO
// metadata points at the canonical site instead of the preview URL. When it
// is not set we fall back to VERCEL_URL (the deployment URL), which Vercel
// sets automatically at build time — note it is server/build-only, so the
// client-side value comes from the prerendered HTML.
const vercelHost = process.env.NEXT_PUBLIC_VERCEL_URL || process.env.VERCEL_URL || ""
const vercelOrigin = vercelHost ? `https://${vercelHost}` : ""

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? (isVercel ? vercelOrigin : "https://star-history.com")
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? (isVercel ? "" : "https://api.star-history.com")
export const NEWSLETTER_URL = "https://newsletter.star-history.com/subscribe"
