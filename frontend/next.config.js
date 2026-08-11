const path = require("path");

const sharedDir = path.resolve(__dirname, "../shared");
const backendDir = path.resolve(__dirname, "../backend");
const ghDataDir = path.resolve(__dirname, "../gh/data");

/** @type {import('next').NextConfig} */
const nextConfig = {
    experimental: {
        // Bundle the backend assets (fonts, logo) into the API serverless
        // functions so OG card rendering can read them at runtime.
        outputFileTracingIncludes: {
            "/api/svg": ["../backend/assets/**"],
            "/api/healthz": ["../backend/assets/**"],
        },
    },
    // These rewrites must live here (routes-manifest.json), not in the root
    // vercel.json: vercel.json rewrites are filesystem-aware on Vercel, and
    // with the Next.js pages dir present /svg never reaches /api/svg (404).
    // routes-manifest rewrites are evaluated at routing time and do match.
    async rewrites() {
        return [
            { source: "/svg", destination: "/api/svg" },
            { source: "/svg/", destination: "/api/svg" },
            { source: "/healthz", destination: "/api/healthz" },
        ];
    },
    webpack: (config, { defaultLoaders }) => {
        config.resolve.alias["@shared"] = sharedDir;
        config.resolve.alias["@gh-data"] = ghDataDir;
        // Backend/shared use ESM-style ".js" import specifiers that actually
        // point to .ts/.tsx sources; teach webpack how to resolve them.
        config.resolve.extensionAlias = {
            ...(config.resolve.extensionAlias ?? {}),
            ".js": [".ts", ".tsx", ".js"],
        };
        // Ensure shared/ and backend/ code can resolve packages from
        // frontend/node_modules, and preserve bare-import resolution
        // (e.g. "store", "helpers/toast") by including the frontend
        // directory itself as a module root.
        config.resolve.modules = [
            __dirname,
            path.resolve(__dirname, "node_modules"),
            "node_modules",
        ];
        config.module.rules.push({
            test: /\.(ts|tsx)$/,
            include: [sharedDir, backendDir],
            use: defaultLoaders.babel,
        });
        return config;
    },
}

module.exports = nextConfig
