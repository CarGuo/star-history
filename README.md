<!-- Documentation version: 2026-08-17. Rewritten for the supported Vercel monorepo deployment flow and GitHub's stargazer access restrictions. -->

<div align="center">
  <img src="assets/logo-full.svg" alt="Star History" width="360" />

  # Star History · Vercel 部署版

  在一个 Vercel 项目中部署 Star History 网站和 SVG API，生成并对比 GitHub 仓库的 Star 趋势图。

  [上游项目](https://github.com/star-history/star-history) · [许可证](LICENSE)
</div>

## 项目说明

本仓库基于开源项目 [star-history/star-history](https://github.com/star-history/star-history)，并补齐了适用于 Vercel 的单项目部署方式：

- Next.js 网站和 SVG API 使用同一个 Vercel 域名；
- `/svg` 自动路由到 Vercel Serverless Function；
- 支持单仓库和多仓库对比，单次最多 20 个仓库；
- 支持日期、时间线、深色主题、对数坐标、透明背景和多种尺寸；
- 提供 `/healthz` 健康检查，显示 token 加载状态和缓存统计；
- 对 token 无效、仓库无权限和真正的 GitHub API 限流给出不同错误，不再把权限错误渲染成空图。

> [!IMPORTANT]
> GitHub 自 2026 年 7 月起限制 stargazer 列表接口。即使目标仓库是公开仓库，调用 token 所属用户仍必须是该仓库的管理员或协作者，才能读取完整的 Star 历史。详见 [GitHub 官方公告](https://github.blog/changelog/2026-06-30-upcoming-access-restrictions-to-public-api-endpoints-and-ui-views/)。

## 部署到 Vercel

### 1. 导入仓库

先 Fork 本仓库，然后在 Vercel 中选择 **Add New → Project**，导入你的 Fork。

项目设置必须使用以下值：

| 设置 | 值 |
| --- | --- |
| Framework Preset | `Next.js` |
| Root Directory | `frontend` |
| Include source files outside of the Root Directory in the Build Step | 开启 |

不要把仓库根目录作为 Vercel Root Directory。项目的 Next.js 依赖位于 `frontend`，而运行时还需要读取根目录中的 `backend`、`shared` 和 `gh`。仓库已经在 [`frontend/vercel.json`](frontend/vercel.json) 中定义了安装、数据生成和构建命令，无需在控制台重复覆盖。

### 2. 配置 GitHub token

在 **Project Settings → Environment Variables** 中配置下列变量：

| 变量 | 是否必需 | 用途 |
| --- | --- | --- |
| `GITHUB_TOKEN` | 是，除非使用 `GITHUB_TOKENS` | 单个 GitHub token |
| `GITHUB_TOKENS` | 否 | 多个 token，以逗号或换行分隔；请求时自动轮换 |
| `NEXT_PUBLIC_SITE_URL` | 否 | 网站的固定公开地址，例如 `https://stars.example.com` |

如果两个 token 变量都存在，`GITHUB_TOKENS` 优先。建议把变量标记为 **Sensitive**，并至少应用到 **Production**；如果需要验证 Preview Deployment，再同时应用到 **Preview**。

配置 token 时需要同时满足：

1. token 本身有效，能够通过 GitHub 身份认证；
2. token 所属用户是每个目标仓库的管理员或协作者；
3. Fine-grained PAT 已选择目标仓库，并至少授予只读 `Metadata` 权限。

公开仓库并不再等于公开 stargazer 历史。一个普通 GitHub 用户的有效 token，无法读取该用户没有管理或协作权限的仓库历史。

> [!CAUTION]
> 不要把 token 写进代码、README、URL、提交记录或日志。token 一旦泄露，应立即在 GitHub 中撤销或轮换。

### 3. 保证图片接口可以公开访问

GitHub README、网页 `<img>` 和无痕浏览器都不会携带你的 Vercel 登录状态，因此图片 URL 必须公开访问。

在 **Project Settings → Deployment Protection** 中使用允许 Production Domain 公开访问的配置。通常可使用 **Standard Protection**，然后只在 README 中使用 Vercel **Domains** 页面列出的 Production Domain 或自定义域名。不要使用需要登录的 Preview URL 或受保护的生成式 Deployment URL。

最直接的检查方法：在无痕窗口打开下方 `/svg` 地址。如果出现 Vercel 登录页、`/sso-api` 跳转或 HTML，而不是 SVG 图片，说明问题在 Deployment Protection 或所用域名，不在图表代码。

### 4. 部署

点击 **Deploy**。以后每次修改环境变量，都必须重新创建一次 Production Deployment；旧部署不会自动获得新值。

## 部署后验证

将 `<your-production-domain>` 替换为 Vercel Domains 页面中的公开生产域名，不要包含末尾 `/`。

### 健康检查

```text
https://<your-production-domain>/healthz
```

正常响应示例：

```json
{
  "status": "OK",
  "githubToken": {
    "source": "GITHUB_TOKEN",
    "configuredCount": 1,
    "usableCount": 1
  }
}
```

`usableCount: 1` 只表示 token 可以登录 GitHub；目标仓库权限仍需通过实际 `/svg` 请求验证。

### 单仓库

```text
https://<your-production-domain>/svg?repos=carguo/gsy_github_app_flutter&type=Date
```

### 多仓库

```text
https://<your-production-domain>/svg?repos=carguo/gsy_github_app_flutter,carguo/gsyvideoplayer,carguo/gsy_flutter_demo,carguo/gsy_flutter_book&type=Date
```

也可以在 PowerShell 中检查状态码和响应类型：

```powershell
curl.exe -sS -D - -o NUL "https://<your-production-domain>/svg?repos=carguo/gsy_github_app_flutter&type=Date"
```

正确结果应为 `200`，且 `Content-Type` 为 `image/svg+xml`。`/api/svg` 是 Vercel 的直接函数路由，也可以访问；对外嵌入建议统一使用稳定入口 `/svg`。

## 在 README 中嵌入图表

单仓库：

```markdown
[![Star History Chart](https://<your-production-domain>/svg?repos=owner/repo&type=Date)](https://github.com/owner/repo)
```

多仓库对比：

```markdown
![Star History Chart](https://<your-production-domain>/svg?repos=owner/repo,owner/another-repo&type=Date)
```

自动适配 GitHub 深色模式：

```html
<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://<your-production-domain>/svg?repos=owner/repo&type=Date&theme=dark" />
  <source media="(prefers-color-scheme: light)" srcset="https://<your-production-domain>/svg?repos=owner/repo&type=Date" />
  <img alt="Star History Chart" src="https://<your-production-domain>/svg?repos=owner/repo&type=Date" />
</picture>
```

## SVG 参数

| 参数 | 必需 | 可选值 | 默认值 | 说明 |
| --- | --- | --- | --- | --- |
| `repos` | 是 | `owner/repo`，多个用逗号分隔 | — | 最多 20 个仓库，GitHub 名称不区分大小写 |
| `type` | 否 | `Date`、`Timeline` | `Date` | 按日期或项目相对时间绘图 |
| `theme` | 否 | `light`、`dark` | `light` | 图表主题 |
| `size` | 否 | `mobile`、`laptop`、`desktop` | `laptop` | 图表宽度 |
| `legend` | 否 | `top-left`、`bottom-right` | `top-left` | 图例位置 |
| `logscale` | 否 | `true`、`false`，也可只写参数名 | `false` | 使用对数纵轴 |
| `transparent` | 否 | `true`、`false` | `false` | 透明背景 |

示例：

```text
https://<your-production-domain>/svg?repos=owner/repo,owner/another-repo&type=Timeline&theme=dark&legend=bottom-right&logscale=true&transparent=true&size=desktop
```

## 本地开发

要求：Node.js 18+、pnpm 9。

首次安装并生成构建数据：

```powershell
pnpm install

Push-Location gh
pnpm install
pnpm run star:generate
Pop-Location

Push-Location frontend
pnpm install
Pop-Location
```

启动与 Vercel 相同的 Next.js 网站和 API：

```powershell
Set-Location frontend
$env:GITHUB_TOKEN = "<your-token>"
$env:NEXT_PUBLIC_API_URL = "http://localhost:3000"
pnpm dev
```

访问：

```text
http://localhost:3000/
http://localhost:3000/healthz
http://localhost:3000/svg?repos=owner/repo&type=Date
```

仅调试独立后端时：

```powershell
Set-Location backend
$env:GITHUB_TOKEN = "<your-token>"
pnpm install
pnpm dev
```

独立后端默认监听 `http://localhost:8080`。

## 验证修改

```powershell
Push-Location backend
pnpm test
pnpm run build
Pop-Location

Push-Location gh
pnpm test
pnpm run star:generate
Pop-Location

Push-Location frontend
pnpm run build:vercel
Pop-Location
```

## 常见问题

| 现象 | 根因 | 处理方式 |
| --- | --- | --- |
| 整个站点或 `/svg` 返回 Vercel 404 | Root Directory 或构建配置错误 | Root Directory 设为 `frontend`，开启构建时包含根目录外源码，使用仓库内 `frontend/vercel.json` |
| 无痕访问要求登录 | 使用了受保护的 Preview/Deployment URL，或 Production 也开启了强制保护 | 调整 Deployment Protection，并改用 Domains 中的公开 Production Domain |
| `GitHub token initialization failed` | 环境变量不存在、值无效或新变量尚未进入部署 | 检查变量作用环境并重新部署 |
| `GitHub token cannot access stargazer history...` | token 有效，但所属用户不是目标仓库管理员/协作者 | 换成具备目标仓库权限的用户 token；不能靠扩大无关 scope 绕过 |
| `GitHub API rate limit exceeded` | GitHub 明确返回限流信息 | 等待配额恢复，或通过 `GITHUB_TOKENS` 配置多个均具备仓库权限的 token |
| 图中只有坐标轴、没有数据 | 旧版本把权限失败误当成空数据 | 更新到最新提交并重新部署；当前版本会返回明确的 403/404/429 错误 |
| 修改环境变量后结果不变 | 正在访问旧部署，或没有重新部署 | 从 Domains 确认 Production Domain，并创建新的 Production Deployment |
| 多仓库首次加载较慢 | 冷启动需要分页读取每个仓库的 stargazer 数据 | 等待首次请求完成；成功结果会缓存。仓库越多，请求越慢 |

## 目录结构

```text
star-history/
├── backend/             # Hono 图表 API、GitHub token 和缓存逻辑
├── frontend/            # Next.js 网站、Vercel API 适配器与部署配置
├── gh/                  # 排行榜数据生成脚本和静态数据源
├── shared/              # 前后端共享的图表、API 与类型代码
└── assets/              # 项目图片资源
```

Vercel 请求链路：

```text
公开域名 /svg
  → Next.js rewrite
  → /api/svg Serverless Function
  → Hono 图表服务
  → GitHub API
  → SVG 响应与缓存
```

## 上游与许可证

本仓库延续上游 [Star History](https://github.com/star-history/star-history) 的开源实现与版权声明。项目许可证见 [LICENSE](LICENSE)。
