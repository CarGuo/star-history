import type { NextApiRequest, NextApiResponse } from "next"
import { getVercelApp } from "../../../backend/vercel"

// Health check endpoint mirroring the backend /healthz route.
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
    let app
    try {
        app = await getVercelApp()
    } catch (error) {
        console.error("Failed to initialize the health API", error)
        res.status(503).json({ status: "ERROR", message: "GitHub token initialization failed" })
        return
    }
    const host = req.headers.host ?? "localhost"
    const proto = (req.headers["x-forwarded-proto"] as string) ?? "https"
    const response = await app.fetch(new Request(`${proto}://${host}/healthz`, { method: "GET" }))
    res.status(response.status).json(await response.json())
}
