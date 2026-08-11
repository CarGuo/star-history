export const GITHUB_REPO_URL_REG = /github.com\/(\S*?\/\S*)/

export const ANIMATION_DURATION = 1000

export const MIN_CHART_WIDTH = 600

export const EASTER_EGG_REPOS = new Set(["openclaw/openclaw"])

// On Vercel the site and API are served from the same origin (see the /svg
// rewrite in vercel.json), so the SVG API can use relative URLs. SITE_URL
// keeps an absolute origin for SEO metadata (og:url, canonical, sitemap).
const isVercel = Boolean(process.env.NEXT_PUBLIC_VERCEL || process.env.VERCEL)
const vercelOrigin = process.env.NEXT_PUBLIC_VERCEL_URL ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` : ""

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? (isVercel ? vercelOrigin : "https://star-history.com")
export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? (isVercel ? "" : "https://api.star-history.com")
export const NEWSLETTER_URL = "https://newsletter.star-history.com/subscribe"
