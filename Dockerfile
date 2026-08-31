# ── 国内镜像源(可用 --build-arg 覆盖)──────────────────────────
#   APT_MIRROR: 清华 mirrors.tuna.tsinghua.edu.cn(默认) / 阿里云 mirrors.aliyun.com / 中科大 mirrors.ustc.edu.cn
#   NPM_REGISTRY: 默认 npmmirror(淘宝源)
#   pip: 清华 pypi(Stage 2 预置 /etc/pip.conf,装 python 包时自动生效)

# ── Stage 1: Build frontend ──────────────────────────────────
FROM node:20-slim AS frontend-build

ARG NPM_REGISTRY=https://registry.npmmirror.com
RUN npm config set registry "$NPM_REGISTRY"

WORKDIR /app/frontend
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run generate

# ── Stage 2: Build backend native modules ────────────────────
FROM node:20-slim AS backend-build

ARG APT_MIRROR=mirrors.aliyun.com
ARG NPM_REGISTRY=https://registry.npmmirror.com

# apt 换国内源: Debian 12 (bookworm) 是 deb822 格式的 debian.sources,同时兼容旧版 sources.list
RUN set -eux; \
    for f in /etc/apt/sources.list.d/debian.sources /etc/apt/sources.list; do \
      if [ -f "$f" ]; then \
        sed -i -e "s|deb.debian.org|${APT_MIRROR}|g" \
               -e "s|security.debian.org|${APT_MIRROR}|g" "$f"; \
      fi; \
    done

# pip 换国内源(当前构建未直接用 pip,预置配置;阿里云: https://mirrors.aliyun.com/pypi/simple/)
RUN printf '[global]\nindex-url = https://pypi.tuna.tsinghua.edu.cn/simple\n' > /etc/pip.conf

RUN npm config set registry "$NPM_REGISTRY"

# ffmpeg-static postinstall 从 GitHub releases 下载二进制,改走 npmmirror 镜像;
# disturl 供 node-gyp 下载 node headers 时使用
ENV FFMPEG_BINARIES_URL=https://registry.npmmirror.com/-/binary/ffmpeg-static \
    npm_config_disturl=https://registry.npmmirror.com/-/binary/node

RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 make g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app/backend
COPY backend/package.json backend/package-lock.json ./

# Production deps only (native modules compiled here)
RUN npm ci --omit=dev

# ── Stage 3: Production image (lean) ────────────────────────
FROM node:20-slim

ARG NPM_REGISTRY=https://registry.npmmirror.com

# tsx 直接运行 TS 源码;ffmpeg 用 npm 包 ffmpeg-static/ffprobe-static 内置二进制,无需系统安装
RUN npm config set registry "$NPM_REGISTRY" && npm i -g tsx

WORKDIR /app

# Pre-built node_modules (production only, native modules ready)
COPY --from=backend-build /app/backend/node_modules ./backend/node_modules
COPY backend/package.json backend/package-lock.json ./backend/

# Backend source
COPY backend/src ./backend/src
COPY backend/tsconfig.json ./backend/

# Frontend static output
COPY --from=frontend-build /app/frontend/.output/public ./frontend/dist

# Skills
COPY backend/workspace/skills/ ./backend/workspace/skills/

RUN mkdir -p data/static

ENV NODE_ENV=production
ENV PORT=5679

EXPOSE 5679
VOLUME ["/app/data"]

CMD ["tsx", "backend/src/index.ts"]
