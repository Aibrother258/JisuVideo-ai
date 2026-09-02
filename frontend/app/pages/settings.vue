<template>
  <div class="settings-page">
    <h1 class="page-title">设置中心</h1>
    <div class="settings-layout">
      <aside class="settings-nav">
        <div class="nav-group">
          <div class="nav-group-label">基础</div>
          <button v-for="t in baseTabs" :key="t.id" :class="['nav-item', { active: tab === t.id }]" @click="tab = t.id">
            <component :is="t.icon" :size="14" />
            {{ t.label }}
          </button>
        </div>
        <div class="nav-advanced">
          <label class="advanced-toggle">
            <span>Agent 高级配置</span>
            <input type="checkbox" v-model="showAdvanced" class="sr-only" />
            <span class="switch" :class="{ on: showAdvanced }"></span>
          </label>
          <p class="advanced-note">仅展开 Agent 配置与 Skills。工作台功能和分镜字段保持默认可见。</p>
        </div>
        <div v-if="showAdvanced" class="nav-group">
          <div class="nav-group-label">高级</div>
          <button v-for="t in advancedTabs" :key="t.id" :class="['nav-item', { active: tab === t.id }]" @click="tab = t.id">
            <component :is="t.icon" :size="14" />
            {{ t.label }}
          </button>
        </div>
      </aside>

      <div class="settings-content">

        <!-- ===== AI 服务配置 ===== -->
        <div v-if="tab === 'ai'" class="settings-scroll">
          <div class="settings-head">
            <h2 class="settings-title">AI 服务配置</h2>
            <p class="settings-desc">先用推荐模板快速落配置，再按服务类型微调。工作台创建集时会锁定所选图片和视频能力。</p>
          </div>
          <section class="card setup-panel">
            <div class="setup-panel-head compact">
              <div>
                <div class="setup-title">手动模板</div>
                <div class="setup-desc">选择服务类型后，直接用模板填充推荐的 `provider / base URL / model`。</div>
              </div>
            </div>
            <div class="template-row">
              <button
                v-for="st in serviceTypes"
                :key="st.type"
                class="template-type-chip"
                @click="startAddCfg(st.type)"
              >
                {{ st.label }}
              </button>
            </div>
          </section>
          <div class="sections">
            <section v-for="st in serviceTypes" :key="st.type" class="card svc-group">
              <div class="svc-group-head">
                <div class="svc-group-heading">
                  <span class="svc-group-title">{{ st.label }}</span>
                  <div class="svc-group-sub">{{ serviceMeta[st.type].desc }}</div>
                </div>
                <span v-if="countActive(st.type)" class="tag tag-accent">{{ countActive(st.type) }} 已启用</span>
                <button class="btn btn-ghost btn-sm ml-auto" @click="startAddCfg(st.type)"><Plus :size="13" /> 添加</button>
              </div>
              <div v-for="c in byType(st.type)" :key="c.id" class="config-row">
                <div class="provider-badge" :data-provider="c.provider">{{ c.provider.slice(0, 1).toUpperCase() }}</div>
                <div class="config-main">
                  <div class="config-line">
                    <span class="config-name">{{ c.name || `${c.provider}-${c.service_type}` }}</span>
                    <span :class="['tag', c.api_key ? 'tag-success' : 'tag-error']">{{ c.api_key ? '已配置' : '无密钥' }}</span>
                    <span v-if="!c.is_active" class="tag">已停用</span>
                  </div>
                  <div class="config-models">
                    <button
                      v-for="m in c.model" :key="m" type="button"
                      :class="['cfg-model-chip mono', { 'is-default': isDefaultModel(st.type, c, m) }]"
                      :title="isDefaultModel(st.type, c, m) ? '当前默认模型' : '设为该类型默认模型'"
                      @click="setDefaultModel(st.type, c, m)"
                    >
                      <Star v-if="isDefaultModel(st.type, c, m)" :size="9" class="cfg-model-star" />
                      {{ m }}
                    </button>
                  </div>
                  <div class="config-sub mono truncate">{{ c.base_url || '未设置 Base URL' }}</div>
                </div>
                <button class="btn btn-ghost btn-sm" @click="testExistingCfg(c)">测试</button>
                <label class="config-switch">
                  <input type="checkbox" class="sr-only" :checked="c.is_active" @change="toggleCfg(c)">
                  <span class="switch" :class="{ on: c.is_active }"></span>
                </label>
                <button class="btn btn-ghost btn-icon btn-sm" @click="startEditCfg(c)"><Pencil :size="13" /></button>
                <button class="btn btn-danger btn-icon btn-sm" @click="delCfg(c.id)"><Trash2 :size="13" /></button>
              </div>
              <p v-if="!byType(st.type).length" class="config-empty">暂无配置</p>
            </section>
          </div>
        </div>

        <!-- ===== 风格预设 ===== -->
        <div v-else-if="tab === 'styles'" class="settings-scroll">
          <div class="settings-head">
            <h2 class="settings-title">风格预设</h2>
            <p class="settings-desc">创建项目时选择的视觉风格，其英文提示词片段会自动注入角色图与场景图生成。停用的风格不出现在创建选项中。</p>
          </div>
          <section class="card svc-group">
            <div class="svc-group-head">
              <div class="svc-group-heading">
                <span class="svc-group-title">全部风格</span>
                <div class="svc-group-sub">{{ stylePresets.filter(p => p.is_active).length }} 个启用 · {{ stylePresets.length }} 个总计</div>
              </div>
              <button class="btn btn-ghost btn-sm ml-auto" @click="startAddStyle"><Plus :size="13" /> 添加</button>
            </div>
            <div v-for="p in stylePresets" :key="p.id" class="config-row">
              <div class="provider-badge style-badge"><Palette :size="15" /></div>
              <div class="config-main">
                <div class="config-line">
                  <span class="config-name">{{ p.name }}</span>
                  <span class="tag mono">{{ p.value }}</span>
                  <span v-if="!p.is_active" class="tag">已停用</span>
                </div>
                <div class="config-sub mono truncate">{{ p.prompt }}</div>
                <div v-if="p.description" class="config-sub truncate">{{ p.description }}</div>
              </div>
              <label class="config-switch">
                <input type="checkbox" class="sr-only" :checked="p.is_active" @change="toggleStyle(p)">
                <span class="switch" :class="{ on: p.is_active }"></span>
              </label>
              <button class="btn btn-ghost btn-icon btn-sm" @click="startEditStyle(p)"><Pencil :size="13" /></button>
              <button class="btn btn-danger btn-icon btn-sm" @click="styleToDelete = p"><Trash2 :size="13" /></button>
            </div>
            <p v-if="!stylePresets.length" class="config-empty">暂无风格预设</p>
          </section>
        </div>

        <!-- ===== Agent 配置 ===== -->
        <div v-else-if="tab === 'agents'" class="settings-scroll">
          <div class="settings-head">
            <h2 class="settings-title">Agent 配置</h2>
            <p class="settings-desc">高级区只保留 Agent 运行配置。这里可以调整模型、提示词和参数，保存后立即生效。</p>
          </div>
          <div class="agent-list">
            <div v-for="a in agentDefs" :key="a.type" class="card agent-card">
              <div class="agent-card-head" @click="toggleAgentEdit(a.type)">
                <div class="agent-type-badge">{{ a.icon }}</div>
                <div class="agent-card-heading">
                  <div class="agent-card-title">{{ a.label }}</div>
                  <div class="agent-card-type dim">{{ a.type }}</div>
                </div>
                <span v-if="getAgentCfg(a.type) && !getAgentCfg(a.type).is_default" class="tag tag-success">自定义</span>
                <span v-else class="tag">默认</span>
                <ChevronDown :size="14" :style="{ transform: editingAgent === a.type ? 'rotate(180deg)' : '', transition: '0.2s' }" />
              </div>
              <div v-if="editingAgent === a.type" class="agent-card-body">
                <label class="field">
                  <span class="field-label">模型 <span class="dim">(留空使用 AI 服务默认)</span></span>
                  <BaseSelect v-model="agentForm.model" :options="textModelSelectOptions" placeholder="— 使用 AI 服务默认 —" searchable />
                </label>
                <label class="field">
                  <span class="field-label">System Prompt <span class="dim">(保存为 workspace/prompts/{{ a.type }}.md)</span></span>
                  <textarea v-model="agentForm.system_prompt" class="textarea" rows="12" placeholder="Agent 系统提示词..." />
                </label>
                <div class="agent-card-foot">
                  <button class="btn btn-ghost btn-sm" @click="resetAgentPrompt(a.type)">恢复默认</button>
                  <span v-if="agentSaved === a.type" class="tag tag-success" style="margin-left:8px">
                    <Check :size="10" /> 已保存
                  </span>
                  <button class="btn btn-primary btn-sm ml-auto" :disabled="agentSaving" @click="saveAgentCfg(a.type)">
                    <Loader2 v-if="agentSaving" :size="12" class="animate-spin" />
                    保存
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- ===== Skills 编辑 ===== -->
        <div v-else-if="tab === 'skills'" class="skills-layout">
          <!-- Agent 左侧列表 -->
          <aside class="skills-agent-list">
            <div class="skills-agent-title">Agent 列表</div>
            <button
              v-for="a in agentDefs"
              :key="a.type"
              :class="['skills-agent-item', { active: selectedAgent === a.type }]"
              @click="selectAgent(a.type)"
            >
              <span class="agent-type-badge">{{ a.icon }}</span>
              <span class="skills-agent-label">{{ a.label }}</span>
              <span v-if="agentSkillCount(a.type) > 0" class="skill-count-badge">{{ agentSkillCount(a.type) }}</span>
            </button>
          </aside>

          <!-- Skill 管理右侧主区域 -->
          <div class="settings-scroll skills-main">
            <div class="settings-head skills-head">
              <span class="agent-type-badge skills-head-badge">{{ selectedAgentIcon }}</span>
              <div class="skills-head-copy">
                <h2 class="settings-title">{{ selectedAgentLabel }}</h2>
                <div class="dim" style="font-size:12px;margin-top:2px">{{ selectedAgentType }} — Skills</div>
                <p class="settings-desc">Skills 仅作为 Agent 的高级提示词层使用，不影响工作台常规功能入口。</p>
              </div>
              <button class="btn btn-primary btn-sm ml-auto" @click="startAddSkill">
                <Plus :size="13" /> 新增 Skill
              </button>
            </div>

            <!-- 无 skill 提示 -->
            <div v-if="!currentSkills.length" class="card skills-empty">
              <div class="skills-empty-icon">
                <FileText :size="24" />
              </div>
              <div class="skills-empty-title">暂无 Skill</div>
              <div class="skills-empty-desc">点击右上角「新增 Skill」创建第一个提示词文件</div>
            </div>

            <!-- Skill 列表 -->
            <div class="skill-list" v-else>
              <div v-for="s in currentSkills" :key="s.id" class="card skill-card">
                <div class="skill-card-head" @click="toggleSkillEdit(s.id)">
                  <FileText :size="14" style="color:var(--accent);flex-shrink:0" />
                  <div style="flex:1;min-width:0">
                    <div style="font-weight:600;font-size:13px">{{ s.name }}</div>
                    <div class="dim" style="font-size:11px">{{ s.description }}</div>
                  </div>
                  <button class="btn btn-danger btn-icon btn-sm" style="margin-right:4px" @click.stop="skillToDelete = s.id">
                    <Trash2 :size="13" />
                  </button>
                  <ChevronDown :size="14" :style="{ transform: editingSkill === s.id ? 'rotate(180deg)' : '', transition: '0.2s' }" />
                </div>
                <div v-if="editingSkill === s.id" class="skill-card-body">
                  <textarea
                    v-model="skillContent"
                    class="textarea mono"
                    rows="20"
                    style="font-size:12px;line-height:1.6"
                    placeholder="编写 SKILL.md 内容..."
                  />
                  <div class="skill-card-foot">
                    <span class="dim" style="font-size:11px">skills/{{ s.id }}/SKILL.md</span>
                    <span v-if="skillSaved === s.id" class="tag tag-success" style="margin-left:8px">
                      <Check :size="10" /> 已保存
                    </span>
                    <button class="btn btn-primary btn-sm ml-auto" :disabled="skillSaving" @click="saveSkill(s.id)">
                      <Loader2 v-if="skillSaving" :size="12" class="animate-spin" />
                      保存
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- AI Config Dialog -->
    <div v-if="cfgDialog" class="overlay" @click.self="cfgDialog = false">
      <form class="dialog config-dialog" @submit.prevent="saveCfg">
        <div class="dialog-head">
          <div>
            <div class="dialog-title">{{ cfgEditId ? '编辑服务配置' : `添加${serviceMeta[cfgForm.service_type].label}服务` }}</div>
            <div class="dialog-sub">推荐先选择模板，系统会自动填入更合理的 `Base URL` 与默认模型。</div>
          </div>
          <span class="tag tag-accent ml-auto">{{ serviceMeta[cfgForm.service_type].label }}</span>
        </div>
        <div class="dialog-body config-dialog-body">
          <div class="preset-picker">
            <button
              v-for="preset in presetsByType(cfgForm.service_type)"
              :key="`${cfgForm.service_type}-${preset.provider}`"
              type="button"
              class="preset-pill"
              @click="applyProviderPreset(cfgForm.service_type, preset.provider)"
            >
              {{ preset.label }}
            </button>
          </div>
          <label class="field">
            <span class="field-label">配置名称</span>
            <input v-model="cfgForm.name" class="input" placeholder="如 火宝默认图像服务" />
          </label>
          <label class="field"><span class="field-label">服务商</span>
            <BaseSelect v-model="cfgForm.provider" :options="providerSelectOptions" placeholder="选择服务商" searchable />
          </label>
          <label class="field">
            <span class="field-label">优先级</span>
            <input v-model.number="cfgForm.priority" class="input" type="number" min="0" max="999" />
            <span class="field-hint">数值越高越优先。工作台默认会优先使用同类型里优先级最高的启用配置。</span>
          </label>
          <label class="field"><span class="field-label">API Key</span><input v-model="cfgForm.api_key" class="input" type="password" placeholder="sk-..." /></label>
          <label class="field"><span class="field-label">Base URL</span><input v-model="cfgForm.base_url" class="input" placeholder="https://..." /></label>
          <label class="field">
            <span class="field-label">模型（逗号分隔）</span>
            <div class="model-input-row">
              <input v-model="cfgForm.modelStr" class="input" placeholder="model-name" />
              <button type="button" class="btn btn-ghost btn-sm model-fetch-btn" :disabled="cfgFetchingModels" @click="fetchModels">
                <Loader2 v-if="cfgFetchingModels" :size="13" class="animate-spin" />
                <RefreshCw v-else :size="13" />
                拉取模型
              </button>
            </div>
            <div v-if="fetchedModels.length" class="model-fetch-list">
              <button
                v-for="m in fetchedModels" :key="m" type="button"
                :class="['cfg-model-chip mono', { 'is-selected': isFetchedModelChecked(m) }]"
                @click="toggleFetchedModel(m)"
              >
                <Check v-if="isFetchedModelChecked(m)" :size="10" class="cfg-model-check" />
                <span v-else class="cfg-model-box" />
                {{ m }}
              </button>
            </div>
            <div v-if="fetchedModels.length" class="model-fetch-actions">
              <button type="button" class="btn btn-primary btn-sm" :disabled="!selectedFetchedCount" @click="addSelectedModelsToConfig">
                加入当前配置<template v-if="selectedFetchedCount">（{{ selectedFetchedCount }}）</template>
              </button>
              <button
                v-if="cfgForm.service_type !== 'image'" type="button" class="btn btn-ghost btn-sm"
                :disabled="!selectedFetchedCount" @click="startImageDraftFromSelection"
              >配置为生图模型</button>
            </div>
            <span v-if="fetchedModels.length" class="field-hint">勾选模型后点击「加入当前配置」写入下方字段（去重）；「配置为生图模型」可将所选预填为图片服务草稿。</span>
          </label>
          <label v-if="cfgForm.service_type === 'text'" class="field">
            <span class="field-label">Temperature <span class="dim">(留空跟随服务商默认)</span></span>
            <input v-model="cfgForm.temperature" class="input" type="number" step="0.1" min="0" max="2" placeholder="如 0.6" />
            <span class="field-hint">部分模型强制固定温度（如 kimi-k2 系只允许 0.6），报 invalid temperature 错误时在此填入对应值。</span>
          </label>
          <div v-if="cfgTestResult" class="test-result" :class="{ ok: cfgTestResult.reachable, bad: !cfgTestResult.reachable }">
            <div class="test-result-head">
              <span class="tag" :class="cfgTestResult.reachable ? 'tag-success' : 'tag-error'">{{ cfgTestResult.status || 'ERROR' }}</span>
              <span>{{ cfgTestResult.message }}</span>
            </div>
            <div class="mono test-result-url">{{ cfgTestResult.method }} {{ cfgTestResult.url }}</div>
            <div v-if="cfgTestResult.response_preview" class="mono test-result-preview">{{ cfgTestResult.response_preview }}</div>
          </div>
        </div>
        <div class="dialog-foot">
          <button type="button" class="btn btn-ghost test-draft-btn" :disabled="cfgTesting" @click="testDraftCfg">
            <Loader2 v-if="cfgTesting" :size="12" class="animate-spin" />
            <span v-else>测试配置</span>
          </button>
          <button type="button" class="btn" @click="cfgDialog = false">取消</button>
          <button type="submit" class="btn btn-primary">保存</button>
        </div>
      </form>
    </div>

    <!-- Add Skill Dialog -->
    <div v-if="addSkillDialog" class="overlay" @click.self="addSkillDialog = false">
      <form class="dialog skill-dialog" @submit.prevent="confirmAddSkill">
        <div class="dialog-head">
          <div class="dialog-title">新增 Skill — {{ selectedAgentLabel }}</div>
        </div>
        <div class="dialog-body skill-dialog-body">
          <label class="field">
            <span class="field-label">Skill 目录名 <span class="dim">(英文，唯一)</span></span>
            <input v-model="newSkillForm.id" class="input" placeholder="如 custom-extraction" />
          </label>
          <label class="field">
            <span class="field-label">名称</span>
            <input v-model="newSkillForm.name" class="input" placeholder="如 自定义提取规则" />
          </label>
          <label class="field">
            <span class="field-label">描述</span>
            <input v-model="newSkillForm.description" class="input" placeholder="简短描述此 Skill 的用途" />
          </label>
        </div>
        <div class="dialog-foot">
          <button type="button" class="btn" @click="addSkillDialog = false">取消</button>
          <button type="submit" class="btn btn-primary" :disabled="!newSkillForm.id">创建</button>
        </div>
      </form>
    </div>

    <!-- Style Preset Dialog -->
    <div v-if="styleDialog" class="overlay" @click.self="styleDialog = false">
      <form class="dialog config-dialog" @submit.prevent="saveStyle">
        <div class="dialog-head">
          <div>
            <div class="dialog-title">{{ styleEditId ? '编辑风格预设' : '添加风格预设' }}</div>
            <div class="dialog-sub">提示词片段为英文，会在生成角色图与场景图时自动拼入提示词。</div>
          </div>
          <span class="tag tag-accent ml-auto"><Palette :size="12" /> 风格</span>
        </div>
        <div class="dialog-body config-dialog-body">
          <label class="field">
            <span class="field-label">风格名称 <span class="required">*</span></span>
            <input v-model="styleForm.name" class="input" placeholder="如 3D、动漫、写实电影" />
          </label>
          <label class="field">
            <span class="field-label">风格 key <span class="required">*</span></span>
            <input v-model="styleForm.value" class="input mono" placeholder="如 3d、anime（小写字母/数字/中划线）" :disabled="!!styleEditId" />
            <span class="field-hint">存入项目的风格标识，创建后不可修改。</span>
          </label>
          <label class="field">
            <span class="field-label">提示词片段（英文） <span class="required">*</span></span>
            <textarea v-model="styleForm.prompt" class="textarea" rows="3" placeholder="如 anime style, cel shading, vibrant colors, clean line art"></textarea>
          </label>
          <label class="field">
            <span class="field-label">描述</span>
            <input v-model="styleForm.description" class="input" placeholder="一句话说明该风格的适用场景" />
          </label>
          <label class="field">
            <span class="field-label">排序</span>
            <input v-model.number="styleForm.sort_order" class="input" type="number" min="0" max="999" />
          </label>
        </div>
        <div class="dialog-foot">
          <button type="button" class="btn" @click="styleDialog = false">取消</button>
          <button type="submit" class="btn btn-primary">保存</button>
        </div>
      </form>
    </div>
    <ConfirmDialog
      :open="!!styleToDelete"
      title="删除风格预设"
      :message="`确定删除风格「${styleToDelete?.name}」？已使用此风格的项目不受影响，但删除的内置风格重启后可能恢复，建议改用「停用」。`"
      :loading="deletingStyle"
      @confirm="confirmDelStyle"
      @cancel="styleToDelete = null"
    />
    <ConfirmDialog
      :open="!!skillToDelete"
      title="删除 Skill"
      :message="`确定删除 Skill「${skillToDelete}」？删除后对应 Agent 将回退到内置默认提示词。`"
      :loading="deletingSkill"
      @confirm="confirmDelSkill"
      @cancel="skillToDelete = null"
    />
  </div>
</template>

<script setup>
import { Plus, Pencil, Trash2, FileText, ChevronDown, Check, Loader2, Bot, Cpu, Palette, Star, RefreshCw } from 'lucide-vue-next'
import BaseSelect from '~/components/BaseSelect.vue'
import { toast } from 'vue-sonner'
import { aiConfigAPI, promptAPI, skillsAPI, stylePresetAPI } from '~/composables/useApi'

const tab = ref('ai')
const showAdvanced = ref(false)
const baseTabs = [
  { id: 'ai', label: 'AI 服务', icon: Cpu },
  { id: 'styles', label: '风格预设', icon: Palette },
]
const advancedTabs = [
  { id: 'agents', label: 'Agent 配置', icon: Bot },
  { id: 'skills', label: 'Skills', icon: FileText },
]
watch(showAdvanced, (v) => {
  if (!v && advancedTabs.some(t => t.id === tab.value)) tab.value = 'ai'
})

// ===== AI Service Configs =====
const cfgs = ref([])
const cfgDialog = ref(false)
const cfgEditId = ref(null)
const cfgTesting = ref(false)
const cfgTestResult = ref(null)
const cfgFetchingModels = ref(false)
const fetchedModels = ref([])
const selectedFetchedModels = ref(new Set())
const cfgForm = reactive({ name: '', provider: '', api_key: '', base_url: '', modelStr: '', service_type: 'text', priority: 0, temperature: '' })
const serviceTypes = [{ type: 'text', label: '文本' }, { type: 'image', label: '图片' }, { type: 'video', label: '视频' }]
const providers = ['gemini', 'openai', 'volcengine', 'minimax', 'autodl']
const providerSelectOptions = computed(() => providers.map(p => ({ label: p, value: p })))
const serviceMeta = {
  text: { label: '文本', desc: '剧本改写、角色场景提取、分镜拆解等 Agent 文本能力' },
  image: { label: '图片', desc: '角色图、场景图与镜头图等静态图像生成' },
  video: { label: '视频', desc: '镜头视频直出生成，支持 Seedance、MiniMax 与 AutoDL H3 工作流' },
}
const providerPresets = {
  text: {
    gemini: { label: 'Gemini 官方', baseUrl: 'https://generativelanguage.googleapis.com', models: ['gemini-3.1-pro-preview', 'gemini-3.5-flash', 'gemini-3-flash-preview'] },
    openai: { label: 'OpenAI 官方', baseUrl: 'https://api.openai.com', models: ['deepseek-v4-pro', 'gpt-5.6-terra'] },
  },
  image: {
    gemini: { label: 'Gemini 官方', baseUrl: 'https://generativelanguage.googleapis.com', models: ['gemini-3-pro-image', 'gemini-3.1-flash-image'] },
    openai: { label: 'OpenAI 官方', baseUrl: 'https://api.openai.com', models: ['gpt-image-2'] },
  },
  video: {
    volcengine: { label: 'Seedance 2.0 官方', baseUrl: 'https://ark.cn-beijing.volces.com', models: ['doubao-seedance-2-0-fast-260128', 'doubao-seedance-2-0-260128', 'doubao-seedance-2-0-mini-260615'] },
    minimax: { label: 'MiniMax H3 官方', baseUrl: 'https://api.minimaxi.com', models: ['MiniMax-H3'] },
    autodl: { label: 'AutoDL H3 工作流', baseUrl: 'https://autodl.art', models: ['minimax_h3_image_audio_to_video_v2_15s', 'minimax_h3_lightx2v_v5_15s', 'minimax_h3_image_audio_to_video_v2', 'minimax_h3_image_audio_to_video', 'minimax_h3_lightx2v_v5', 'minimax_h3_lightx2v_no_pic', 'minimax_h3_lightx2v'] },
  },
}

function byType(t) { return cfgs.value.filter(c => c.service_type === t) }
function countActive(t) { return byType(t).filter(c => c.is_active).length }
function fmtModel(m) { return Array.isArray(m) ? m.join(', ') : m || '—' }
function presetsByType(type) {
  const group = providerPresets[type] || {}
  return Object.entries(group).map(([provider, preset]) => ({ provider, ...preset }))
}
function applyProviderPreset(type, provider) {
  const preset = providerPresets[type]?.[provider]
  if (!preset) return
  cfgForm.provider = provider
  cfgForm.base_url = preset.baseUrl
  cfgForm.modelStr = preset.models.join(', ')
  cfgForm.name = `${preset.label}-${serviceMeta[type].label}`
  fetchedModels.value = []
  selectedFetchedModels.value = new Set()
}

async function loadCfgs() { try { cfgs.value = await aiConfigAPI.list() } catch (e) { toast.error(e.message) } }

// ===== 默认模型选择 =====
// 默认解析规则与工作台/后端一致：启用配置中优先级最高者的模型列表首位
function defaultModelOf(type) {
  const active = cfgs.value.filter(c => c.service_type === type && c.is_active)
  if (!active.length) return null
  const top = [...active].sort((a, b) => (b.priority || 0) - (a.priority || 0))[0]
  const first = Array.isArray(top.model) ? top.model[0] : null
  return first ? { configId: top.id, model: first } : null
}
function isDefaultModel(type, c, m) {
  const d = defaultModelOf(type)
  return !!d && d.configId === c.id && d.model === m
}
const defaultSaving = ref(false)
async function setDefaultModel(type, c, m) {
  if (defaultSaving.value || isDefaultModel(type, c, m)) return
  defaultSaving.value = true
  try {
    const models = [m, ...(Array.isArray(c.model) ? c.model : []).filter(x => x !== m)]
    const maxPriority = Math.max(0, ...cfgs.value.filter(x => x.service_type === type).map(x => x.priority || 0))
    const payload = { model: models }
    if ((c.priority || 0) < maxPriority) payload.priority = maxPriority + 1
    if (!c.is_active) payload.is_active = true // 停用配置无法成为默认,选择即启用
    await aiConfigAPI.update(c.id, payload)
    toast.success(`默认${serviceMeta[type].label}模型已切换为 ${m}`)
    await loadCfgs()
  } catch (e) {
    toast.error(e.message)
  } finally {
    defaultSaving.value = false
  }
}
async function toggleCfg(c) { await aiConfigAPI.update(c.id, { is_active: !c.is_active }); loadCfgs() }
async function delCfg(id) { await aiConfigAPI.del(id); toast.success('已删除'); loadCfgs() }
function startAddCfg(t) {
  cfgEditId.value = null
  cfgTestResult.value = null
  fetchedModels.value = []
  selectedFetchedModels.value = new Set()
  Object.assign(cfgForm, { name: '', provider: '', api_key: '', base_url: '', modelStr: '', service_type: t, priority: 0, temperature: '' })
  const firstPreset = presetsByType(t)[0]
  if (firstPreset) applyProviderPreset(t, firstPreset.provider)
  cfgDialog.value = true
}
function startEditCfg(c) {
  cfgEditId.value = c.id
  cfgTestResult.value = null
  fetchedModels.value = []
  selectedFetchedModels.value = new Set()
  Object.assign(cfgForm, {
    name: c.name || '',
    provider: c.provider,
    api_key: c.api_key || '',
    base_url: c.base_url || '',
    modelStr: fmtModel(c.model),
    service_type: c.service_type,
    priority: c.priority ?? 0,
    temperature: c.temperature ?? '',
  })
  cfgDialog.value = true
}
async function testCfgPayload(payload) {
  cfgTesting.value = true
  try {
    cfgTestResult.value = await aiConfigAPI.test(payload)
    if (cfgTestResult.value.ok) toast.success('配置验证通过')
    else if (cfgTestResult.value.reachable) toast.warning(cfgTestResult.value.message || '端点已响应，但配置未通过验证')
    else toast.warning('端点未通过测试')
  } catch (e) {
    toast.error(e.message)
  } finally {
    cfgTesting.value = false
  }
}
const selectedFetchedCount = computed(() => selectedFetchedModels.value.size)
function isFetchedModelChecked(m) { return selectedFetchedModels.value.has(m) }
function toggleFetchedModel(m) {
  const set = new Set(selectedFetchedModels.value)
  if (set.has(m)) set.delete(m)
  else set.add(m)
  selectedFetchedModels.value = set
}
async function fetchModels() {
  if (!cfgForm.provider) { toast.warning('请先选择服务商'); return }
  if (!cfgForm.base_url) { toast.warning('请先填写 Base URL'); return }
  cfgFetchingModels.value = true
  try {
    const res = await aiConfigAPI.models({
      service_type: cfgForm.service_type,
      provider: cfgForm.provider,
      api_key: cfgForm.api_key,
      base_url: cfgForm.base_url,
    })
    if (res.ok && res.models?.length) {
      fetchedModels.value = res.models
      selectedFetchedModels.value = new Set()
      toast.success(`已拉取 ${res.models.length} 个模型，请勾选`)
    } else {
      fetchedModels.value = []
      selectedFetchedModels.value = new Set()
      toast.warning(res.message || '未拉取到模型')
    }
  } catch (e) {
    toast.error(e.message)
  } finally {
    cfgFetchingModels.value = false
  }
}
function addSelectedModelsToConfig() {
  const selected = [...selectedFetchedModels.value]
  if (!selected.length) { toast.warning('请先勾选模型'); return }
  const list = cfgForm.modelStr.split(',').map(s => s.trim()).filter(Boolean)
  let added = 0
  for (const m of selected) {
    if (!list.includes(m)) { list.push(m); added++ }
  }
  cfgForm.modelStr = list.join(', ')
  toast.success(added ? `已加入 ${added} 个模型（去重）` : '所选模型已在列表中')
}
/** 「配置为生图模型」：校验图片服务商白名单后，预填图片服务配置草稿（不落库） */
function startImageDraftFromSelection() {
  const selected = [...selectedFetchedModels.value]
  if (!selected.length) { toast.warning('请先勾选模型'); return }
  if (!providerPresets.image[cfgForm.provider]) {
    toast.warning(`服务商 ${cfgForm.provider} 不在图片服务白名单（gemini / openai），无法配置为生图模型`)
    return
  }
  // 仅预填草稿并打开对话框，由用户确认后保存；取消则完全不落库
  cfgEditId.value = null
  cfgTestResult.value = null
  Object.assign(cfgForm, {
    name: '',
    service_type: 'image',
    provider: cfgForm.provider,
    api_key: cfgForm.api_key,
    base_url: cfgForm.base_url,
    modelStr: selected.join(', '),
    priority: 0,
    temperature: '',
  })
  cfgDialog.value = true
  toast.success('已预填图片服务草稿，请核对后保存')
}
async function testDraftCfg() {
  await testCfgPayload({
    service_type: cfgForm.service_type,
    provider: cfgForm.provider,
    api_key: cfgForm.api_key,
    base_url: cfgForm.base_url,
    model: cfgForm.modelStr.split(',').map(s => s.trim()).filter(Boolean),
  })
}
async function testExistingCfg(c) {
  startEditCfg(c)
  await testCfgPayload({
    service_type: c.service_type,
    provider: c.provider,
    api_key: c.api_key || '',
    base_url: c.base_url || '',
    model: Array.isArray(c.model) ? c.model : [],
  })
}
async function saveCfg() {
  if (!cfgForm.provider) { toast.warning('选择服务商'); return }
  const models = cfgForm.modelStr.split(',').map(s => s.trim()).filter(Boolean)
  const temperature = cfgForm.temperature === '' || cfgForm.temperature === null ? null : Number(cfgForm.temperature)
  if (temperature !== null && (!Number.isFinite(temperature) || temperature < 0 || temperature > 2)) {
    toast.warning('Temperature 需为 0~2 的数字'); return
  }
  try {
    if (cfgEditId.value) await aiConfigAPI.update(cfgEditId.value, { name: cfgForm.name, provider: cfgForm.provider, api_key: cfgForm.api_key, base_url: cfgForm.base_url, model: models, priority: cfgForm.priority, temperature })
    else await aiConfigAPI.create({ service_type: cfgForm.service_type, provider: cfgForm.provider, name: cfgForm.name || `${cfgForm.provider}-${cfgForm.service_type}`, api_key: cfgForm.api_key, base_url: cfgForm.base_url, model: models, priority: cfgForm.priority, temperature })
    cfgDialog.value = false; toast.success('已保存'); loadCfgs()
  } catch (e) { toast.error(e.message) }
}

// ===== Agent Configs =====
const agentCfgs = ref([])
const editingAgent = ref(null)
const agentSaving = ref(false)
const agentSaved = ref(null)
const agentForm = reactive({ model: '', system_prompt: '' })

const agentDefs = [
  { type: 'script_rewriter', label: '剧本改写', icon: '📝' },
  { type: 'extractor', label: '角色场景提取', icon: '🔍' },
  { type: 'storyboard_breaker', label: '分镜拆解', icon: '🎬' },
  { type: 'prompt_generator', label: '提示词', icon: '🖼' },
  { type: 'minimax_h3_prompt_generator', label: 'MiniMax H3 提示词', icon: '🎞️' },
]

function getAgentCfg(type) {
  return agentCfgs.value.find(a => a.agent_type === type)
}

const textModelGroups = computed(() => {
  return cfgs.value
    .filter(c => c.service_type === 'text' && c.is_active && c.api_key)
    .map(c => ({
      label: `${c.provider} — ${c.name}`,
      models: Array.isArray(c.model) ? c.model : (c.model ? [c.model] : []),
    }))
    .filter(g => g.models.length > 0)
})

const textModelSelectOptions = computed(() =>
  textModelGroups.value.map(g => ({
    label: g.label,
    options: g.models.map(m => ({ label: m, value: m })),
  }))
)

async function loadAgents() {
  try { agentCfgs.value = await promptAPI.list() }
  catch (e) { toast.error(e.message) }
}

async function toggleAgentEdit(type) {
  if (editingAgent.value === type) { editingAgent.value = null; return }
  try {
    const cfg = await promptAPI.get(type)
    agentForm.model = cfg.model || ''
    agentForm.system_prompt = cfg.system_prompt || ''
    agentSaved.value = null
    editingAgent.value = type
  } catch (e) { toast.error(e.message) }
}

async function resetAgentPrompt(type) {
  try {
    await promptAPI.reset(type)
    await loadAgents()
    const cfg = await promptAPI.get(type)
    agentForm.model = cfg.model || ''
    agentForm.system_prompt = cfg.system_prompt || ''
    toast.success('已恢复默认提示词（prompt 文件已删除）')
  } catch (e) { toast.error(e.message) }
}

async function saveAgentCfg(type) {
  agentSaving.value = true
  agentSaved.value = null
  try {
    await promptAPI.update(type, {
      name: agentDefs.find(a => a.type === type)?.label || type,
      model: agentForm.model,
      system_prompt: agentForm.system_prompt,
    })
    await loadAgents()
    agentSaved.value = type
    toast.success(`${agentDefs.find(a => a.type === type)?.label} 配置已保存`)
    setTimeout(() => { if (agentSaved.value === type) agentSaved.value = null }, 3000)
  } catch (e) {
    toast.error(e.message)
  } finally {
    agentSaving.value = false
  }
}

// ===== Skills =====
const selectedAgent = ref('script_rewriter')
const allSkills = ref([])   // { id, name, description }[]
const editingSkill = ref(null)
const skillContent = ref('')
const skillSaving = ref(false)
const skillSaved = ref(null)
const addSkillDialog = ref(false)
const newSkillForm = reactive({ id: '', name: '', description: '' })

const selectedAgentType = computed(() => selectedAgent.value)
const selectedAgentLabel = computed(() => agentDefs.find(a => a.type === selectedAgent.value)?.label || '')
const selectedAgentIcon = computed(() => agentDefs.find(a => a.type === selectedAgent.value)?.icon || '')

// agent type 用下划线（script_rewriter），skill 目录按 Mastra 规范用连字符（script-rewriter）
const skillDirOf = (type) => type.replace(/_/g, '-')
const skillBelongsTo = (skillId, type) => {
  const dir = skillDirOf(type)
  return skillId === dir || skillId.startsWith(dir + '/')
}

function agentSkillCount(type) {
  return allSkills.value.filter(s => skillBelongsTo(s.id, type)).length
}

const currentSkills = computed(() =>
  allSkills.value.filter(s => skillBelongsTo(s.id, selectedAgent.value))
)

async function loadAllSkills() {
  try { allSkills.value = await skillsAPI.list() }
  catch (e) { toast.error(e.message) }
}

async function selectAgent(type) {
  selectedAgent.value = type
  editingSkill.value = null
}

function startAddSkill() {
  newSkillForm.id = ''
  newSkillForm.name = ''
  newSkillForm.description = ''
  addSkillDialog.value = true
}

async function confirmAddSkill() {
  if (!newSkillForm.id) return
  const skillId = `${skillDirOf(selectedAgent.value)}/${newSkillForm.id}`
  try {
    await skillsAPI.create({ id: skillId, name: newSkillForm.name, description: newSkillForm.description })
    addSkillDialog.value = false
    await loadAllSkills()
    toast.success('Skill 创建成功')
  } catch (e) {
    toast.error(e.message)
  }
}

const skillToDelete = ref(null)
const deletingSkill = ref(false)

async function confirmDelSkill() {
  const id = skillToDelete.value
  if (!id) return
  try {
    deletingSkill.value = true
    await skillsAPI.del(id)
    if (editingSkill.value === id) editingSkill.value = null
    await loadAllSkills()
    skillToDelete.value = null
    toast.success('已删除')
  } catch (e) {
    toast.error(e.message)
  } finally {
    deletingSkill.value = false
  }
}

async function toggleSkillEdit(id) {
  if (editingSkill.value === id) { editingSkill.value = null; return }
  try {
    const res = await skillsAPI.get(id)
    skillContent.value = res.content
    skillSaved.value = null
    editingSkill.value = id
  } catch (e) { toast.error(e.message) }
}

async function saveSkill(id) {
  skillSaving.value = true
  skillSaved.value = null
  try {
    await skillsAPI.update(id, skillContent.value)
    await loadAllSkills()
    skillSaved.value = id
    toast.success(`已保存`)
    setTimeout(() => { if (skillSaved.value === id) skillSaved.value = null }, 3000)
  } catch (e) {
    toast.error(e.message)
  } finally {
    skillSaving.value = false
  }
}

// ===== Style Presets =====
const stylePresets = ref([])
const styleDialog = ref(false)
const styleEditId = ref(null)
const styleForm = reactive({ name: '', value: '', prompt: '', description: '', sort_order: 0 })

async function loadStylePresets() {
  try { stylePresets.value = await stylePresetAPI.list(true) } catch (e) { toast.error(e.message) }
}

async function toggleStyle(p) {
  try {
    await stylePresetAPI.update(p.id, { is_active: !p.is_active })
    loadStylePresets()
  } catch (e) { toast.error(e.message) }
}

const styleToDelete = ref(null)
const deletingStyle = ref(false)

async function confirmDelStyle() {
  const p = styleToDelete.value
  if (!p) return
  try {
    deletingStyle.value = true
    await stylePresetAPI.del(p.id)
    styleToDelete.value = null
    toast.success('已删除')
    loadStylePresets()
  } catch (e) {
    toast.error(e.message)
  } finally {
    deletingStyle.value = false
  }
}

function startAddStyle() {
  styleEditId.value = null
  Object.assign(styleForm, {
    name: '', value: '', prompt: '', description: '',
    sort_order: (stylePresets.value.at(-1)?.sort_order ?? 0) + 1,
  })
  styleDialog.value = true
}

function startEditStyle(p) {
  styleEditId.value = p.id
  Object.assign(styleForm, {
    name: p.name,
    value: p.value,
    prompt: p.prompt,
    description: p.description || '',
    sort_order: p.sort_order ?? 0,
  })
  styleDialog.value = true
}

async function saveStyle() {
  if (!styleForm.name?.trim() || !styleForm.prompt?.trim() || (!styleEditId.value && !styleForm.value?.trim())) {
    toast.warning('名称、key、提示词片段必填')
    return
  }
  try {
    if (styleEditId.value) {
      await stylePresetAPI.update(styleEditId.value, {
        name: styleForm.name,
        prompt: styleForm.prompt,
        description: styleForm.description,
        sort_order: styleForm.sort_order,
      })
    } else {
      await stylePresetAPI.create({ ...styleForm })
    }
    styleDialog.value = false
    toast.success('已保存')
    loadStylePresets()
  } catch (e) { toast.error(e.message) }
}

onMounted(() => { loadCfgs(); loadAgents(); loadAllSkills(); loadStylePresets() })
</script>

<style scoped>
.settings-page { display: flex; flex-direction: column; height: 100%; background: var(--bg-base); }
.page-title {
  font-size: 32px; font-weight: 800; letter-spacing: -0.02em;
  color: var(--text-0); padding: 24px 32px 16px;
}

.settings-layout { display: flex; flex: 1; min-height: 0; }

.settings-nav {
  width: 220px; flex-shrink: 0; padding: 4px 12px 16px; border-right: 1px solid var(--border);
  display: flex; flex-direction: column; gap: 14px;
}
.nav-group { display: flex; flex-direction: column; gap: 2px; }
.nav-group-label {
  font-size: 11px; font-weight: 650; color: var(--text-3);
  letter-spacing: 0.06em; padding: 8px 12px 4px;
}
.nav-item {
  display: flex; align-items: center; gap: 8px;
  padding: 8px 12px; font-size: 13px; font-weight: 550;
  border: none; border-radius: var(--radius); background: transparent; color: var(--text-1);
  cursor: pointer; transition: all 0.16s var(--ease-out); text-align: left; width: 100%;
}
.nav-item:hover { background: var(--bg-hover); color: var(--text-0); }
.nav-item.active { background: var(--accent-bg); color: var(--accent-text); font-weight: 650; }
.nav-item:focus-visible { outline: none; box-shadow: 0 0 0 3.5px var(--button-focus); }

.nav-advanced {
  padding: 12px 4px;
  border-top: 1px solid var(--border);
  border-bottom: 1px solid var(--border);
}
.advanced-toggle {
  display: flex; align-items: center; justify-content: space-between; gap: 10px;
  padding: 0 8px; font-size: 12.5px; font-weight: 550; color: var(--text-1); cursor: pointer;
}
.advanced-toggle .switch { width: 38px; height: 23px; }
.advanced-toggle .switch::after { width: 19px; height: 19px; }
.advanced-toggle .switch.on::after { transform: translateX(15px); }
.advanced-toggle input:focus-visible + .switch { box-shadow: 0 0 0 3.5px var(--button-focus); }
.advanced-note {
  margin: 8px 8px 0;
  font-size: 11px;
  line-height: 1.45;
  color: var(--text-3);
}

.settings-content { flex: 1; min-width: 0; min-height: 0; overflow: hidden; }
.settings-scroll { height: 100%; overflow-y: auto; padding: 24px 40px 48px; max-width: 840px; margin: 0 auto; animation: fadeUp 0.3s var(--ease-out); }
.settings-head { margin-bottom: 20px; }
.settings-title { font-size: 22px; font-weight: 800; letter-spacing: -0.02em; }
.settings-desc { font-size: 13px; color: var(--text-2); margin-top: 6px; }

.setup-title { font-size: 15px; font-weight: 700; color: var(--text-0); }
.setup-desc { font-size: 12.5px; color: var(--text-2); margin-bottom: 14px; }

/* 手动模板 */
.setup-panel { padding: 18px 20px; margin-bottom: 16px; }
.setup-panel-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  margin-bottom: 14px;
}
.setup-panel-head.compact { margin-bottom: 12px; }
.template-row { display: flex; flex-wrap: wrap; gap: 8px; }
.template-type-chip {
  min-height: var(--button-height-sm);
  padding: 0 14px;
  border: none;
  border-radius: var(--radius-pill);
  background: var(--button-bg);
  color: var(--text-1);
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
  transition: all 0.16s var(--ease-out);
}
.template-type-chip:hover { background: var(--button-bg-hover); color: var(--text-0); }
.template-type-chip:focus-visible { outline: none; box-shadow: 0 0 0 3.5px var(--button-focus); }

/* 按服务类型分组的配置卡 */
.sections { display: flex; flex-direction: column; gap: 16px; }
.svc-group { overflow: hidden; }
.svc-group-head {
  display: flex; align-items: center; gap: 10px;
  padding: 14px 20px;
  border-bottom: 1px solid var(--border);
}
.svc-group-heading { min-width: 0; }
.svc-group-title { font-size: 14px; font-weight: 700; color: var(--text-0); }
.svc-group-sub { font-size: 11.5px; color: var(--text-3); margin-top: 2px; }
.config-row { display: flex; align-items: center; gap: 12px; padding: 12px 20px; }
.config-row + .config-row { border-top: 1px solid var(--border); }
.provider-badge {
  width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 14px; color: #fff;
  background: var(--accent);
  box-shadow: 0 1px 4px rgba(0,0,0,0.12);
}
.provider-badge[data-provider="openai"] { background: #10a37f; }
.provider-badge[data-provider="gemini"] { background: #4285f4; }
.provider-badge[data-provider="volcengine"] { background: #ff5c39; }
.config-main { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 3px; }
.config-line { display: flex; align-items: center; gap: 8px; min-width: 0; }
.config-name { font-size: 13.5px; font-weight: 650; color: var(--text-0); }
.config-sub { font-size: 11.5px; color: var(--text-3); }
.config-models { display: flex; flex-wrap: wrap; gap: 4px; margin: 3px 0; }
.cfg-model-chip {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 1px 7px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: transparent;
  color: var(--text-2);
  font-size: 10.5px;
  cursor: pointer;
  transition: border-color 0.12s, color 0.12s, background 0.12s;
}
.cfg-model-chip:hover { border-color: var(--accent); color: var(--accent); }
.cfg-model-chip.is-default {
  border-color: var(--accent);
  background: var(--accent-bg, rgba(0,113,227,0.10));
  color: var(--accent);
  font-weight: 600;
  cursor: default;
}
.cfg-model-star { fill: currentColor; }
.cfg-model-chip.is-selected {
  border-color: var(--accent);
  background: var(--accent-bg, rgba(0,113,227,0.10));
  color: var(--accent);
  font-weight: 600;
}
.model-input-row { display: flex; gap: 8px; }
.model-input-row .input { flex: 1; }
.model-fetch-btn { flex-shrink: 0; white-space: nowrap; }
.model-fetch-list {
  display: flex; flex-wrap: wrap; gap: 4px;
  max-height: 120px; overflow-y: auto;
  padding: 8px; border: 1px dashed var(--border); border-radius: var(--radius);
  background: var(--bg-0);
}
.model-fetch-list .cfg-model-chip { padding: 3px 9px; font-size: 11px; gap: 4px; }
.cfg-model-box {
  width: 11px; height: 11px; flex-shrink: 0; border-radius: 3px;
  border: 1px solid var(--border-strong, var(--border));
  background: transparent;
}
.cfg-model-chip.is-selected .cfg-model-box {
  border-color: var(--accent);
  background: var(--accent);
}
.cfg-model-check { color: #fff; flex-shrink: 0; }
.model-fetch-actions { display: flex; gap: 8px; margin-top: 6px; }
.config-empty { font-size: 12px; color: var(--text-3); padding: 14px 20px; }
.config-switch { display: inline-flex; flex-shrink: 0; cursor: pointer; }
.config-switch input:focus-visible + .switch { box-shadow: 0 0 0 3.5px var(--button-focus); }
.btn-icon.btn-sm { width: 30px; min-width: 30px; height: 30px; min-height: 30px; }

/* Agent */
.agent-list { display: flex; flex-direction: column; gap: 10px; }
.agent-card { overflow: hidden; }
.agent-card-head { display: flex; align-items: center; gap: 12px; padding: 14px 18px; cursor: pointer; transition: background 0.15s; }
.agent-card-head:hover { background: var(--bg-hover); }
.agent-type-badge {
  width: 36px; height: 36px; border-radius: 10px;
  background: var(--accent-bg); color: var(--accent-text);
  display: flex; align-items: center; justify-content: center;
  font-size: 16px; flex-shrink: 0;
}
.agent-card-heading { flex: 1; min-width: 0; }
.agent-card-title { font-size: 13.5px; font-weight: 650; color: var(--text-0); }
.agent-card-type { font-size: 11.5px; margin-top: 1px; }
.agent-card-body { padding: 16px 18px 18px; display: flex; flex-direction: column; gap: 12px; border-top: 1px solid var(--border); }
.agent-card-foot { display: flex; align-items: center; gap: 8px; padding-top: 4px; }

/* Skills 布局 */
.skills-layout { display: flex; height: 100%; overflow: hidden; }
.skills-agent-list {
  width: 210px; flex-shrink: 0; border-right: 1px solid var(--border);
  display: flex; flex-direction: column;
  overflow-y: auto; padding: 4px 10px 16px;
}
.skills-agent-title {
  font-size: 11px; font-weight: 650; letter-spacing: 0.06em;
  color: var(--text-3); padding: 8px 10px 4px;
}
.skills-agent-item {
  display: flex; align-items: center; gap: 8px;
  padding: 7px 10px; font-size: 13px; font-weight: 550; cursor: pointer;
  border: none; border-radius: var(--radius); background: transparent; color: var(--text-1);
  transition: all 0.16s var(--ease-out); width: 100%; text-align: left;
}
.skills-agent-item:hover { background: var(--bg-hover); color: var(--text-0); }
.skills-agent-item.active { background: var(--accent-bg); color: var(--accent-text); font-weight: 650; }
.skills-agent-item:focus-visible { outline: none; box-shadow: 0 0 0 3.5px var(--button-focus); }
.skills-agent-item .agent-type-badge { width: 26px; height: 26px; border-radius: 8px; font-size: 13px; }
.skills-agent-label { flex: 1; min-width: 0; }
.skill-count-badge {
  font-size: 10px; font-weight: 700; font-family: var(--font-mono);
  background: rgba(0,0,0,0.06); color: var(--text-2);
  padding: 1px 6px; border-radius: 99px;
}
.skills-agent-item.active .skill-count-badge { background: var(--accent-bg); color: var(--accent-text); }
.skills-main { flex: 1; min-width: 0; }
.skills-main.settings-scroll { max-width: 900px; }
.skills-head { display: flex; align-items: flex-start; gap: 12px; }
.skills-head-badge { width: 32px; height: 32px; font-size: 16px; }
.skills-head-copy { min-width: 0; }
.skills-empty { padding: 48px 24px; text-align: center; }
.skills-empty-icon {
  width: 56px; height: 56px; border-radius: 16px; margin: 0 auto 12px;
  background: var(--accent-bg); color: var(--accent-text);
  display: flex; align-items: center; justify-content: center;
}
.skills-empty-title { font-size: 14px; font-weight: 650; color: var(--text-0); }
.skills-empty-desc { font-size: 12px; color: var(--text-3); margin-top: 4px; }

/* Skill */
.skill-list { display: flex; flex-direction: column; gap: 10px; }
.skill-card { overflow: hidden; }
.skill-card-head { display: flex; align-items: center; gap: 10px; padding: 12px 16px; cursor: pointer; transition: background 0.15s; }
.skill-card-head:hover { background: var(--bg-hover); }
.skill-card-body { padding: 14px 16px 16px; display: flex; flex-direction: column; gap: 10px; border-top: 1px solid var(--border); }
.skill-card-foot { display: flex; align-items: center; gap: 8px; }

/* Shared */
.field { display: flex; flex-direction: column; gap: 5px; }
.field-label { font-size: 12px; font-weight: 550; color: var(--text-1); }
.field-hint { font-size: 11px; color: var(--text-3); margin-top: 2px; }
.required { color: var(--error); }
.field-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

/* Dialogs */
.config-dialog { width: min(720px, calc(100vw - 40px)); }
.config-dialog-body { display: flex; flex-direction: column; gap: 14px; }
.skill-dialog { width: 440px; }
.skill-dialog-body { display: flex; flex-direction: column; gap: 12px; }
.dialog-sub { margin-top: 4px; font-size: 12px; color: var(--text-2); }
.test-draft-btn { margin-right: auto; }
.preset-picker { display: flex; flex-wrap: wrap; gap: 8px; }
.preset-pill {
  min-height: var(--button-height-sm);
  padding: 0 14px;
  border: none;
  border-radius: var(--radius-pill);
  background: var(--button-bg);
  color: var(--text-1);
  font-size: 12px;
  font-weight: 600;
  line-height: 1;
  cursor: pointer;
  transition: all 0.16s var(--ease-out);
}
.preset-pill:hover { background: var(--button-bg-hover); color: var(--text-0); }
.preset-pill:focus-visible { outline: none; box-shadow: 0 0 0 3.5px var(--button-focus); }
.test-result {
  display: flex;
  flex-direction: column;
  gap: 8px;
  border-radius: var(--radius-lg);
  padding: 12px 14px;
  border: 1px solid var(--border);
  background: var(--bg-0);
}
.test-result.ok { border-color: rgba(52,199,89,0.4); background: var(--success-bg); }
.test-result.bad { border-color: rgba(255,59,48,0.4); background: var(--error-bg); }
.test-result-head {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-1);
}
.test-result-url,
.test-result-preview {
  font-size: 11px;
  color: var(--text-2);
  word-break: break-all;
}
</style>
