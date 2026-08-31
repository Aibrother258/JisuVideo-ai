/**
 * Agent 工作区（Workspace）— Mastra 原生能力
 * 每个 Agent 一个 Workspace：
 * - filesystem：jail 到 backend/workspace/ 目录，Agent 获得文件读写工具
 * - skills：从 workspace/skills/ 下注册各 Agent 专属的 SKILL.md
 * 注入 instructions 时仍拼接技能全文（原生注入只有元数据，全文注入保证行为一致）
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { Workspace, LocalFilesystem } from '@mastra/core/workspace'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const WORKSPACE_DIR = path.resolve(__dirname, '../../workspace')
const SKILLS_DIR = path.join(WORKSPACE_DIR, 'skills')

// 启动时确保工作目录存在（Agent 文件读写的 jail 根）
fs.mkdirSync(SKILLS_DIR, { recursive: true })

/** 每个 Agent 注册的 skill 目录（相对 workspace/skills/，含子规范目录；目录名需符合 Agent Skills 规范：小写+连字符） */
const AGENT_SKILL_MAP: Record<string, string[]> = {
  script_rewriter: ['script-rewriter'],
  extractor: ['extractor'],
  storyboard_breaker: ['storyboard-breaker'],
  prompt_generator: [
    'prompt-generator/character-prompt',
    'prompt-generator/scene-prompt',
    'prompt-generator/prop-prompt',
    'prompt-generator/video-prompt',
  ],
  minimax_h3_prompt_generator: ['minimax-h3-prompt-generator'],
}

/** 每个 Agent 的 Workspace（filesystem 工作目录 + 原生技能注册）
 *  skills 用动态解析器按目录前缀匹配：设置页新建的子技能无需重启即可被发现 */
export const skillWorkspaces: Record<string, Workspace> = Object.fromEntries(
  Object.entries(AGENT_SKILL_MAP).map(([agentType, prefixes]) => [
    agentType,
    new Workspace({
      id: `workspace-${agentType}`,
      name: `${agentType} workspace`,
      filesystem: new LocalFilesystem({ basePath: WORKSPACE_DIR }),
      skills: () => scanSkillPaths().filter(p =>
        prefixes.some(prefix => p === `skills/${prefix}` || p.startsWith(`skills/${prefix}/`))),
    }),
  ]),
)

/** 递归扫描 workspace/skills/ 下所有含 SKILL.md 的目录（相对 workspace 根的路径） */
function scanSkillPaths(): string[] {
  const found: string[] = []
  const walk = (dir: string, prefix: string) => {
    if (!fs.existsSync(dir)) return
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name
      const full = path.join(dir, entry.name)
      if (fs.existsSync(path.join(full, 'SKILL.md'))) found.push(`skills/${rel}`)
      walk(full, rel)
    }
  }
  walk(SKILLS_DIR, '')
  return found
}

/**
 * 技能管理 Workspace（设置页 CRUD 用）
 * skills 用动态解析器，新建/删除技能目录后无需重启即可发现
 */
export const skillsManagerWorkspace = new Workspace({
  id: 'workspace-skills-manager',
  name: 'skills manager',
  filesystem: new LocalFilesystem({ basePath: WORKSPACE_DIR }),
  skills: () => scanSkillPaths(),
})

function formatSkillSection(skillId: string, content: string): string {
  return [`## Skill: ${skillId}`, content].join('\n')
}

/** 读取 Agent 专属技能全文（经 workspace.skills API，保持原注入格式）
 *  AGENT_SKILL_MAP 的目录按前缀匹配：目录自身及其子目录下所有 SKILL.md 都会注入，
 *  因此设置页新建的子技能（如 storyboard-breaker/xxx）无需改代码即可生效 */
export async function loadAgentSkills(agentType: string): Promise<string> {
  const workspace = skillWorkspaces[agentType]
  const prefixes = AGENT_SKILL_MAP[agentType] || []
  if (!workspace || !prefixes.length) return ''

  const allPaths = scanSkillPaths().map(p => p.replace(/^skills\//, ''))
  const relPaths = allPaths.filter(p =>
    prefixes.some(prefix => p === prefix || p.startsWith(prefix + '/')))

  const contents: string[] = []
  for (const relPath of relPaths) {
    const skill = await workspace.skills?.get(`skills/${relPath}`)
    const body = skill?.instructions?.trim()
    if (body) contents.push(formatSkillSection(relPath, body))
  }

  if (!contents.length) return ''

  return [
    '以下是该 Agent 专属的项目技能规范（SKILL.md）。',
    '不同 Agent 会加载不同 skill；你只需要遵守当前注入的这些技能。',
    '你必须在不违背当前工具边界的前提下优先遵守这些规范；若与用户明确要求冲突，以用户要求为准。',
    '',
    contents.join('\n\n'),
  ].join('\n')
}

/**
 * 强制重新扫描全部 Agent 的技能（SKILL.md 编辑后调用）
 * maybeRefresh 负责感知目录增删（动态 resolver 路径变化），refresh 负责内容更新
 * （目录 mtime 不会因文件内容编辑而更新，单靠 maybeRefresh 的 staleness 检查不可靠）
 */
export async function refreshSkillWorkspaces(): Promise<void> {
  await Promise.all(
    [...Object.values(skillWorkspaces), skillsManagerWorkspace]
      .map(async workspace => {
        await workspace.skills?.maybeRefresh()
        await workspace.skills?.refresh()
      }),
  )
}
