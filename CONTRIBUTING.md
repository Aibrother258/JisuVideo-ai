# 协作开发指南（Fork 模式）

本项目采用 **Fork + Pull Request** 协作模式：每位协作者在自己账号下维护一个 fork，所有改动通过 PR 汇入主仓库。

---

## 一、仓库关系与术语

```
chatfire-AI/huobao-drama          ← 上游原项目（只读，不用管）
        │  fork
        ▼
Aibrother258/JisuVideo-ai         ← 主协作仓库（PR 都发到这里）
        │  fork
        ▼
<你的用户名>/JisuVideo-ai         ← 你自己的 fork（你推代码的地方）
```

### 最容易搞混的一点：`origin` / `upstream` 对不同人含义不同

| 角色 | `origin` 指 | `upstream` 指 |
|---|---|---|
| **主仓库 owner**（Aibrother258） | Aibrother258/JisuVideo-ai | chatfire-AI/huobao-drama |
| **协作者**（本文读者） | **你自己的 fork** | **Aibrother258/JisuVideo-ai** |

> 文档里的命令以**协作者视角**编写。看到 `upstream` 一律理解成"主仓库 Aibrother258/JisuVideo-ai"。

---

## 二、初次设置（只需做一次）

### 1. Fork
打开 <https://github.com/Aibrother258/JisuVideo-ai>，点右上角 **Fork** → 选自己的账号 → **Create fork**。

### 2. 克隆并配置 remote

```bash
# 克隆你自己的 fork
git clone https://github.com/<你的用户名>/JisuVideo-ai.git
cd JisuVideo-ai

# 添加主仓库为 upstream
git remote add upstream https://github.com/Aibrother258/JisuVideo-ai.git

# 验证
git remote -v
# origin    https://github.com/<你的用户名>/JisuVideo-ai.git   ← 你推代码的地方
# upstream  https://github.com/Aibrother258/JisuVideo-ai.git   ← 你发 PR 的目标
```

### 3. 安装依赖

```bash
cd backend  && npm install
cd ../frontend && npm install
```

> Node.js 版本要求 **20+**，npm **9+**。FFmpeg 无需安装（项目内置二进制）。

---

## 三、日常开发流程

### 开工前：先同步主仓库最新代码

```bash
git fetch upstream
git checkout master
git merge upstream/master      # 快进合并，不要用 rebase
git push origin master         # 让自己的 fork 也保持最新
```

### 开新分支

```bash
git checkout -b feat/我要做的东西
```

分支命名规范：

| 前缀 | 用途 | 示例 |
|---|---|---|
| `feat/` | 新功能 | `feat/shot-batch-regenerate` |
| `fix/` | 修 bug | `fix/export-audio-missing` |
| `perf/` | 性能优化 | `perf/storyboard-list-virtual-scroll` |
| `refactor/` | 重构（不改功能） | `refactor/split-episode-panel` |
| `docs/` | 文档 | `docs/deploy-nginx-notes` |
| `test/` | 补测试 | `test/episode-script-state` |

### 干活与提交

- **小步提交**：完成一个独立的小改动就 commit，不要攒成一天一个巨型提交
- **一个分支只做一件事**，做完立刻发 PR 合掉，不要长期养分支
- 提交信息格式：`<类型>: <一句话说明>`

```bash
git add -A
git commit -m "fix: 修复分镜导出时音轨丢失"
```

类型：`feat` / `fix` / `perf` / `refactor` / `docs` / `test` / `chore`

### 提交前自检（必做）

```bash
# 1. 后端类型检查
cd backend  && npm run typecheck

# 2. 前端构建
cd ../frontend && npm run build

# 3. 改动涉及测试覆盖的逻辑时，跑测试
cd backend  && npm test
cd ../frontend && npm test
```

**两条自检命令必须全绿才能推送。** 构建失败会导致 PR 无法合并。

### 推送

```bash
git push -u origin feat/我要做的东西
```

---

## 四、发起 Pull Request

1. 打开自己的 fork 页面，GitHub 通常会显示黄色提示条 → 点 **Compare & pull request**
2. 确认合并方向（**最容易填错的地方**）：

   ```
   base repository: Aibrother258/JisuVideo-ai   base: master
   head repository: <你的用户名>/JisuVideo-ai   compare: feat/我要做的东西
   ```

   > 如果默认指向了 `chatfire-AI/huobao-drama`，说明选错 base 了，手动改回来。

3. **勾选 `Allow edits by maintainers`** —— 方便 owner 直接帮你修小问题，不用反复来回
4. 标题与描述按 PR 模板填写，说清楚「改了什么 / 为什么 / 怎么自测的」
5. 指定至少一位 reviewer

### PR 合并后

```bash
git checkout master
git pull upstream master
git push origin master
git branch -d feat/我要做的东西     # 删本地分支
git push origin --delete feat/我要做的东西   # 删 fork 上的分支
```

PR 页面合并时建议选 **Squash and merge**，主仓库历史更清爽。

---

## 五、同步上游原项目

主仓库 owner 负责跟进 `chatfire-AI/huobao-drama` 的更新并合入 master；协作者只需按第三节同步 `upstream` 即可，**不要自己添加原项目为 remote**，避免方向搞混。

---

## 六、防止冲突的约定

1. **改同一个文件前先在群里说一声**，尤其是 `frontend/app/views/drama/episode.vue` 这类大文件
2. **分支活不过 3 天** —— 分支活得越久，合回来冲突越痛
3. **不要提交生成物**：`data/`（生成的图片/视频）、`dist/`、`.output/`、`node_modules/` 都已在 `.gitignore` 中，提交前用 `git status` 确认没有误加
4. **不要提交密钥**：AI 服务的 API Key 在 Web 界面「设置 → AI 服务」配置并存库，**不要写进代码或配置文件**
5. 遇到冲突不会解就喊人，别硬来

### 冲突解决（自己的分支落后于主仓库时）

```bash
git fetch upstream
git merge upstream/master
# 冲突文件会标出 <<<<<<< 区块，逐个改好后：
git add <冲突文件>
git commit          # 不要改默认提交信息
git push origin feat/我要做的东西
```

---

## 七、本地开发要点

### 端口

| 服务 | 地址 |
|---|---|
| 前端（Nuxt dev） | <http://localhost:3013> |
| 后端 API | <http://localhost:5679/api/v1> |

### 启动

```bash
# 终端 1
cd backend && npm run dev

# 终端 2
cd frontend && npm run dev
```

### 数据库

表在首次启动时自动创建，无需手动初始化。默认连接 `MYSQL_HOST=127.0.0.1:3306`，库名 `huobao_drama`，也可通过 `DATABASE_URL` 整体指定。

### 目录结构

```
frontend/   Nuxt 3 + Vue 3 + TypeScript（纯 CSS，无 UI 框架）
backend/    Hono + Drizzle ORM + Mastra AI Agents + mysql2
backend/workspace/skills/   Agent 技能定义（注意：此目录受 git 跟踪）
data/       运行时生成的素材（已忽略，不入库）
docker/     数据库初始化脚本
docs/       设计文档、迭代日志、PR 记录
```

> `backend/workspace/` 下只有 `skills/` 受版本控制，其余产出物已忽略。修改技能文件后请确认提交的是 `skills/` 目录内的内容。

---

## 八、许可证提醒

本项目采用 **CC BY-NC-SA 4.0**，含**非商业性使用**限制：个人学习、研究、自用没问题，**商用需另行取得授权**。

由于项目 fork 自上游 `chatfire-AI/huobao-drama`（同为 CC BY-NC-SA 4.0），**任何 fork 都无法单方面更换许可证**。提交 PR 即表示你同意你的贡献同样以此许可证发布。

---

## 九、常见问题

**Q：`git push` 提示权限不足（403 / Permission denied）？**
A：你推错 remote 了。协作者只能推自己的 `origin`（自己的 fork），不能直接推 `upstream`。

**Q：PR 里显示了很多不该有的提交？**
A：你的分支是从过时的 master 拉的。执行第六节的合并步骤，把 `upstream/master` 合进来再推。

**Q：前端页面 404 但 API 正常？**
A：单服务模式下需要先把构建产物拷到 `frontend/dist`：
```bash
cd frontend && npm run generate && cp -r .output/public dist
```

**Q：提示「尚未配置模型」？**
A：正常。去「设置 → AI 服务」用「手动模板」添加文本/图片/视频三类配置即可，配置存数据库，不进代码。
