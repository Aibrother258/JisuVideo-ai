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
- Agent configs stored in DB (`agent_configs` table)

## Windows 命令执行规范（防乱码/编码问题）

本机为 Windows PowerShell 环境。执行 `execute_command` 时遵守以下规则，避免中文乱码与 PowerShell 解析错误：

1. **命令中的文本一律使用 ASCII/英文**：禁止在 shell 命令中出现中文字符串（`echo` 标签、注释、参数、路径片段均不可用中文）。中文输出会与控制台 GBK/UTF-8 编码错配产生乱码。
2. **禁止在命令中使用中文标点与特殊符号**：中文引号、全角标点、`---` 破折号等会被 PowerShell 误解析，导致 `ParserError`（如"字符串缺少终止符"）。分隔标签改用 `-`、`==` 或英文单词。
3. **多语句命令避免复杂引号嵌套**：优先拆分为多条简单命令；必须合并时确保单双引号正确闭合。
4. **文件读写优先用工具**：查看/编辑文件用 `read_file` / `write_to_file` / `replace_in_file`，不要用 shell 重定向（`>`）写回文件内容。读取可能含非 UTF-8 文本的日志时用 `read_file` 工具或显式 `-Encoding`。
5. **服务/进程探测用 PowerShell 原生命令**（`Invoke-WebRequest`、`Get-NetTCPConnection`、`Get-Process`），提示文本用英文。
6. **git/docker 等外部命令的中文输出乱码**只影响显示，不影响执行结果；需要精确核对内容时改用对应工具读取。
