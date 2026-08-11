import type { NextApiRequest, NextApiResponse } from "next"
import { getVercelApp } from "../../../backend/vercel"

// Renders the star history SVG chart (and OG cards) via the shared Hono app.
// Mirrors the backend /svg endpoint so embedded chart URLs keep working.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const app = getVercelApp()
    const qs = (req.url ?? "").replace(/^[^?]*/, "")
    const host = req.headers.host ?? "localhost"
    const proto = (req.headers["x-forwarded-proto"] as string) ?? "https"
    const headers = new Headers()
    for (const [key, value] of Object.entries(req.headers)) {
        if (typeof value === "string") {
            headers.set(key, value)
        }
    }
    // Vercel adapter contract: Next.js owns the client-facing compression.
    // Forwarding Accept-Encoding would make Hono compress the internal response;
    // Next.js then drops/recomputes Content-Encoding and serves gzip bytes as XML.
    headers.delete("accept-encoding")
    // Pass the raw (encoded) query string through unchanged. Decoding and
    // re-encoding here would double-encode values like `repos=a/b` when
    // Vercel's /svg → /api/svg rewrite is in the loop.
    const request = new Request(`${proto}://${host}/svg${qs}`, {
        method: "GET",
        headers,
    })
    const response = await app.fetch(request)

    res.status(response.status)
    response.headers.forEach((value, key) => {
        if (key.toLowerCase() === "content-encoding" || key.toLowerCase() === "transfer-encoding") {
            return
        }
        res.setHeader(key, value)
    })
    res.send(Buffer.from(await response.arrayBuffer()))
}
