# CLAUDE.md

## Project Overview

Huobao Drama — AI-powered drama/video production tool. Full TypeScript stack.

## Structure

```
backend/   — Hono + Drizzle ORM + Mastra (AI agents) + mysql2
backend/workspace/ — Agent 工作目录（Mastra Workspace jail 根）
backend/workspace/skills/ — Agent SKILL.md definitions
frontend/  — Nuxt 3 + Vue 3 + TypeScript (pure CSS, no UI framework)
configs/   — config.yaml
data/      — generated static files
```

## Commands

### Backend (`backend/`)
- `npm run dev` — Start dev server with tsx watch (port 5679)
- `npm start` — Start production server
- `npm run typecheck` — TypeScript type checking

### Frontend (`frontend/`)
- `npm run dev` — Vite dev server (port 3013, proxies /api to 5679)
- `npm run build` — Production build

## Architecture

### Backend
- **HTTP**: Hono framework with CORS, logger middleware
- **Database**: Drizzle ORM + mysql2, schema in `src/db/schema.ts`
- **AI Agents**: Mastra framework with AI SDK (OpenAI compatible providers)
- **Agent Types**: script_rewriter, extractor, storyboard_breaker, prompt_generator, minimax_h3_prompt_generator
- **Agent Chat**: Hono JSON endpoints for agent responses
- **File Storage**: Local filesystem under `data/static/`
- **H3 Source Fingerprint**: `src/services/h3-source.ts` — 唯一指纹入口，保存与失效判断共用

### Frontend
- **Vue 3** + TypeScript + Vite (Nuxt 3, SPA mode `ssr:false`)
- **Routing**: 文件路由 + `nuxt.config.ts` 的 `pages:extend` 手动注册 `/drama/:id` 与 `/drama/:id/episode/:episodeNumber`
- **State**: Single composable `useWorkbench.ts` for workbench page
- **API**: Unified fetch client in `frontend/app/composables/useApi.ts`
- **Styling**: Pure CSS with CSS variables (dark theme)

## Database
MySQL is the only runtime database. The backend reads `DATABASE_URL` first, then falls back to `MYSQL_HOST`, `MYSQL_PORT`, `MYSQL_USER`, `MYSQL_PASSWORD`, and `MYSQL_DATABASE`.
Tables are created on startup from `src/db/mysql-schema.ts`.

## Key Config
- `configs/config.yaml` — AI provider defaults
- AI service configs stored in DB (`ai_service_configs` table)
- Agent prompts stored as files (`backend/workspace/prompts/<agent_type>.md`), falling back to code defaults in `src/agents/index.ts` (`DEFAULT_PROMPTS`); agent skills in `backend/workspace/skills/` (`SKILL.md`). Only AI service configs are stored in DB.

## 本机环境规范（不入库）

本机专属的 Windows/PowerShell 编码坑、路径与别名配置等，已拆到 `CLAUDE.local.md`。
**该文件不入库**（见 `.gitignore` 的 `/CLAUDE.local.md`），由各开发者在本地自行维护、按需调整，不进入仓库历史。

## GitHub 操作规范（fork 仓库）

本仓库 `Aibrother258/JisuVideo-ai` 是 `chatfire-AI/huobao-drama` 的 fork。
**在 fork 里，GitHub 处处默认帮你往上游送**，以下两个坑都实际踩过，操作前必须确认目标仓库：

### 1. `gh` 不指定 `--repo` 时默认操作父仓库

在 fork 仓库目录下，`gh` 解析到的是 `chatfire-AI/huobao-drama` 而非 origin，且**不报错**。

- ❌ `gh pr review 48 --request-changes`（发到了上游一个已合并的无关 PR）
- ✅ 所有 `gh` 命令显式加 `--repo Aibrother258/JisuVideo-ai`：
  ```bash
  gh pr list   --repo Aibrother258/JisuVideo-ai
  gh pr view 48 --repo Aibrother258/JisuVideo-ai
  gh pr review 48 --repo Aibrother258/JisuVideo-ai --request-changes --body-file <文件>
  gh pr create --repo Aibrother258/JisuVideo-ai --base master --head <分支> --title <英文> --body-file <文件>
  ```
- 误发后：`gh` 提交的 review **无法删除**（GitHub 只允许删 pending 状态，DELETE 会返回 422）。
  补救方式是去那条 PR 下补一条说明留言请对方忽略。

### 2. 网页端创建 PR 时 base repository 默认指向上游

必须手动改回 `Aibrother258/JisuVideo-ai`。推荐用直链锁定 base 分支：

```
https://github.com/Aibrother258/JisuVideo-ai/compare/master...<分支名>
```

### 自检口诀

**每个 GitHub 操作前确认一次：目标是 `Aibrother258/JisuVideo-ai`，不是 `chatfire-AI/huobao-drama`。**
