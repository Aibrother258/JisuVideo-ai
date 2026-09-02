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

## Windows 命令执行规范（防乱码/编码问题）

本机为 Windows PowerShell 环境。执行 `execute_command` 时注意以下**可验证**规则，减少中文乱码与解析问题（不是绝对禁令，PowerShell 本身支持中文）：

1. **文本统一 UTF-8**：涉及中文文本的文件一律按 UTF-8 读写；命令行参数经 PowerShell 传给外部程序（git/gh 等）时可能按系统代码页（GBK）编码，需要精确传中文参数或读取中文输出时，优先写入脚本/JSON 文件后用 `--input` / `--body-file` 方式传递，或先设置 `[Console]::OutputEncoding`。
2. **涉及编码时显式指定**：PowerShell 读取/写出文件时显式加 `-Encoding UTF8`；核对命令输出时优先把结果重定向到文件，再用读取工具按 UTF-8 查看，避免控制台代码页错乱造成误判。
3. **避免复杂嵌套引号**：多语句命令的引号在 PowerShell 中容易解析出错（真正原因是未闭合引号或参数含空格被拆开，`---`、全角标点本身不会导致 `ParserError`），优先拆分为多条简单命令，必要时用 `Select-String` 等代替 `head/grep`。
4. **外部命令（git/docker/gh）的中文输出乱码**只影响控制台显示，不影响执行结果；精确核对时写入文件再读取。
5. **PowerShell 原生命令可直接使用**（`Invoke-WebRequest`、`Get-NetTCPConnection`、`Get-Process`），提示文本可用中文，无需刻意转英文。
