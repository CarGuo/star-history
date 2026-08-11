import type { NextApiRequest, NextApiResponse } from "next"
import { getVercelApp } from "../../../backend/vercel"

// Health check endpoint mirroring the backend /healthz route.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    const app = getVercelApp()
    const host = req.headers.host ?? "localhost"
    const proto = (req.headers["x-forwarded-proto"] as string) ?? "https"
    const response = await app.fetch(new Request(`${proto}://${host}/healthz`, { method: "GET" }))
    res.status(response.status).json(await response.json())
}
