import { XYChartData, XYData } from "../packages/xy-chart"
import { ChartMode, RepoStarData, RepoData } from "../types/chart"
import api, { isGitHubRateLimitError } from "./api"
import utils from "./utils"

export interface ChartDataOptions {
    insertZeroPoint?: boolean
}

export const DEFAULT_MAX_REQUEST_AMOUNT = 15

const getRepoRequestError = async (error: any, repo: string, token: string) => {
    const responseStatus = error?.response?.status ?? error?.status
    let message = "Some unexpected error happened, try again later"
    let status = 500
    let rateLimited = isGitHubRateLimitError(error)

    if (responseStatus === 404) {
        // 2026-08: GitHub conceals restricted stargazer lists as 404. Probe the
        // public repository metadata so permission failures are not reported as
        // missing repositories or cached as successful zero-star charts.
        try {
            await api.getRepoStargazersCount(repo, token)
            message = `GitHub token cannot access stargazer history for ${repo}; the token owner must be a repository admin or collaborator`
            status = 403
        } catch (metadataError: any) {
            if (isGitHubRateLimitError(metadataError)) {
                message = "GitHub API rate limit exceeded"
                status = 429
                rateLimited = true
            } else if ((metadataError?.response?.status ?? metadataError?.status) === 404) {
                message = `Repo ${repo} not found`
                status = 404
            }
        }
    } else if (responseStatus === 403) {
        if (rateLimited) {
            message = "GitHub API rate limit exceeded"
            status = 429
        } else {
            message = `GitHub token cannot access stargazer history for ${repo}; the token owner must be a repository admin or collaborator`
            status = 403
        }
    } else if (responseStatus === 429) {
        message = "GitHub API rate limit exceeded"
        status = 429
        rateLimited = true
    } else if (responseStatus === 401) {
        message = "Access Token Unauthorized"
        status = 401
    } else if (Array.isArray(error?.data) && error.data.length === 0) {
        message = `Repo ${repo} has no star history`
        status = 501
    }

    return { message, status, repo, rateLimited }
}

export const getReposStarData = async (repos: string[], token = "", maxRequestAmount = DEFAULT_MAX_REQUEST_AMOUNT): Promise<RepoStarData[]> => {
    const repoStarDataCacheMap = new Map()

    for (const repo of repos) {
        try {
            const starRecords = await api.getRepoStarRecords(repo, token, maxRequestAmount)
            repoStarDataCacheMap.set(repo, starRecords)
        } catch (error: any) {
            return Promise.reject(await getRepoRequestError(error, repo, token))
        }
    }

    const reposStarData: RepoStarData[] = []
    for (const repo of repos) {
        const records = repoStarDataCacheMap.get(repo)
        if (records) {
            reposStarData.push({
                repo,
                starRecords: records
            })
        }
    }

    return reposStarData.sort((d1, d2) => {
        return Math.max(...d2.starRecords.map((s) => s.count)) - Math.max(...d1.starRecords.map((s) => s.count))
    })
}

export const getRepoData = async (repos: string[], token = "", maxRequestAmount = DEFAULT_MAX_REQUEST_AMOUNT): Promise<RepoData[]> => {
    const repoDataCacheMap: Map<
        string,
        {
            star: {
                date: string
                count: number
            }[]
            logo: string
        }
    > = new Map()

    for (const repo of repos) {
        try {
            const [starRecords, logo] = await Promise.all([
                api.getRepoStarRecords(repo, token, maxRequestAmount),
                api.getRepoLogoUrl(repo, token),
            ])
            repoDataCacheMap.set(repo, { star: starRecords, logo })
        } catch (error: any) {
            const requestError = await getRepoRequestError(error, repo, token)
            console.error("Failed to request data:", requestError.status, requestError.message)
            return Promise.reject(requestError)
        }
    }

    const reposStarData: RepoData[] = []
    for (const repo of repos) {
        const records = repoDataCacheMap.get(repo)
        if (records) {
            reposStarData.push({
                repo,
                starRecords: records.star,
                logoUrl: records.logo
            })
        }
    }

    return reposStarData.sort((d1, d2) => {
        return Math.max(...d2.starRecords.map((s) => s.count)) - Math.max(...d1.starRecords.map((s) => s.count))
    })
}

export const convertStarDataToChartData = (reposStarData: RepoStarData[], chartMode: ChartMode, options?: ChartDataOptions): XYChartData => {
    if (chartMode === "Date") {
        const datasets: XYData[] = reposStarData.map((item) => {
            const { repo, starRecords } = item
            const chartData = starRecords.map((item) => {
                return {
                    x: new Date(item.date),
                    y: Number(item.count)
                }
            })

            // Add initial zero point at the beginning
            if (options?.insertZeroPoint && chartData.length > 0 && chartData[0].y > 0) {
                const firstDate = new Date(chartData[0].x)
                firstDate.setDate(firstDate.getDate() - 1) // One day before first star
                chartData.unshift({
                    x: firstDate,
                    y: 0
                })
            }

            return {
                label: repo,
                logo: "",
                data: chartData
            }
        })

        return {
            datasets
        }
    } else {
        const datasets: XYData[] = reposStarData.map((item) => {
            const { repo, starRecords } = item

            const started = starRecords[0].date
            const chartData = starRecords.map((item) => {
                return {
                    x: utils.getTimeStampByDate(new Date(item.date)) - utils.getTimeStampByDate(new Date(started)),
                    y: Number(item.count)
                }
            })

            // Add initial zero point at the beginning
            if (options?.insertZeroPoint && chartData.length > 0 && chartData[0].y > 0) {
                chartData.unshift({
                    x: -1, // One day before in timeline mode
                    y: 0
                })
            }

            return {
                label: repo,
                logo: "",
                data: chartData
            }
        })

        return {
            datasets
        }
    }
}

export const convertDataToChartData = (repoData: RepoData[], chartMode: ChartMode, options?: ChartDataOptions): XYChartData => {
    if (chartMode === "Date") {
        const datasets: XYData[] = repoData.map(({ repo, starRecords, logoUrl }) => {
            const chartData = starRecords.map((item) => {
                return {
                    x: new Date(item.date),
                    y: Number(item.count)
                }
            })

            // Add initial zero point at the beginning
            if (options?.insertZeroPoint && chartData.length > 0 && chartData[0].y > 0) {
                const firstDate = new Date(chartData[0].x)
                firstDate.setDate(firstDate.getDate() - 1) // One day before first star
                chartData.unshift({
                    x: firstDate,
                    y: 0
                })
            }

            return {
                label: repo,
                logo: logoUrl,
                data: chartData
            }
        })

        return { datasets }
    } else {
        const datasets: XYData[] = repoData.map(({ repo, starRecords, logoUrl }) => {
            const chartData = starRecords.map((item) => {
                return {
                    x: utils.getTimeStampByDate(new Date(item.date)) - utils.getTimeStampByDate(new Date(starRecords[0].date)),
                    y: Number(item.count)
                }
            })

            // Add initial zero point at the beginning
            if (options?.insertZeroPoint && chartData.length > 0 && chartData[0].y > 0) {
                chartData.unshift({
                    x: -1, // One day before in timeline mode
                    y: 0
                })
            }

            return {
                label: repo,
                logo: logoUrl,
                data: chartData
            }
        })

        return { datasets }
    }
}
