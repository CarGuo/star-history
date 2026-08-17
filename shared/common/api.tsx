import axios from "axios"
import utils from "./utils"

const API_PER_PAGE = 100  // GitHub API max items per request
const REQUEST_TIMEOUT_MS = 15000  // 15s timeout for GitHub API calls
const GITHUB_API_VERSION = "2026-03-10"

const getGitHubHeaders = (token?: string, accept = "application/vnd.github+json") => ({
    Accept: accept,
    "X-GitHub-Api-Version": GITHUB_API_VERSION,
    ...(token ? { Authorization: `Bearer ${token}` } : {})
})

const getResponseHeader = (headers: any, name: string): string | undefined => {
    if (!headers) return undefined
    const value = typeof headers.get === "function"
        ? headers.get(name)
        : headers[name] ?? headers[name.toLowerCase()]
    return value === null || value === undefined ? undefined : String(value)
}

// 2026-08: GitHub uses 403 for both rate limits and authorization failures.
// Only cool down a token when GitHub supplies an actual rate-limit signal;
// otherwise one repository permission error would disable the entire pool.
export const isGitHubRateLimitError = (errorOrResponse: any): boolean => {
    const response = errorOrResponse?.response ?? errorOrResponse
    const status = response?.status ?? errorOrResponse?.status
    const headers = response?.headers
    const remaining = getResponseHeader(headers, "x-ratelimit-remaining")
    const retryAfter = getResponseHeader(headers, "retry-after")
    const message = String(response?.data?.message ?? errorOrResponse?.message ?? "")

    return status === 429
        || remaining === "0"
        || retryAfter !== undefined
        || (status === 403 && /(?:secondary\s+)?rate\s*limit|abuse detection/i.test(message))
}

namespace api {
    export async function getRepoStargazers(repo: string, token?: string, page?: number) {
        let url = `https://api.github.com/repos/${repo}/stargazers?per_page=${API_PER_PAGE}`

        if (page !== undefined) {
            url = `${url}&page=${page}`
        }
        return axios.get(url, {
            headers: getGitHubHeaders(token, "application/vnd.github.star+json"),
            timeout: REQUEST_TIMEOUT_MS,
        })
    }

    export async function getRepoStargazersCount(repo: string, token?: string) {
        const { data } = await axios.get(`https://api.github.com/repos/${repo}`, {
            headers: getGitHubHeaders(token),
            timeout: REQUEST_TIMEOUT_MS,
        })

        return data.stargazers_count
    }

    export async function getRepoStarRecords(repo: string, token: string, maxRequestAmount: number) {
        const patchRes = await getRepoStargazers(repo, token)

        const headerLink = patchRes.headers["link"] || ""

        let pageCount = 1
        const regResult = /next.*&page=(\d*).*last/.exec(headerLink)

        if (regResult) {
            if (regResult[1] && Number.isInteger(Number(regResult[1]))) {
                pageCount = Number(regResult[1])
            }
        }

        if (pageCount === 1 && patchRes?.data?.length === 0) {
            throw {
                status: patchRes.status,
                data: []
            }
        }

        const requestPages: number[] = []
        if (pageCount < maxRequestAmount) {
            requestPages.push(...utils.range(1, pageCount))
        } else {
            utils.range(1, maxRequestAmount).map((i) => {
                requestPages.push(Math.round((i * pageCount) / maxRequestAmount) - 1)
            })
            if (!requestPages.includes(1)) {
                requestPages[0] = 1;
            }
        }

        const resArray = await Promise.all(
            requestPages.map((page) => {
                return getRepoStargazers(repo, token, page)
            })
        )

        const starRecordsMap: Map<string, number> = new Map()

        if (requestPages.length < maxRequestAmount) {
            const starRecordsData: {
                starred_at: string
            }[] = []
            resArray.map((res) => {
                const { data } = res
                starRecordsData.push(...data)
            })
            for (let i = 0; i < starRecordsData.length; ) {
                starRecordsMap.set(utils.getDateString(starRecordsData[i].starred_at), i + 1)
                i += Math.floor(starRecordsData.length / maxRequestAmount) || 1
            }
        } else {
            resArray.map(({ data }, index) => {
                if (data.length > 0) {
                    const starRecord = data[0]
                    // Calculate actual star position based on API page size and position in page
                    const pageStartPosition = API_PER_PAGE * (requestPages[index] - 1)
                    starRecordsMap.set(utils.getDateString(starRecord.starred_at), pageStartPosition)
                }
            })
        }

        const starAmount = await getRepoStargazersCount(repo, token)
        starRecordsMap.set(utils.getDateString(Date.now()), starAmount)

        const starRecords: {
            date: string
            count: number
        }[] = []

        starRecordsMap.forEach((v, k) => {
            starRecords.push({
                date: k,
                count: v
            })
        })

        return starRecords
    }

    export async function getRepoLogoUrl(repo: string, token?: string): Promise<string> {
        const owner = repo.split("/")[0]
        const { data } = await axios.get(`https://api.github.com/users/${owner}`, {
            headers: getGitHubHeaders(token),
            timeout: REQUEST_TIMEOUT_MS,
        })

        return data.avatar_url
    }

    export async function getAuthenticatedUser(token: string): Promise<string> {
        const { data } = await axios.get("https://api.github.com/user", {
            headers: getGitHubHeaders(token),
            timeout: REQUEST_TIMEOUT_MS,
        })

        return data.login
    }
}

export default api
