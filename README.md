# 🎬 极速视频（JisuVideo）

> 基于 [Huobao Drama](https://github.com/chatfire-AI/huobao-drama) 的社区 fork，包含 Aibrother258 的功能迭代。

<div align="center">

**基于 TypeScript 全栈的 AI 短剧自动化生产平台**

[![Node Version](https://img.shields.io/badge/Node.js-20+-339933?style=flat&logo=node.js)](https://nodejs.org)
[![Vue Version](https://img.shields.io/badge/Vue-3.x-4FC08D?style=flat&logo=vue.js)](https://vuejs.org)
[![License](https://img.shields.io/badge/License-CC%20BY--NC--SA%204.0-lightgrey.svg)](https://creativecommons.org/licenses/by-nc-sa/4.0/)

[功能特性](#功能特性) • [快速开始](#快速开始) • [部署指南](#部署指南)

在「设置 → AI 服务」页按服务类型配置厂商 API 后即可使用

</div>

---

## 📖 项目简介

Huobao Drama 是一个基于 AI 的短剧自动化生产平台，实现从剧本生成、角色设计、分镜制作到视频合成的全流程自动化。

### 🎯 核心价值

- **🤖 AI 驱动**：使用大语言模型解析剧本，提取角色、场景和分镜信息
- **🎨 智能创作**：AI 绘图生成角色形象和场景背景
- **📹 视频生成**：基于文生视频和图生视频模型自动生成分镜视频
- **🔄 工作流**：完整的短剧制作工作流，从创意到成片一站式完成

### 🛠️ 技术架构

```
frontend/   — Nuxt 3 + Vue 3 + TypeScript (纯 CSS，无 UI 框架)
backend/    — Hono + Drizzle ORM + Mastra AI Agents + mysql2
backend/workspace/skills/ — Agent 技能定义 (SKILL.md，支持界面在线编辑)
data/       — 生成资源文件
docker/     — init.sql 数据库初始化脚本(可选，启动时自动建表)
```

---

## ✨ 功能特性

### 🎭 角色管理

- ✅ AI 生成角色形象
- ✅ 批量角色生成
- ✅ 角色图片上传和管理

### 🎬 视频任务

- ✅ AI 自动生成视频任务
- ✅ 场景描述和视频提示词生成
- ✅ 按任务批量生成视频

### 🎥 视频生成

- ✅ 文生视频自动生成
- ✅ FFmpeg 单镜头合成与字幕处理
- ✅ 整集拼接导出

### 📦 资源管理

- ✅ 素材库统一管理
- ✅ 本地存储支持
- ✅ 任务进度追踪

### 🤖 AI Agents

内置 5 个 Mastra Agent，支持数据库配置和 Skill 扩展：

| Agent | 职责 |
|---|---|
| `script_rewriter` | 小说 → 格式化剧本改写 |
| `extractor` | 角色 / 场景 / 道具智能提取与去重 |
| `storyboard_breaker` | 剧本 → 分镜序列拆解 |
| `prompt_generator` | 角色/场景/道具图片提示词 + 分镜视频提示词生成 |
| `minimax_h3_prompt_generator` | 中文分镜提示词 → MiniMax H3 T2VA / I2VA / Ref2VA 提示词 |

### 🔌 多厂商适配

| 类型 | 支持厂商 |
|---|---|
| **文本** | OpenAI(兼容接口)、Gemini、火山引擎 |
| **图片** | OpenAI、Gemini、火山引擎 |
| **视频** | 火山引擎 Seedance 2.0(标准 / Fast / Mini)、MiniMax H3(官方视频接口)、AutoDL(ComfyUI MiniMax H3 工作流) |

> 视频厂商的说明：Seedance 走火山官方接口；MiniMax 走官方 `/v2/video_generation` 接口，仅支持 `MiniMax-H3` 系列；AutoDL 走 ComfyUI 工作流协议（兼容影策 `autodl-comfyui` 插件），常用工作流为 `minimax_h3_image_audio_to_video_v2_15s`。后两者使用中文提示词经 H3 Agent 改写后的大模型提示词。

---

## 🚀 快速开始

### 📋 环境要求

| 软件 | 版本要求 | 说明 |
|---|---|---|
| **Node.js** | 20+ | 前后端运行环境 |
| **npm** | 9+ | 包管理工具 |
| **MySQL** | 8.0+ | 数据库（Docker 部署已内置，无需单独安装） |

> **FFmpeg 无需安装**：项目通过 `ffmpeg-static` / `ffprobe-static` npm 包内置二进制，本地与 Docker 均开箱即用。

### ⚙️ 环境变量

无需配置文件，通过环境变量设置（均有默认值，本地开发可零配置启动）：

| 变量 | 默认值 | 说明 |
|---|---|---|
| `DATABASE_URL` | — | 完整 MySQL 连接串（优先） |
| `MYSQL_HOST` / `MYSQL_PORT` | `127.0.0.1` / `3306` | 未设 `DATABASE_URL` 时分项配置 |
| `MYSQL_USER` / `MYSQL_PASSWORD` | `huobao` / `huobao` | 同上 |
| `MYSQL_DATABASE` | `huobao_drama` | 同上 |
| `PORT` | `5679` | 后端服务端口 |
| `STORAGE_PATH` | `./data/static` | 生成文件存储目录 |

> **说明**：AI 服务的 API Key、Base URL 和模型参数全部在 Web 界面的「设置」页配置并入库，不在配置文件/环境变量中维护。

### 📥 安装依赖

```bash
# 克隆本 fork（JisuVideo / 极速视频）
git clone https://github.com/Aibrother258/JisuVideo-ai.git
cd JisuVideo-ai

# 安装后端依赖
cd backend && npm install

# 安装前端依赖
cd ../frontend && npm install
```

> 上游项目为 [chatfire-AI/huobao-drama](https://github.com/chatfire-AI/huobao-drama)。若是从上游克隆的旧工作区，可用 `git remote add upstream https://github.com/chatfire-AI/huobao-drama.git` 保留上游跟踪。

### 🎯 启动项目

#### 方式一：开发模式（推荐）

前后端分离，支持热重载：

```bash
# 终端1：启动后端
cd backend
npm run dev

# 终端2：启动前端
cd frontend
npm run dev
```

- 前端地址: `http://localhost:3013`
- 后端 API: `http://localhost:5679/api/v1`
- 前端自动代理 `/api` 和 `/static` 到后端

### Docker 开发热加载模式

生产 Compose 会将源码复制进镜像，修改代码后必须重建。日常开发请使用独立的 Node.js 22 热加载 Compose：后端通过 `tsx watch` 自动重启，前端 Nuxt 使用 HMR；代码文件直接挂载自本机仓库。

> 开发栈与生产栈共用当前 MySQL 数据卷和 `./data`。启动开发栈前必须关闭生产 Compose；不要同时启动两套 Compose。

```bash
# 关闭生产容器（不删除 MySQL 数据卷和素材）
docker compose down

# 启动开发栈（首次会安装依赖）
docker compose -f docker-compose.dev.yml up -d --build

# 查看状态与日志
docker compose -f docker-compose.dev.yml ps
docker compose -f docker-compose.dev.yml logs -f backend frontend
```

- 前端（Nuxt HMR）：<http://localhost:3013>
- 后端 API（tsx watch）：<http://localhost:5679/api/v1>
- 数据库：`localhost:3307`

开发 Compose 会通过 `HUOBAO_BACKEND_URL=http://backend:5679` 将 Nuxt 的 `/api` 和 `/static` 代理到后端容器；在宿主机直接执行 `npm run dev` 时仍默认代理到 `http://localhost:5679`。

验证热加载：编辑 `backend/src/` 下一个 TypeScript 文件后查看 `backend` 日志，`tsx watch` 应自动重启；编辑 `frontend/app/` 下 Vue 文件后浏览器应即时刷新或局部 HMR 更新。修改 `package-lock.json`、`Dockerfile.dev` 或 Compose 配置后，重新执行带 `--build` 的启动命令。

切回生产：

```bash
docker compose -f docker-compose.dev.yml down
docker compose up -d --build
```

#### 方式二：单服务模式

后端同时提供 API 和前端静态文件：

```bash
# 1. 构建前端
cd frontend && npm run generate

# 2. 复制构建产物到后端读取的目录（generate 产物在 .output/public，后端只读取 frontend/dist）
cp -r .output/public dist

# 3. 启动后端
cd ../backend && npm start
```

访问: `http://localhost:5679`

### 🗄️ 数据库

数据库表在首次启动时自动创建（幂等，每次启动自动重放初始化与迁移）。默认连接读取 `DATABASE_URL`，也可以通过 `MYSQL_HOST`、`MYSQL_PORT`、`MYSQL_USER`、`MYSQL_PASSWORD`、`MYSQL_DATABASE` 分项配置：

```bash
DATABASE_URL=mysql://huobao:huobao@127.0.0.1:3306/huobao_drama npm start
```

如需在应用外预建表（如 DBA 审核场景），可使用 `docker/init.sql`；schema 变更后通过 `cd backend && npx tsx scripts/export-init-sql.ts` 重新生成。

### 🔑 首次使用：配置 AI 服务

启动后所有 AI 功能（文本/生图/视频）都需要先配置模型服务，未配置时页面顶部会有横幅引导：

1. 打开「设置 → AI 服务」页
2. 使用「手动模板」按服务类型选择推荐模板，或按厂商逐个添加，支持连通性测试

配置完成横幅自动消失，即可开始创建剧集生产。

---

## 📦 部署指南

### 🐳 Docker 部署（推荐）

#### 方式一：Docker Compose（推荐）

一条命令拉起应用 + MySQL 8.4，含健康检查与启动顺序编排（应用等待 MySQL 就绪后启动，建表自动完成）：

```bash
# 构建并启动
docker compose up -d --build

# 查看日志
docker compose logs -f

# 停止服务
docker compose down
```

访问: `http://localhost:5679`

持久化数据：

| 挂载 | 内容 |
|---|---|
| `./data` | 生成的图片/视频等文件 |
| `./backend/workspace` | Agent 技能文件（设置页可在线编辑） |
| `mysql-data`(命名卷) | MySQL 数据 |

> **提示**：compose 为源码构建方式，构建过程需从外网下载 `ffmpeg-static` / `sharp` 预编译二进制，网络受限环境请先配置 npm 镜像或代理；想跳过构建可直接使用方式二的 Docker Hub 预构建镜像。

#### 方式二：Docker 命令（Docker Hub 镜像）

已发布多架构镜像（`linux/amd64` + `linux/arm64`，x86 服务器与 ARM 设备均自动匹配），无需克隆仓库、无需本地构建：

```bash
# 拉取镜像
docker pull huobao/huobao-drama:3.0.0

# 运行(MySQL 需另行准备,通过 DATABASE_URL 指向;命名卷自动从镜像初始化 skills 等内容)
docker run -d \
  --name huobao-drama \
  -p 5679:5679 \
  -v huobao-data:/app/data \
  -v huobao-workspace:/app/backend/workspace \
  -e DATABASE_URL=mysql://huobao:huobao@host.docker.internal:3306/huobao_drama \
  --restart unless-stopped \
  huobao/huobao-drama:3.0.0

# 查看日志
docker logs -f huobao-drama
```

> **注意**：Linux 用户需添加 `--add-host=host.docker.internal:host-gateway` 以访问宿主机服务

**从源码构建**（可选，需克隆仓库）：

```bash
docker build -t huobao-drama:latest .
```

**Docker 部署优势：**

- ✅ Docker Hub 预构建多架构镜像（amd64 / arm64），免构建即拉即用
- ✅ 开箱即用，内置 FFmpeg 二进制，无需系统安装
- ✅ 前后端合并为单镜像、单端口
- ✅ MySQL 健康检查 + 应用启动重试，首次部署零人工干预
- ✅ `data/` 与 `workspace/` 目录 volume 挂载，数据与技能持久化

#### 🔗 访问宿主机服务（Ollama / 本地模型）

容器内可通过 `http://host.docker.internal:端口号` 访问宿主机服务。

**配置步骤：**

1. 宿主机启动服务（监听所有接口）：

   ```bash
   export OLLAMA_HOST=0.0.0.0:11434 && ollama serve
   ```

2. 在 Web 界面「设置 → AI 服务配置」中填写：
   - Base URL: `http://host.docker.internal:11434/v1`
   - Provider: `openai`
   - Model: `qwen2.5:latest`

---

### 🏭 传统部署方式

```bash
# 1. 构建前端
cd frontend && npm run generate

# 2. 复制构建产物（generate 产物在 frontend/.output/public，后端只读取 frontend/dist，缺此步 API 正常但页面 404）
cp -r .output/public dist && cd ..

# 3. 启动后端
cd backend && npm start
```

需要上传到服务器的文件：

```
backend/                    # 后端源码 + node_modules
backend/workspace/skills/   # Agent 技能文件
frontend/dist/              # 前端构建产物
data/                       # 数据目录（首次运行自动创建）
```

#### Nginx 反向代理

```nginx
server {
    listen 80;
    server_name your-domain.com;

    # 参考视频/音频上传最大 50MB
    client_max_body_size 100m;

    # 生成的图片/视频直连磁盘，不经过 Node：sendfile 零拷贝 + 长缓存
    # （产物按 uuid 命名、内容不变，可安全 immutable 缓存）
    location /static/ {
        alias /path/to/huobao-drama/data/static/;
        sendfile on;
        tcp_nopush on;
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location / {
        proxy_pass http://localhost:5679;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
```

> 媒体加载优化：生成图片时后端会自动产出 400px 缩略图（`*_thumb.webp`）供列表页加载，视频会抽取海报帧（`*_poster.jpg`）作为封面，前端仅在点开大图/播放时才加载原文件。历史存量文件可在 `backend/` 下执行 `npm run backfill-artwork` 一次性补齐。

---

## 🎨 技术栈

### 后端

- **运行时**: Node.js 20+
- **Web 框架**: Hono
- **ORM**: Drizzle ORM + mysql2
- **AI Agent**: Mastra + AI SDK (OpenAI compatible)
- **视频处理**: FFmpeg (fluent-ffmpeg)
- **图片处理**: Sharp

### 前端

- **框架**: Nuxt 3 (SPA 模式)
- **语言**: Vue 3 + TypeScript
- **路由**: 文件路由 (Vue Router 4)
- **样式**: 纯 CSS + CSS Variables
- **图标**: Lucide Vue

---

## 📝 常见问题

### Q: 许可证允许商用吗？

A: **不允许。** 本项目采用 **CC BY-NC-SA 4.0**，含「非商业性使用」限制：个人学习、研究与自用没问题，用于商业用途需要另行取得授权。由于本项目 fork 自上游 `huobao-drama`（同样为 CC BY-NC-SA 4.0），**fork 无法单方面更换许可证**；如果后续有商业化计划，必须先与 upstream 作者确认授权，否则应仅将本项目用于非商业场景。

### Q: Docker 容器如何访问宿主机的 Ollama？

A: 使用 `http://host.docker.internal:11434/v1` 作为 Base URL。注意：
1. 宿主机 Ollama 需监听 `0.0.0.0`：`export OLLAMA_HOST=0.0.0.0:11434 && ollama serve`
2. Linux 用户使用 `docker run` 需添加：`--add-host=host.docker.internal:host-gateway`

### Q: FFmpeg 未安装或找不到？

A: 无需安装。项目内置 `ffmpeg-static` / `ffprobe-static` 二进制（本地与 Docker 均是）。如自定义 `PATH` 中的系统 FFmpeg 也不会冲突，代码优先使用内置二进制。

### Q: 页面顶部提示「尚未配置模型」？

A: 这是正常的首次部署引导。前往「设置 → AI 服务」页，用「手动模板」按服务类型添加厂商配置并做连通性测试。文本、图片、视频三类均有启用中的配置后横幅自动消失。

### Q: 前端无法连接后端 API？

A: 检查后端是否启动，端口是否正确。开发模式下前端代理配置在 `frontend/nuxt.config.ts`。

### Q: 数据库表未创建？

A: 后端会在首次启动时自动创建所有表，检查日志确认初始化是否成功。

---

## 📋 更新日志

### v3.0.0 (2026-08)

#### 🚀 部署与体验优化

- Docker 部署就绪改造
  - MySQL / 应用健康检查，应用等待数据库就绪后启动
  - 数据库初始化增加重试，容器编排下首次部署零人工干预
  - 移除系统 FFmpeg 依赖，全面使用内置二进制
  - Agent skills 目录 volume 持久化（设置页在线编辑不丢失）
  - 新增 `docker/init.sql` 及导出脚本（DBA 审核 / 预建表）
- 首次使用引导
  - 未配置 AI 服务时全站顶部横幅提示并引导至设置页
  - 未配置模型的报错中文化并指引设置页
- 视频模型默认调整为 Seedance 2.0 Fast
- 厂商收敛：仅保留 OpenAI / Gemini / 火山引擎
- 工作台：任务列表抽屉、流水线大环节状态、选择性拼接（拼接前校验视频文件存在）
- 素材库改版、@提及优化、剧集列表重构

### v2.0.0 (2026-04)

#### 🚀 重大更新

- 项目全面迁移至 TypeScript 技术栈
  - 后端：Hono + Drizzle ORM + mysql2
  - 前端：Nuxt 3 + Vue 3
  - AI Agent：Mastra 框架
- 重做单集工作台 UI 和生产流程
  - 更紧凑的控制台布局
  - 重做分镜编辑区
  - 重做镜头图、视频、合成、导出界面
- 新增 Docker 部署支持，前后端合并为单镜像
- 增加运行时 Skill 加载机制
- 扩展多厂商媒体 Adapter
  - 图片：OpenAI、Gemini、火山引擎、阿里
  - 视频：火山引擎/Seedance、Vidu、阿里
- 优化本地文件处理与参考图按需转码

### v1.0.4 (2026-01-27)

- 引入本地存储策略，规避外部资源链接失效
- Base64 参考图嵌入式传输
- 修复镜头切换状态重置问题
- 添加场景迁移至章节

### v1.0.3 (2026-01-16)

- 优化数据库并发访问性能
- Docker 跨平台支持 host.docker.internal

### v1.0.2 (2026-01-14)

- 修复视频生成 API 响应解析问题
- 添加 OpenAI Sora 视频端点配置
- 优化错误处理和日志输出

---

## 🧾 迭代日志

本地开发版的重要功能改动与真实验证记录见 [docs/iteration-logs](docs/iteration-logs/README.md)。

当前已记录：

- 视频生成参考图片、视频、音频的本地上传与资产库复用。
- MiniMax H3 提示词 Skill、独立 Agent、生成按钮及分镜 01 实测。

---

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

本项目采用 **Fork + Pull Request** 协作模式。完整流程（remote 配置、分支命名规范、提交前自检、冲突处理、PR 模板）请见 **[CONTRIBUTING.md](CONTRIBUTING.md)**，首次参与请先读一遍。

快速版：

1. Fork 本项目到自己账号
2. 添加主仓库为 upstream：`git remote add upstream https://github.com/Aibrother258/JisuVideo-ai.git`
3. 创建特性分支 (`git checkout -b feat/AmazingFeature`)
4. 提交改动 (`git commit -m 'feat: add AmazingFeature'`)
5. 推送到自己的 fork (`git push -u origin feat/AmazingFeature`)
6. 发起 Pull Request 到本仓库的 `master`

常用检查命令（提交前必跑，两项都要通过）：

```bash
cd backend && npm run typecheck
cd ../frontend && npm run build
```

---

> _"让 AI 帮我们做更有创造力的事"_

## 🔗 友情链接

本项目已获得 [LINUX DO](https://linux.do/) 社区链接认可。

- [LINUX DO](https://linux.do/) — 真正的开源精神，共建共享的技术社区

---
