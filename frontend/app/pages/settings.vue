<template>
  <div class="settings-page">
    <div class="page-head">
      <h1 class="page-title">设置中心</h1>
      <p class="page-head-sub">服务、风格预设与 Agent 提示词统一在这里维护，保存即生效</p>
    </div>
    <div class="settings-layout">
      <aside class="settings-nav" :style="{ width: `${navWidth}px` }">
        <div v-for="g in navGroups" :key="g.id" class="nav-group">
          <div class="nav-group-label">{{ g.label }}</div>
          <button
            v-for="t in g.items"
            :key="t.id"
            :class="['nav-item', { active: tab === t.id }]"
            :aria-current="tab === t.id ? 'page' : undefined"
            @click="tab = t.id"
          >
            <component :is="t.icon" :size="14" />
            {{ t.label }}
          </button>
        </div>
      </aside>

      <div
        class="pane-resizer"
        role="separator"
        aria-orientation="vertical"
        tabindex="0"
        :aria-valuenow="navWidth"
        aria-valuemin="168"
        aria-valuemax="300"
        aria-label="调整一级导航宽度"
        @pointerdown="startPaneResize('nav', $event)"
        @dblclick="resetPaneWidth('nav')"
        @keydown="onPaneResizeKey('nav', $event)"
      />

      <!-- 中间二级目录：当前 tab 下的章节 / Agent 子列表 -->
      <aside class="settings-subnav" :style="{ width: `${subWidth}px` }" aria-label="二级目录">
        <div class="subnav-head">
          <component :is="curTabMeta.icon" :size="15" class="subnav-head-icon" />
          <div class="subnav-head-copy">
            <div class="subnav-title">{{ curTabMeta.title }}</div>
            <div class="subnav-desc">{{ curTabMeta.desc }}</div>
          </div>
        </div>
        <div class="subnav-body">
          <template v-if="tab !== 'skills'">
            <div v-if="tab === 'agents' && agentsLoading" class="subnav-loading">
              <div v-for="i in 3" :key="i" class="subnav-skel-row">
                <div class="app-skeleton-line" style="width:26px;height:26px;border-radius:8px;flex-shrink:0"></div>
                <div class="app-skeleton-line" style="width:72%;height:12px"></div>
              </div>
            </div>
            <div v-else-if="tab === 'agents' && agentsError" class="subnav-error">
              <span>Agent 列表加载失败</span>
              <button class="btn btn-ghost btn-sm" @click="loadAgents(true)"><RefreshCw :size="11" /> 重试</button>
            </div>
            <p v-else-if="tab === 'agents' && !agentList.length" class="config-empty">Agent 列表为空，请检查后端服务</p>
            <div v-else-if="tab === 'styles' && styleLoading" class="subnav-loading">
              <div v-for="i in 4" :key="i" class="subnav-skel-row">
                <div class="app-skeleton-line" style="width:14px;height:14px;border-radius:6px;flex-shrink:0"></div>
                <div class="app-skeleton-line" style="width:70%;height:12px"></div>
              </div>
            </div>
            <div v-else-if="tab === 'styles' && styleError" class="subnav-error">
              <span>风格预设加载失败</span>
              <button class="btn btn-ghost btn-sm" @click="loadStylePresets(true)"><RefreshCw :size="11" /> 重试</button>
            </div>
            <p v-else-if="tab === 'styles' && !stylePresets.length" class="config-empty">暂无风格预设</p>
            <p v-else-if="tab === 'appearance'" class="config-empty">浅色 / 深色 / 跟随系统</p>
            <button
              v-else
              v-for="it in subItems"
              :key="it.id"
              :class="['subnav-item', { active: isSubActive(it) }]"
              @click="onSubNavClick(it)"
            >
              <span v-if="it.icon" class="subnav-item-icon">{{ it.icon }}</span>
              <span class="subnav-item-label">{{ it.label }}</span>
              <span v-if="it.count != null" class="subnav-count">{{ it.count }}</span>
            </button>
          </template>
          <template v-else>
            <div class="subnav-group-title">Agent 列表</div>
            <div v-if="agentsLoading" class="subnav-loading">
              <div v-for="i in 3" :key="i" class="subnav-skel-row">
                <div class="app-skeleton-line" style="width:26px;height:26px;border-radius:8px;flex-shrink:0"></div>
                <div class="app-skeleton-line" style="width:72%;height:12px"></div>
              </div>
            </div>
            <div v-else-if="agentsError" class="subnav-error">
              <span>Agent 列表加载失败</span>
              <button class="btn btn-ghost btn-sm" @click="loadAgents(true)"><RefreshCw :size="11" /> 重试</button>
            </div>
            <p v-else-if="!agentList.length" class="config-empty">Agent 列表为空，请检查后端服务</p>
            <button
              v-else
              v-for="a in agentList"
              :key="a.type"
              :class="['subnav-item', { active: selectedAgent === a.type }]"
              @click="selectAgent(a.type)"
            >
              <span class="subnav-item-icon">{{ a.icon }}</span>
              <span class="subnav-item-label">{{ a.label }}</span>
              <span v-if="agentSkillCount(a.type) > 0" class="subnav-count">{{ agentSkillCount(a.type) }}</span>
            </button>
          </template>
        </div>
        <div class="subnav-foot">拖动两侧分隔条调节面板宽度，双击恢复默认</div>
      </aside>

      <div
        class="pane-resizer"
        role="separator"
        aria-orientation="vertical"
        tabindex="0"
        :aria-valuenow="subWidth"
        aria-valuemin="168"
        aria-valuemax="360"
        aria-label="调整二级目录宽度"
        @pointerdown="startPaneResize('sub', $event)"
        @dblclick="resetPaneWidth('sub')"
        @keydown="onPaneResizeKey('sub', $event)"
      />

      <div class="settings-content">

        <!-- ===== 外观：界面主题（UI C4 第三批）===== -->
        <div v-if="tab === 'appearance'" ref="paneRef" class="settings-scroll">
          <div class="settings-head">
            <h2 class="settings-title">外观</h2>
            <p class="settings-desc">界面主题即时生效并保存在本机，下次打开保持；「跟随系统」会在系统切换深浅色时实时同步。</p>
          </div>
          <!-- 三态切换 UI 与接线内聚在独立组件（C4 第三批，可挂载级测试） -->
          <ThemeAppearanceCard />
        </div>

        <!-- ===== AI 服务配置 ===== -->
        <div v-else-if="tab === 'ai'" ref="paneRef" class="settings-scroll">
          <div class="settings-head">
            <h2 class="settings-title">AI 服务</h2>
            <p class="settings-desc">通过二级目录切换能力类型，右侧直接展示对应配置；已接入工作流的能力启用后即被工作台自动采用，仅配置/测试阶段的接入中能力暂不生效，弹窗内有推荐模板可选。</p>
          </div>
          <div v-if="cfgsLoading" class="sections">
            <section v-for="st in serviceTypes" :key="st.type" class="card svc-group">
              <div class="svc-group-head">
                <div class="svc-group-heading">
                  <span class="app-skeleton-line" style="width:64px"></span>
                  <div class="app-skeleton-line" style="width:220px;height:11px;margin-top:6px"></div>
                </div>
              </div>
              <div class="app-skeleton-line" style="width:100%;height:54px;margin-top:12px"></div>
              <div class="app-skeleton-line" style="width:100%;height:54px;margin-top:8px"></div>
            </section>
          </div>
          <div v-else-if="cfgsError" class="app-state app-state-error">
            <div class="app-state-icon"><CircleAlert :size="22" /></div>
            <div class="app-state-title">服务配置加载失败</div>
            <p class="app-state-desc">{{ cfgsError }}</p>
            <button class="btn btn-primary btn-sm" @click="loadCfgs(true)"><RefreshCw :size="12" /> 重试</button>
          </div>
          <template v-else>
            <!-- 能力总览：全部来自真实计数与默认模型解析，无假数据 -->
            <section v-show="activeSection === 'ai-overview'" class="card cap-strip" data-sub="ai-overview">
              <div v-for="st in serviceTypes" :key="st.type" class="cap-cell">
                <div class="cap-cell-top">
                  <span class="cap-badge" :class="`t-${st.type}`">{{ st.label.slice(0, 1) }}</span>
                  <span class="cap-cell-title">{{ st.label }}服务</span>
                  <button type="button" class="btn btn-ghost btn-icon btn-sm" :title="`添加${st.label}服务`" @click="startAddCfg(st.type)">
                    <Plus :size="13" />
                  </button>
                </div>
                <div class="cap-cell-meta">
                  <span :class="['tag', countActive(st.type) ? 'tag-success' : '']">{{ countActive(st.type) }}/{{ byType(st.type).length }} 启用</span>
                  <span v-if="st.type === 'audio'" class="cap-none" title="音频工作流接入后，该类型启用配置将按优先级被自动采用">待接入后生效</span>
                  <span v-else-if="defaultModelOf(st.type)?.model" class="cap-default mono" :title="`当前默认${st.label}模型（该类型优先级最高的启用配置首位）`">
                    <Star :size="10" class="cfg-model-star" /> {{ defaultModelOf(st.type).model }}
                  </span>
                  <span v-else class="cap-none">未设默认</span>
                </div>
              </div>
            </section>

            <!-- 能力组配置卡：点击二级目录在右侧切换展示 -->
            <section
              v-for="st in serviceTypes"
              :key="st.type"
              v-show="activeSection === `ai-${st.type}`"
              class="card svc-group cap-card"
              :data-sub="`ai-${st.type}`"
            >
                <div class="svc-group-head">
                  <div class="svc-group-heading">
                    <span class="svc-group-title">{{ st.label }}服务</span>
                    <div class="svc-group-sub">{{ serviceMeta[st.type].desc }}</div>
                  </div>
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
                      <template v-for="m in c.model" :key="m">
                        <span v-if="st.type === 'audio'" class="cfg-model-chip mono cfg-model-chip-ro" :title="m">{{ m }}</span>
                        <button
                          v-else type="button"
                          :class="['cfg-model-chip mono', { 'is-default': isDefaultModel(st.type, c, m) }]"
                          :title="isDefaultModel(st.type, c, m) ? '当前默认模型' : '设为该类型默认模型'"
                          @click="setDefaultModel(st.type, c, m)"
                        >
                          <Star v-if="isDefaultModel(st.type, c, m)" :size="9" class="cfg-model-star" />
                          {{ m }}
                        </button>
                      </template>
                    </div>
                    <div class="config-sub mono truncate">{{ c.base_url || '未设置 Base URL' }}</div>
                    <div class="config-actions">
                      <button class="btn btn-ghost btn-sm" @click="testExistingCfg(c)">测试</button>
                      <label class="config-switch">
                        <input type="checkbox" class="sr-only" :checked="c.is_active" @change="toggleCfg(c)">
                        <span class="switch" :class="{ on: c.is_active }"></span>
                      </label>
                      <button class="btn btn-ghost btn-icon btn-sm" @click="startEditCfg(c)"><Pencil :size="13" /></button>
                      <button class="btn btn-danger btn-icon btn-sm" @click="delCfg(c.id)"><Trash2 :size="13" /></button>
                    </div>
                  </div>
                </div>
                <p v-if="!byType(st.type).length" class="config-empty">暂无配置</p>
              </section>
          </template>
        </div>

        <!-- ===== 风格预设 ===== -->
        <div v-else-if="tab === 'styles'" ref="paneRef" class="settings-scroll">
          <div class="settings-head styles-head">
            <div class="styles-head-copy">
              <h2 class="settings-title">风格预设</h2>
              <p class="settings-desc">点击左侧二级目录切换风格，右侧展示该风格完整信息并可直接编辑；停用的风格不出现在创建选项中。</p>
            </div>
            <button class="btn btn-ghost btn-sm ml-auto" @click="startAddStyle"><Plus :size="13" /> 添加风格</button>
          </div>
          <section v-if="styleLoading" class="card svc-group">
            <div class="svc-group-head">
              <div class="svc-group-heading">
                <span class="app-skeleton-line" style="width:64px"></span>
              </div>
            </div>
            <div class="app-skeleton-line" style="width:100%;height:54px;margin-top:12px"></div>
            <div class="app-skeleton-line" style="width:100%;height:54px;margin-top:8px"></div>
            <div class="app-skeleton-line" style="width:62%;height:54px;margin-top:8px"></div>
          </section>
          <div v-else-if="styleError" class="app-state app-state-error">
            <div class="app-state-icon"><CircleAlert :size="22" /></div>
            <div class="app-state-title">风格预设加载失败</div>
            <p class="app-state-desc">{{ styleError }}</p>
            <button class="btn btn-primary btn-sm" @click="loadStylePresets(true)"><RefreshCw :size="12" /> 重试</button>
          </div>
          <section v-else-if="currentStyle" class="card svc-group style-detail-card">
            <div class="svc-group-head">
              <div class="style-detail-badge"><Palette :size="15" /></div>
              <div class="svc-group-heading">
                <div class="config-line">
                  <span class="svc-group-title">{{ currentStyle.name }}</span>
                  <span class="tag mono">{{ currentStyle.value }}</span>
                  <span v-if="!currentStyle.is_active" class="tag">已停用</span>
                  <span v-else class="tag tag-success">启用中</span>
                </div>
                <div class="svc-group-sub">提示词片段为英文，会在生成角色图与场景图时自动拼入提示词</div>
              </div>
              <label class="config-switch" :title="currentStyle.is_active ? '停用该风格' : '启用该风格'">
                <input type="checkbox" class="sr-only" :checked="currentStyle.is_active" @change="toggleStyle(currentStyle)">
                <span class="switch" :class="{ on: currentStyle.is_active }"></span>
              </label>
              <button class="btn btn-danger btn-icon btn-sm" title="删除风格" @click="styleToDelete = currentStyle"><Trash2 :size="13" /></button>
            </div>
            <div class="svc-group-body style-detail-body">
              <div class="style-ai-bar">
                <div class="style-ai-copy">
                  <span>AI 一键完善</span>
                  <small>基于已填的名称 / 描述 / 提示词一次完善三者，未填写的将自动补全。</small>
                </div>
                <LoadingButton :loading="styleExpanding" type="button" class="btn btn-ghost btn-sm" spinner-size="13" @click="expandStyle">
                  <template #icon><Sparkles :size="13" /></template>
                  {{ styleExpanding ? '完善中…' : 'AI 完善' }}
                </LoadingButton>
              </div>
              <div class="style-detail-grid">
                <Field label="风格名称" required>
                  <input v-model="styleForm.name" class="input" placeholder="如 3D、动漫、写实电影" />
                </Field>
                <Field>
                  <template #label>风格 key <span class="required">*</span> <span class="dim">(创建后不可修改)</span></template>
                  <input v-model="styleForm.value" class="input mono" :disabled="!!styleEditId" placeholder="如 3d、anime（小写字母/数字/中划线）" />
                </Field>
                <Field class="field-wide" label="提示词片段（英文）" required>
                  <textarea v-model="styleForm.prompt" class="textarea" rows="4" placeholder="如 anime style, cel shading, vibrant colors, clean line art"></textarea>
                </Field>
                <Field label="描述">
                  <input v-model="styleForm.description" class="input" placeholder="一句话说明该风格的适用场景" />
                </Field>
                <Field label="排序">
                  <input v-model.number="styleForm.sort_order" class="input" type="number" min="0" max="999" />
                </Field>
              </div>
              <div class="style-detail-foot">
                <span v-if="styleDirty" class="tag" style="border-color:var(--unsaved-border);color:var(--unsaved-text);background:var(--unsaved-bg)">
                  <TriangleAlert :size="11" /> 有未保存的修改
                </span>
                <span v-else class="dim" style="font-size:11px">修改后点击保存立即生效</span>
                <button v-if="styleDirty" type="button" class="btn btn-ghost btn-sm" @click="discardStyleEdit">放弃修改</button>
                <LoadingButton :loading="styleSaving" :disabled="!styleDirty" type="button" class="btn btn-primary btn-sm ml-auto" spinner-size="12" @click="saveStyle">
                  {{ styleDirty ? '保存修改' : '已保存' }}
                </LoadingButton>
              </div>
            </div>
          </section>
          <section v-else class="card svc-group">
            <p class="config-empty">暂无风格预设，点击右上角「添加风格」创建第一个风格</p>
          </section>
        </div>

        <!-- ===== Agent 配置 ===== -->
        <div v-else-if="tab === 'agents'" ref="paneRef" class="settings-scroll">
          <div class="settings-head">
            <h2 class="settings-title">Prompts</h2>
            <p class="settings-desc">Prompts 即各 Agent 的系统提示词与运行模型（保存为 workspace/prompts/*.md），点击左侧目录切换 Agent，修改后保存立即生效。</p>
          </div>
          <div v-if="agentsLoading" class="agent-list">
            <div v-for="i in 3" :key="i" class="card agent-card">
              <div style="display:flex;align-items:center;gap:12px;padding:4px 0">
                <div class="app-skeleton-line" style="width:34px;height:34px;border-radius:10px;flex-shrink:0"></div>
                <div style="flex:1;display:flex;flex-direction:column;gap:7px">
                  <div class="app-skeleton-line" style="width:42%"></div>
                  <div class="app-skeleton-line" style="width:26%;height:11px"></div>
                </div>
              </div>
            </div>
          </div>
          <div v-else-if="agentsError" class="app-state app-state-error">
            <div class="app-state-icon"><CircleAlert :size="22" /></div>
            <div class="app-state-title">Agent 列表加载失败</div>
            <p class="app-state-desc">{{ agentsError }}</p>
            <button class="btn btn-primary btn-sm" @click="loadAgents(true)"><RefreshCw :size="12" /> 重试</button>
          </div>
          <div v-else class="agent-list">
            <!-- 点击二级目录切换展示：列表仅渲染当前选中的 Agent 配置卡 -->
            <div
              v-for="a in agentList"
              :key="a.type"
              v-show="agentDetail === a.type"
              class="card agent-card"
              :data-sub="`agent-${a.type}`"
            >
              <div class="agent-card-head" @click="toggleAgentEdit(a.type)">
                <div class="agent-type-badge">{{ a.icon }}</div>
                <div class="agent-card-heading">
                  <div class="agent-card-title">{{ a.label }}</div>
                  <div class="agent-card-type dim">{{ a.type }}</div>
                </div>
                <span v-if="getAgentCfg(a.type) && !getAgentCfg(a.type).is_default" class="tag tag-success">自定义</span>
                <span v-else class="tag">默认</span>
                <ChevronDown :size="14" :style="{ transform: editingAgent === a.type ? 'rotate(180deg)' : '', transition: 'transform var(--dur-med) var(--ease-out)' }" />
              </div>
              <div v-if="editingAgent === a.type" class="agent-card-body">
                <Field>
                  <template #label>模型 <span class="dim">(留空使用 AI 服务默认)</span></template>
                  <BaseSelect v-model="agentForm.model" :options="textModelSelectOptions" placeholder="— 使用 AI 服务默认 —" searchable />
                </Field>
                <Field>
                  <template #label>System Prompt <span class="dim">(保存为 workspace/prompts/{{ a.type }}.md)</span></template>
                  <textarea v-model="agentForm.system_prompt" class="textarea" rows="12" placeholder="Agent 系统提示词..." />
                </Field>
                <div class="agent-card-foot">
                  <button class="btn btn-ghost btn-sm" @click="resetAgentPrompt(a.type)">恢复默认</button>
                  <span v-if="agentSaved === a.type" class="tag tag-success" style="margin-left:8px">
                    <Check :size="10" /> 已保存
                  </span>
                  <LoadingButton :loading="agentSaving" class="btn btn-primary btn-sm ml-auto" spinner-size="12" @click="saveAgentCfg(a.type)">
                    保存
                  </LoadingButton>
                </div>
              </div>
            </div>
            <p v-if="!agentList.length" class="config-empty">Agent 列表为空（接口返回无 Agent），请检查后端服务</p>
          </div>
        </div>

        <!-- ===== Skills 编辑 ===== -->
        <div v-else-if="tab === 'skills'" ref="paneRef" class="settings-scroll skills-pane">
            <div class="settings-head skills-head">
              <span class="agent-type-badge skills-head-badge">{{ selectedAgentIcon }}</span>
              <div class="skills-head-copy">
                <h2 class="settings-title">{{ selectedAgentLabel }}</h2>
                <div class="dim" style="font-size:12px;margin-top:2px">{{ selectedAgentType }} — Skills</div>
                <p class="settings-desc">每个 Skill 保存为独立的 SKILL.md。点击左侧 Agent 后其全部 Skill 默认展开，可直接编辑内容。</p>
              </div>
              <button class="btn btn-primary btn-sm ml-auto" @click="startAddSkill">
                <Plus :size="13" /> 新增 Skill
              </button>
            </div>

            <!-- Skills 加载中（P0-C1/C2） -->
            <div v-if="skillsLoading" class="card skills-empty">
              <div class="skills-empty-icon">
                <div class="app-skeleton-line" style="width:26px;height:26px;border-radius:8px"></div>
              </div>
              <div class="app-skeleton-line" style="width:150px;margin:8px auto 0"></div>
            </div>
            <div v-else-if="skillsError" class="app-state app-state-error">
              <div class="app-state-icon"><CircleAlert :size="22" /></div>
              <div class="app-state-title">Skills 加载失败</div>
              <p class="app-state-desc">{{ skillsError }}</p>
              <button class="btn btn-primary btn-sm" @click="loadAgents(true); loadAllSkills(true)"><RefreshCw :size="12" /> 重试</button>
            </div>
            <template v-else>
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
                  <ChevronDown :size="14" :style="{ transform: skillOpen.has(s.id) ? 'rotate(180deg)' : '', transition: 'transform var(--dur-med) var(--ease-out)' }" />
                </div>
                <div v-if="skillOpen.has(s.id)" class="skill-card-body">
                  <!-- 读取失败：内联错误 + 重试，禁止出现可保存的空编辑框 -->
                  <div v-if="skillLoadError[s.id]" class="skill-load-error">
                    <CircleAlert :size="14" class="skill-load-error-icon" style="flex-shrink:0" />
                    <div style="flex:1;min-width:0">
                      <div style="font-weight:600;font-size:12.5px">SKILL.md 读取失败</div>
                      <div class="dim" style="font-size:11px">{{ skillLoadError[s.id] }}</div>
                    </div>
                    <LoadingButton :loading="skillLoadingIds.has(s.id)" class="btn btn-ghost btn-sm" spinner-size="11" @click="loadSkillContent(s.id)">
                      <template #icon><RefreshCw :size="11" /></template>
                      重试
                    </LoadingButton>
                  </div>
                  <!-- 首次加载中 -->
                  <div v-else-if="skillContents[s.id] === undefined" class="skill-loading">
                    <Loader2 :size="15" class="animate-spin" style="color:var(--text-3)" />
                    <span>正在读取 SKILL.md…</span>
                  </div>
                  <!-- 内容已加载：可编辑保存 -->
                  <template v-else>
                    <textarea
                      v-model="skillContents[s.id]"
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
                      <LoadingButton :loading="skillSaving" class="btn btn-primary btn-sm ml-auto" spinner-size="12" @click="saveSkill(s.id)">
                        保存
                      </LoadingButton>
                    </div>
                  </template>
                </div>
              </div>
            </div>
            </template>
          </div>
      </div>
    </div>

    <!-- AI Config Dialog -->
    <AppDialog v-if="cfgDialog" form width="min(720px, calc(100vw - 40px))" @close="cfgDialog = false" @submit="saveCfg">
      <template #head>
        <div>
          <div class="dialog-title">{{ cfgEditId ? '编辑服务配置' : `添加${serviceMeta[cfgForm.service_type].label}服务` }}</div>
          <div class="dialog-sub">推荐先选择模板，系统会自动填入更合理的 `Base URL` 与默认模型。</div>
        </div>
        <span class="tag tag-accent ml-auto">{{ serviceMeta[cfgForm.service_type].label }}</span>
      </template>
      <div class="config-dialog-body">
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
          <Field label="配置名称">
            <input v-model="cfgForm.name" class="input" placeholder="如 火宝默认图像服务" />
          </Field>
          <Field label="服务商">
            <BaseSelect v-model="cfgForm.provider" :options="providerSelectOptions" placeholder="选择服务商" searchable />
          </Field>
          <Field label="优先级">
            <input v-model.number="cfgForm.priority" class="input" type="number" min="0" max="999" />
            <template #hint>
              <template v-if="cfgForm.service_type === 'audio'">仅保存配置；优先级与自动采用待音频工作流接入后生效。</template>
              <template v-else>数值越高越优先。工作台默认会优先使用同类型里优先级最高的启用配置。</template>
            </template>
          </Field>
          <Field label="API Key">
            <input v-model="cfgForm.api_key" class="input" type="password" placeholder="sk-..." />
          </Field>
          <Field label="Base URL">
            <input v-model="cfgForm.base_url" class="input" placeholder="https://..." />
          </Field>
          <Field
            label="模型（逗号分隔）"
            :hint="fetchedModels.length ? '勾选模型后点击「加入当前配置」写入下方字段（去重）；「配置为生图模型」可将所选预填为图片服务草稿。' : ''"
          >
            <div class="model-input-row">
              <input v-model="cfgForm.modelStr" class="input" placeholder="model-name" />
              <LoadingButton :loading="cfgFetchingModels" type="button" class="btn btn-ghost btn-sm model-fetch-btn" spinner-size="13" @click="fetchModels">
                <template #icon><RefreshCw :size="13" /></template>
                拉取模型
              </LoadingButton>
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
          </Field>
          <Field v-if="cfgForm.service_type === 'text'" hint="部分模型强制固定温度（如 kimi-k2 系只允许 0.6），报 invalid temperature 错误时在此填入对应值。">
            <template #label>Temperature <span class="dim">(留空跟随服务商默认)</span></template>
            <input v-model="cfgForm.temperature" class="input" type="number" step="0.1" min="0" max="2" placeholder="如 0.6" />
          </Field>
          <div v-if="cfgTestResult" class="test-result" :class="{ ok: cfgTestResult.reachable, bad: !cfgTestResult.reachable }">
            <div class="test-result-head">
              <span class="tag" :class="cfgTestResult.reachable ? 'tag-success' : 'tag-error'">{{ cfgTestResult.status || 'ERROR' }}</span>
              <span>{{ cfgTestResult.message }}</span>
            </div>
            <div class="mono test-result-url">{{ cfgTestResult.method }} {{ cfgTestResult.url }}</div>
            <div v-if="cfgTestResult.response_preview" class="mono test-result-preview">{{ cfgTestResult.response_preview }}</div>
          </div>
      </div>
      <template #foot>
        <LoadingButton :loading="cfgTesting" type="button" class="btn btn-ghost test-draft-btn" spinner-size="12" @click="testDraftCfg">
          <template #icon><span>测试配置</span></template>
        </LoadingButton>
        <button type="button" class="btn" @click="cfgDialog = false">取消</button>
        <button type="submit" class="btn btn-primary">保存</button>
      </template>
    </AppDialog>

    <!-- Add Skill Dialog -->
    <AppDialog v-if="addSkillDialog" form width="440px" @close="addSkillDialog = false" @submit="confirmAddSkill">
      <template #head>
        <div class="dialog-title">新增 Skill — {{ selectedAgentLabel }}</div>
      </template>
      <div class="skill-dialog-body">
        <Field>
          <template #label>Skill 目录名 <span class="dim">(英文，唯一)</span></template>
          <input v-model="newSkillForm.id" class="input" placeholder="如 custom-extraction" />
        </Field>
        <Field label="名称">
          <input v-model="newSkillForm.name" class="input" placeholder="如 自定义提取规则" />
        </Field>
        <Field label="描述">
          <input v-model="newSkillForm.description" class="input" placeholder="简短描述此 Skill 的用途" />
        </Field>
      </div>
      <template #foot>
        <button type="button" class="btn" @click="addSkillDialog = false">取消</button>
        <button type="submit" class="btn btn-primary" :disabled="!newSkillForm.id">创建</button>
      </template>
    </AppDialog>

    <!-- Style Preset Dialog -->
    <AppDialog v-if="styleDialog" form width="min(720px, calc(100vw - 40px))" @close="cancelStyleDialog" @submit="saveStyle">
      <template #head>
        <div>
          <div class="dialog-title">添加风格预设</div>
          <div class="dialog-sub">提示词片段为英文，会在生成角色图与场景图时自动拼入提示词。</div>
        </div>
        <span class="tag tag-accent ml-auto"><Palette :size="12" /> 风格</span>
      </template>
      <div class="config-dialog-body">
        <div class="style-ai-bar">
          <div class="style-ai-copy">
            <span>AI 一键完善</span>
            <small>基于已填的名称 / 描述 / 提示词一次完善三者，未填写的将自动补全。</small>
          </div>
          <LoadingButton :loading="styleExpanding" type="button" class="btn btn-ghost btn-sm" spinner-size="13" @click="expandStyle">
            <template #icon><Sparkles :size="13" /></template>
            {{ styleExpanding ? '完善中…' : 'AI 完善' }}
          </LoadingButton>
        </div>
        <Field label="风格名称" required>
          <input v-model="styleForm.name" class="input" placeholder="如 3D、动漫、写实电影" />
        </Field>
        <Field label="风格 key" required hint="存入项目的风格标识，创建后不可修改。">
          <input v-model="styleForm.value" class="input mono" placeholder="如 3d、anime（小写字母/数字/中划线）" />
        </Field>
        <Field label="提示词片段（英文）" required>
          <textarea v-model="styleForm.prompt" class="textarea" rows="3" placeholder="如 anime style, cel shading, vibrant colors, clean line art"></textarea>
        </Field>
        <Field label="描述">
          <input v-model="styleForm.description" class="input" placeholder="一句话说明该风格的适用场景" />
        </Field>
        <Field label="排序">
          <input v-model.number="styleForm.sort_order" class="input" type="number" min="0" max="999" />
        </Field>
      </div>
      <template #foot>
        <button type="button" class="btn" @click="cancelStyleDialog">取消</button>
        <button type="submit" class="btn btn-primary" :disabled="styleSaving">保存</button>
      </template>
    </AppDialog>
    <!-- 切换风格前：当前风格有未保存修改，让用户选择保存 / 放弃 / 取消 -->
    <AppDialog v-if="stylePromptOpen" @close="cancelStylePrompt">
      <template #head>
        <div>
          <div class="dialog-title">有未保存的修改</div>
          <div class="dialog-sub">「{{ currentStyle?.name || '当前风格' }}」的表单已修改但尚未保存。</div>
        </div>
        <span class="tag" style="border-color:var(--unsaved-border);color:var(--unsaved-text);background:var(--unsaved-bg)"><TriangleAlert :size="12" /> 未保存</span>
      </template>
      <p class="unsaved-dialog-copy">{{ stylePromptIsNew ? '新建风格会丢弃当前风格的未保存修改。' : '切换风格会丢弃这些修改。' }}「保存并{{ stylePromptIsNew ? '新建' : '切换' }}」将先保存当前内容再继续；「放弃更改」将丢弃并继续。</p>
      <template #foot>
        <button type="button" class="btn" @click="cancelStylePrompt">取消</button>
        <button type="button" class="btn btn-ghost" @click="discardStyleEdit">放弃更改</button>
        <LoadingButton :loading="styleSaving" type="button" class="btn btn-primary" spinner-size="12" @click="keepStyleAndSwitch">
          保存并{{ stylePromptIsNew ? '新建' : '切换' }}
        </LoadingButton>
      </template>
    </AppDialog>
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
import { Plus, Pencil, Trash2, FileText, ChevronDown, Check, Loader2, Bot, Cpu, Palette, Star, RefreshCw, Sparkles, CircleAlert, TriangleAlert, SunMoon } from 'lucide-vue-next'
import BaseSelect from '~/components/BaseSelect.vue'
import Field from '~/components/Field.vue'
import AppDialog from '~/components/AppDialog.vue'
import LoadingButton from '~/components/LoadingButton.vue'
import { toast } from 'vue-sonner'
import { aiConfigAPI, promptAPI, skillsAPI, stylePresetAPI } from '~/composables/useApi'

const tab = ref('ai')
// 两级导航：一级分组 + 二级目录。Agent 配置 / Skills 常驻可见（原「Agent 高级配置」开关已移除）
const navGroups = [
  {
    id: 'basic',
    label: '基础',
    items: [
      { id: 'appearance', label: '外观', icon: SunMoon },
      { id: 'ai', label: 'AI 服务', icon: Cpu },
      { id: 'styles', label: '风格预设', icon: Palette },
    ],
  },
  {
    id: 'advanced',
    label: '高级',
    items: [
      { id: 'agents', label: 'Prompts', icon: Bot },
      { id: 'skills', label: 'Skills', icon: FileText },
    ],
  },
]

// ===== 三栏布局：左一级导航 / 中二级目录 / 右正文，分隔条可拖拽调宽 =====
const SETTINGS_PANE_KEY = 'settings-layout-widths'
const NAV_DEFAULT = 212
const NAV_MIN = 168
const NAV_MAX = 300
const SUB_DEFAULT = 232
const SUB_MIN = 168
const SUB_MAX = 360
const navWidth = ref(NAV_DEFAULT)
const subWidth = ref(SUB_DEFAULT)
const paneRef = ref(null)
// 右侧当前展示的面板：ai 用 activeSection（ai-overview / ai-text / ai-image / ai-video / ai-audio），
// styles 用 styleDetailId 记录当前风格；agents 用 agentDetail 记录被选中的 Agent。
const activeSection = ref('')
const agentDetail = ref(null)
let activePaneDrag = null

function clampPaneWidth(v, min, max) { return Math.min(max, Math.max(min, v)) }
function persistPaneWidths() {
  try {
    localStorage.setItem(SETTINGS_PANE_KEY, JSON.stringify({ navWidth: navWidth.value, subWidth: subWidth.value }))
  } catch { /* 忽略持久化失败 */ }
}
function initPaneWidths() {
  try {
    const raw = localStorage.getItem(SETTINGS_PANE_KEY)
    if (!raw) return
    const saved = JSON.parse(raw)
    if (typeof saved.navWidth === 'number') navWidth.value = clampPaneWidth(saved.navWidth, NAV_MIN, NAV_MAX)
    if (typeof saved.subWidth === 'number') subWidth.value = clampPaneWidth(saved.subWidth, SUB_MIN, SUB_MAX)
  } catch { /* 忽略损坏数据 */ }
}
const curTabMeta = computed(() => ({
  appearance: { icon: SunMoon, title: '外观', desc: '界面主题切换' },
  ai: { icon: Cpu, title: 'AI 服务', desc: '能力分组与默认模型' },
  styles: { icon: Palette, title: '风格预设', desc: '视觉风格片段管理' },
  agents: { icon: Bot, title: 'Prompts', desc: '模型与系统提示词' },
  skills: { icon: FileText, title: 'Skills 编辑', desc: '按 Agent 组织提示词文件' },
}[tab.value]))
// 二级目录：ai 为能力面板；styles 为风格列表；agents 为动态 Agent 列表
const subItems = computed(() => {
  if (tab.value === 'ai') {
    return [
      { id: 'ai-overview', label: '能力总览' },
      { id: 'ai-text', label: '文本服务', count: byType('text').length },
      { id: 'ai-image', label: '图片服务', count: byType('image').length },
      { id: 'ai-video', label: '视频服务', count: byType('video').length },
      { id: 'ai-audio', label: '音频服务', count: byType('audio').length },
    ]
  }
  if (tab.value === 'styles') return stylePresets.value.map(p => ({ id: p.id, label: p.name }))
  if (tab.value === 'agents') return agentList.value.map(a => ({ id: `agent-${a.type}`, label: a.label, icon: a.icon }))
  return []
})
// 二级目录点击 = 右侧内容切换（不再做长页锚点滚动）
function isSubActive(it) {
  if (tab.value === 'agents') return !!agentDetail.value && it.id === `agent-${agentDetail.value}`
  if (tab.value === 'styles') return styleDetailId.value === it.id
  return activeSection.value === it.id
}
function paneScrollTop() {
  requestAnimationFrame(() => {
    if (paneRef.value) paneRef.value.scrollTop = 0
  })
}
function onSubNavClick(it) {
  if (tab.value === 'agents') {
    if (it.id.startsWith('agent-')) showAgentDetail(it.id.slice(6))
    return
  }
  if (tab.value === 'styles') {
    requestStyleSwitch(it.id)
    return
  }
  if (activeSection.value !== it.id) activeSection.value = it.id
  paneScrollTop()
}
// Agent 配置页：切到指定 Agent，并在卡片中展开编辑表单（拉取该 Agent 的 /prompts 详情）
async function showAgentDetail(type) {
  agentDetail.value = type
  if (editingAgent.value !== type) {
    editingAgent.value = null
    await toggleAgentEdit(type)
  }
  paneScrollTop()
}
function startPaneResize(type, e) {
  if (e.pointerType === 'mouse' && e.button !== 0) return
  const isNav = type === 'nav'
  activePaneDrag = {
    type,
    startX: e.clientX,
    startWidth: isNav ? navWidth.value : subWidth.value,
  }
  const move = (ev) => {
    if (!activePaneDrag) return
    const delta = ev.clientX - activePaneDrag.startX
    const next = clampPaneWidth(activePaneDrag.startWidth + delta, isNav ? NAV_MIN : SUB_MIN, isNav ? NAV_MAX : SUB_MAX)
    if (isNav) navWidth.value = next
    else subWidth.value = next
  }
  const finish = () => {
    activePaneDrag = null
    cleanup()
    persistPaneWidths()
  }
  const cleanup = () => {
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', finish)
    window.removeEventListener('pointercancel', finish)
    document.body.classList.remove('resizing-panes')
  }
  activePaneDrag.cleanup = cleanup
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', finish)
  window.addEventListener('pointercancel', finish)
  document.body.classList.add('resizing-panes')
}
function adjustPaneWidth(type, delta) {
  if (type === 'nav') navWidth.value = clampPaneWidth(navWidth.value + delta, NAV_MIN, NAV_MAX)
  else subWidth.value = clampPaneWidth(subWidth.value + delta, SUB_MIN, SUB_MAX)
  persistPaneWidths()
}
function resetPaneWidth(type) {
  if (type === 'nav') navWidth.value = NAV_DEFAULT
  else subWidth.value = SUB_DEFAULT
  persistPaneWidths()
}
function onPaneResizeKey(type, e) {
  const step = e.shiftKey ? 40 : 10
  if (e.key === 'ArrowLeft') { adjustPaneWidth(type, -step); e.preventDefault(); return }
  if (e.key === 'ArrowRight') { adjustPaneWidth(type, step); e.preventDefault(); return }
  if (e.key === 'Home') { resetPaneWidth(type); e.preventDefault() }
}

// ===== 列表加载三态（P0-C1/C2）：初始加载显示骨架，失败内联错误 + 重试 =====
const cfgsLoading = ref(false)
const cfgsError = ref('')
const styleLoading = ref(false)
const styleError = ref('')
const agentsLoading = ref(false)
const agentsError = ref('')
const skillsLoading = ref(false)
const skillsError = ref('')

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
const serviceTypes = [{ type: 'text', label: '文本' }, { type: 'image', label: '图片' }, { type: 'video', label: '视频' }, { type: 'audio', label: '音频' }]
const providers = ['gemini', 'openai', 'volcengine', 'minimax', 'autodl']
// 音频服务后端白名单仅有 AutoDL，服务商下拉按类型收窄（其余类型保持通用列表）
const providerWhitelistByType = { audio: ['autodl'] }
const providerSelectOptions = computed(() => {
  const list = providerWhitelistByType[cfgForm.service_type] || providers
  return list.map(p => ({ label: p, value: p }))
})
const serviceMeta = {
  text: { label: '文本', desc: '剧本改写、角色场景提取、分镜拆解等 Agent 文本能力' },
  image: { label: '图片', desc: '角色图、场景图与镜头图等静态图像生成' },
  video: { label: '视频', desc: '镜头视频直出生成，支持 Seedance、MiniMax 与 AutoDL H3 工作流' },
  audio: { label: '音频', desc: '当前仅保存与测试 AutoDL IndexTTS2 配置；语音生成与工作台接入将在后续工作流完成后开放' },
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
  audio: {
    autodl: { label: 'AutoDL IndexTTS2', baseUrl: 'https://autodl.art', models: ['indextts2-v1'] },
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

async function loadCfgs(initial = false) {
  if (initial) { cfgsLoading.value = true; cfgsError.value = '' }
  try { cfgs.value = await aiConfigAPI.list() }
  catch (e) {
    if (initial) { cfgsError.value = e.message || '加载失败'; return }
    toast.error(e.message)
  } finally {
    if (initial) cfgsLoading.value = false
  }
}

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
    // 保存后跳到对应能力面板，让新配置立即可见
    if (activeSection.value !== `ai-${cfgForm.service_type}`) {
      activeSection.value = `ai-${cfgForm.service_type}`
      paneScrollTop()
    }
  } catch (e) { toast.error(e.message) }
}

// ===== Agent Configs =====
const agentCfgs = ref([])
const editingAgent = ref(null)
const agentSaving = ref(false)
const agentSaved = ref(null)
const agentForm = reactive({ model: '', system_prompt: '' })

// 仅维护「图标」元信息；Agent 列表与展示名一律以 /prompts 接口返回为准，
// 后端新增 Agent（如 project_analyzer/episode_planner/style_enhancer）会自动出现，无需改前端。
const AGENT_ICONS = {
  script_rewriter: '📝',
  extractor: '🔍',
  storyboard_breaker: '🎬',
  prompt_generator: '🖼',
  minimax_h3_prompt_generator: '🎞️',
  project_analyzer: '💡',
  episode_planner: '📚',
  style_enhancer: '🎨',
}
const agentIconOf = (type) => AGENT_ICONS[type] || '🤖'

// Agent 配置 / Skills 左侧共用列表：由 /prompts（agentCfgs）驱动，只叠加图标
const agentList = computed(() =>
  agentCfgs.value.map(c => ({
    type: c.agent_type,
    label: c.name || c.agent_type,
    icon: agentIconOf(c.agent_type),
  }))
)

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

async function loadAgents(initial = false) {
  if (initial) { agentsLoading.value = true; agentsError.value = '' }
  try { agentCfgs.value = await promptAPI.list() }
  catch (e) {
    if (initial) { agentsError.value = e.message || '加载失败'; return }
    toast.error(e.message)
  } finally {
    if (initial) agentsLoading.value = false
  }
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
      name: agentList.value.find(a => a.type === type)?.label || type,
      model: agentForm.model,
      system_prompt: agentForm.system_prompt,
    })
    await loadAgents()
    agentSaved.value = type
    toast.success(`${agentList.value.find(a => a.type === type)?.label} 配置已保存`)
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
const skillContents = ref({})  // skill id -> SKILL.md 内容（仅在读取成功后写入）
const skillLoadError = ref({})  // skill id -> 首次读取失败的报错；有错误时不显示可保存的编辑框
const skillLoadingIds = reactive(new Set())  // 正在读取 SKILL.md 的 skill id
const skillOpen = reactive(new Set())  // 已展开的 skill id（进入/切换 Agent 后默认全部展开）
const skillSaving = ref(false)
const skillSaved = ref(null)
const addSkillDialog = ref(false)
const newSkillForm = reactive({ id: '', name: '', description: '' })

const selectedAgentType = computed(() => selectedAgent.value)
const selectedAgentLabel = computed(() => agentList.value.find(a => a.type === selectedAgent.value)?.label || selectedAgent.value)
const selectedAgentIcon = computed(() => agentList.value.find(a => a.type === selectedAgent.value)?.icon || '🤖')

// 列表来自 /prompts：若当前选中 Agent 不在其中（被移除或列表刚加载），自动回退到第一个。
// Agent 配置页的详情卡同样默认选中第一个，列表变化后失效则回退。
watch(agentCfgs, (list) => {
  if (list.length && !list.some(a => a.agent_type === selectedAgent.value)) {
    selectedAgent.value = list[0].agent_type
  }
  if (!list.length) return
  if (!agentDetail.value || !list.some(a => a.agent_type === agentDetail.value)) {
    agentDetail.value = list[0].agent_type
  }
})

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

async function loadAllSkills(initial = false) {
  if (initial) { skillsLoading.value = true; skillsError.value = '' }
  try { allSkills.value = await skillsAPI.list() }
  catch (e) {
    if (initial) { skillsError.value = e.message || '加载失败'; return }
    toast.error(e.message)
  } finally {
    if (initial) skillsLoading.value = false
  }
}

// 读取单个 SKILL.md：成功写入内容并展开；失败不伪装为空内容——
// 首次读取失败记录内联错误（显示「重试」，禁止可保存的空编辑框）；已有缓存则保留缓存内容
async function loadSkillContent(id) {
  if (skillLoadingIds.has(id)) return
  skillLoadingIds.add(id)
  try {
    const res = await skillsAPI.get(id)
    delete skillLoadError.value[id]
    skillContents.value[id] = res.content || ''
    skillOpen.add(id)
    return true
  } catch (e) {
    if (skillContents.value[id] === undefined) {
      skillLoadError.value[id] = e.message || '读取失败'
    } else {
      toast.error(`「${id}」重新读取失败，已保留已加载内容`)
    }
    skillOpen.add(id)
    return false
  } finally {
    skillLoadingIds.delete(id)
  }
}
// 预载并展开某个 Agent 的全部 Skill 内容（默认全部展开，可点击卡头收起）
function revealSkillsOf(type) {
  const items = allSkills.value.filter(s => skillBelongsTo(s.id, type))
  return Promise.all(items.map(s => loadSkillContent(s.id)))
}
function ensureSkillsRevealed() {
  if (!agentCfgs.value.length || !allSkills.value.length) return Promise.resolve()
  return revealSkillsOf(selectedAgent.value)
}

async function selectAgent(type) {
  selectedAgent.value = type
  skillSaved.value = null
  await revealSkillsOf(type)
  paneScrollTop()
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
    await revealSkillsOf(selectedAgent.value)
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
    delete skillContents.value[id]
    delete skillLoadError.value[id]
    skillLoadingIds.delete(id)
    skillOpen.delete(id)
    if (skillSaved.value === id) skillSaved.value = null
    await loadAllSkills()
    skillToDelete.value = null
    toast.success('已删除')
  } catch (e) {
    toast.error(e.message)
  } finally {
    deletingSkill.value = false
  }
}

// 点击 Skill 卡头：展开 / 收起；内容未载入或读取失败时触发加载 / 重试
async function toggleSkillEdit(id) {
  if (skillOpen.has(id)) { skillOpen.delete(id); return }
  if (skillContents.value[id] === undefined || skillLoadError.value[id]) await loadSkillContent(id)
  else skillOpen.add(id)
}

async function saveSkill(id) {
  skillSaving.value = true
  skillSaved.value = null
  try {
    await skillsAPI.update(id, skillContents.value[id] ?? '')
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
const styleDetailId = ref(null)
const styleSaving = ref(false)
// 未保存修改检测：styleSnap 为当前选中风格加载进表单时的原始快照，表单与之不一致即视为未保存
const styleSnap = ref(null)
const styleDirty = ref(false)
// 有未保存修改时切换风格：弹「保存并切换 / 放弃更改 / 取消」三选确认
const stylePromptOpen = ref(false)
const stylePromptSwitchId = ref(null)
// 新建风格同样复用该确认：目标是「添加风格」的标记值（与真实风格 id 不冲突）
const STYLE_ADD_FLAG = '__add_style__'
const stylePromptIsNew = computed(() => stylePromptSwitchId.value === STYLE_ADD_FLAG)

async function loadStylePresets(initial = false) {
  if (initial) { styleLoading.value = true; styleError.value = '' }
  try { stylePresets.value = await stylePresetAPI.list(true) }
  catch (e) {
    if (initial) { styleError.value = e.message || '加载失败'; return }
    toast.error(e.message)
  } finally {
    if (initial) styleLoading.value = false
  }
}

const currentStyle = computed(() => stylePresets.value.find(p => p.id === styleDetailId.value) || null)
// 把指定风格载入表单，同时记录原始快照作为“未保存”基准（表单与之不同即 dirty）
function fillStyleForm(p) {
  styleEditId.value = p.id
  styleSnap.value = { name: p.name, value: p.value, prompt: p.prompt, description: p.description ?? '', sort_order: p.sort_order ?? 0 }
  Object.assign(styleForm, styleSnap.value)
  styleDirty.value = false
}
// 详情卡表单变化检测（新建弹窗不参与：取消时通过 fillStyleForm 恢复）
watch(
  () => [styleForm.name, styleForm.value, styleForm.prompt, styleForm.description, styleForm.sort_order],
  () => {
    const s = styleSnap.value
    styleDirty.value = !!s && (
      styleForm.name !== s.name || styleForm.value !== s.value ||
      styleForm.prompt !== s.prompt || styleForm.description !== s.description ||
      styleForm.sort_order !== s.sort_order
    )
  }
)
// 二级目录 / 列表入口：把对应风格装进右侧详情卡（默认展开可编辑）
function showStyleDetail(id) {
  if (styleDetailId.value === id) { paneScrollTop(); return }
  const p = stylePresets.value.find(x => x.id === id)
  if (!p) return
  styleDetailId.value = id
  fillStyleForm(p)
  paneScrollTop()
}
// 切换风格入口：当前有未保存修改时先弹「保存并切换 / 放弃更改 / 取消」，防止静默丢失
function requestStyleSwitch(id) {
  if (styleDetailId.value === id) { paneScrollTop(); return }
  if (styleDirty.value && styleEditId.value) {
    stylePromptSwitchId.value = id
    stylePromptOpen.value = true
    return
  }
  showStyleDetail(id)
}
function closeStylePrompt() {
  stylePromptOpen.value = false
  stylePromptSwitchId.value = null
}
function cancelStylePrompt() {
  if (styleSaving.value) return
  closeStylePrompt()
}
// 「保存并切换 / 保存并新建」：先保存当前风格修改，成功后再执行目标动作
async function keepStyleAndSwitch() {
  const target = stylePromptSwitchId.value
  const ok = await persistCurrentStyleEdit()
  if (!ok) return // 保存失败：停留当前页并保留弹窗，由用户重试或放弃
  closeStylePrompt()
  if (target === STYLE_ADD_FLAG) openAddStyleDialog()
  else if (target) showStyleDetail(target)
}
// 「放弃更改 / 放弃修改」：恢复当前风格快照；若正处于切换/新建确认中，随后继续执行目标动作
function discardStyleEdit() {
  const target = stylePromptSwitchId.value
  closeStylePrompt()
  const p = stylePresets.value.find(x => x.id === styleDetailId.value)
  if (p) fillStyleForm(p)
  if (target === STYLE_ADD_FLAG) openAddStyleDialog()
  else if (target && target !== styleDetailId.value) showStyleDetail(target)
}
// 列表加载 / 删除后保证有合法选中项，默认选中第一个
function ensureStyleSelection() {
  const list = stylePresets.value
  if (!list.length) return
  if (!styleDetailId.value || !list.some(p => p.id === styleDetailId.value)) {
    styleDetailId.value = list[0].id
    fillStyleForm(list[0])
  }
}
watch(stylePresets, ensureStyleSelection)

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
    await loadStylePresets()
    // 删除了当前正在编辑的风格：列表 watch 已回退选中第一个；若没有剩余风格则清空编辑态
    if (!stylePresets.value.length) {
      styleDetailId.value = null
      styleEditId.value = null
      styleSnap.value = null
      styleDirty.value = false
    }
  } catch (e) {
    toast.error(e.message)
  } finally {
    deletingStyle.value = false
  }
}

// 「添加风格」入口：当前详情卡有未保存修改时同样走「保存并新建 / 放弃新建 / 取消」确认，
// 防止直接重置 styleSnap/styleForm 使草稿被静默覆盖（owner 复核 P1）
function startAddStyle() {
  if (styleDirty.value && styleEditId.value) {
    stylePromptSwitchId.value = STYLE_ADD_FLAG
    stylePromptOpen.value = true
    return
  }
  openAddStyleDialog()
}
// 新建风格仍走弹窗表单；styleEditId 置空使「风格 key」可填写
function openAddStyleDialog() {
  styleEditId.value = null
  styleSnap.value = null // 新建弹窗期间不做未保存检测，取消时会用当前风格快照恢复
  Object.assign(styleForm, {
    name: '', value: '', prompt: '', description: '',
    sort_order: (stylePresets.value.at(-1)?.sort_order ?? 0) + 1,
  })
  styleDialog.value = true
}

// 编辑已改为在右侧详情卡内直接进行
function startEditStyle(p) {
  if (p) showStyleDetail(p.id)
}

// 取消新建弹窗后，把详情卡的表单恢复为当前选中风格
function cancelStyleDialog() {
  styleDialog.value = false
  const p = stylePresets.value.find(x => x.id === styleDetailId.value)
  if (p) fillStyleForm(p)
}

const styleExpanding = ref(false)
async function expandStyle() {
  if (styleExpanding.value) return
  const seed = { name: styleForm.name, description: styleForm.description, prompt: styleForm.prompt }
  if (!seed.name?.trim() && !seed.description?.trim() && !seed.prompt?.trim()) {
    toast.warning('请先填写风格名称、描述或提示词，AI 才能据此完善')
    return
  }
  try {
    styleExpanding.value = true
    const r = await stylePresetAPI.expand(seed)
    if (r?.name) styleForm.name = r.name
    if (r?.description) styleForm.description = r.description
    if (r?.prompt) styleForm.prompt = r.prompt
    // 新建风格时 key 可留空，由 AI 给出建议并规范化为合法格式
    if (!styleEditId.value && !styleForm.value.trim() && r?.value) {
      styleForm.value = String(r.value).toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+|-+$/g, '')
    }
    toast.success('AI 已完善风格信息，核对后保存')
  } catch (e) {
    toast.error(e.message)
  } finally {
    styleExpanding.value = false
  }
}

// 保存右侧详情卡当前风格的修改；保存后按最新列表重建快照并复位 dirty。返回是否保存成功。
async function persistCurrentStyleEdit() {
  const id = styleEditId.value
  if (!id) return false
  if (!styleForm.name?.trim() || !styleForm.prompt?.trim()) {
    toast.warning('名称与提示词片段必填')
    return false
  }
  styleSaving.value = true
  try {
    await stylePresetAPI.update(id, {
      name: styleForm.name,
      prompt: styleForm.prompt,
      description: styleForm.description,
      sort_order: styleForm.sort_order,
    })
    toast.success('已保存')
    await loadStylePresets()
    const p = stylePresets.value.find(x => x.id === id)
    if (p) fillStyleForm(p)
    return true
  } catch (e) {
    toast.error(e.message)
    return false
  } finally {
    styleSaving.value = false
  }
}

async function saveStyle() {
  // 详情卡保存（存在正在编辑的风格）
  if (styleEditId.value) {
    const ok = await persistCurrentStyleEdit()
    if (ok) styleDialog.value = false
    return
  }
  // 新建风格弹窗
  if (!styleForm.name?.trim() || !styleForm.prompt?.trim() || !styleForm.value?.trim()) {
    toast.warning('名称、key、提示词片段必填')
    return
  }
  styleSaving.value = true
  try {
    const beforeIds = new Set(stylePresets.value.map(p => p.id))
    await stylePresetAPI.create({ ...styleForm })
    styleDialog.value = false
    toast.success('已保存')
    await loadStylePresets()
    // 新建完成后跳到新风格详情卡，立即可见
    const added = stylePresets.value.find(p => !beforeIds.has(p.id))
    if (added) showStyleDetail(added.id)
    else ensureStyleSelection()
  } catch (e) { toast.error(e.message) } finally { styleSaving.value = false }
}

// tab 切换：AI 回到能力总览；风格页兜底选中；Skills 页自动展开当前 Agent 的 Skill
watch(tab, () => {
  if (tab.value === 'ai') activeSection.value = 'ai-overview'
  else if (tab.value === 'styles') ensureStyleSelection()
  else if (tab.value === 'skills') ensureSkillsRevealed()
})
// 数据到达后补一次展开（首次进入 Skills 页时 agent / skill 列表可能尚未加载完）
watch([agentCfgs, allSkills], () => {
  if (tab.value === 'skills') ensureSkillsRevealed()
})
// 刷新 / 关闭页面兜底：风格详情卡有未保存修改时提示浏览器确认，避免误丢
const guardUnload = (e) => {
  if (styleDirty.value && styleEditId.value) {
    e.preventDefault()
    e.returnValue = ''
  }
}
onBeforeUnmount(() => {
  if (activePaneDrag?.cleanup) activePaneDrag.cleanup()
  window.removeEventListener('beforeunload', guardUnload)
})
onMounted(() => {
  initPaneWidths()
  activeSection.value = 'ai-overview'
  loadCfgs(true); loadAgents(true); loadAllSkills(true); loadStylePresets(true)
  window.addEventListener('beforeunload', guardUnload)
})
</script>

<style scoped>
.settings-page { display: flex; flex-direction: column; height: 100%; background: var(--bg-base); }
.page-head {
  display: flex;
  align-items: baseline;
  gap: 12px;
  flex-wrap: wrap;
  padding: 18px 32px 0;
}
.page-title {
  font-size: 22px;
  font-weight: 800;
  letter-spacing: -0.02em;
  color: var(--text-0);
}
.page-head-sub { font-size: 12px; color: var(--text-3); }

.settings-layout { display: flex; flex: 1; min-height: 0; }

.settings-nav {
  flex-shrink: 0; padding: 4px 12px 16px;
  display: flex; flex-direction: column; gap: 14px;
  overflow: hidden auto;
  min-width: 0;
}
.nav-group-label { flex: none; }
.nav-item { flex: none; }

/* —— 可拖拽分隔条 —— */
.pane-resizer {
  flex: none;
  width: 7px;
  cursor: col-resize;
  position: relative;
  z-index: 3;
  display: flex;
  justify-content: center;
  touch-action: none;
}
.pane-resizer::before {
  content: '';
  width: 1px;
  height: 100%;
  background: transparent;
  transition: width var(--dur-fast) var(--ease-out), background var(--dur-fast) var(--ease-out);
}
.pane-resizer:hover::before,
.pane-resizer:active::before,
.pane-resizer:focus-visible::before {
  width: 2.5px;
  background: var(--accent);
  opacity: 0.75;
  border-radius: 99px;
}

/* —— 中间二级目录 —— */
.settings-subnav {
  flex-shrink: 0;
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: var(--bg-0);
  border-left: 1px solid var(--border);
  border-right: 1px solid var(--border);
  padding: 12px 10px 10px;
}
.subnav-head {
  display: flex;
  align-items: flex-start;
  gap: 9px;
  padding: 4px 6px 11px;
  border-bottom: 1px solid var(--border);
}
.subnav-head-icon { margin-top: 1px; color: var(--accent); flex-shrink: 0; }
.subnav-head-copy { min-width: 0; flex: 1; }
.subnav-title { font-size: 13px; font-weight: 700; color: var(--text-0); }
.subnav-desc { font-size: 10.5px; color: var(--text-3); margin-top: 2px; line-height: 1.5; }
.subnav-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 6px 0 2px;
}
.subnav-group-title {
  font-size: 10.5px; font-weight: 650; letter-spacing: 0.06em;
  color: var(--text-3); padding: 2px 8px 5px;
}
.subnav-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 7px 9px;
  font-size: 12.5px;
  font-weight: 550;
  border: none;
  border-radius: var(--radius);
  background: transparent;
  color: var(--text-1);
  cursor: pointer;
  transition: all var(--dur-fast) var(--ease-out);
  text-align: left;
}
.subnav-item:hover { background: var(--bg-hover); color: var(--text-0); }
.subnav-item.active { background: var(--accent-bg); color: var(--accent-text); font-weight: 650; }
.subnav-item:focus-visible { outline: none; box-shadow: 0 0 0 3.5px var(--button-focus); }
.subnav-item-icon {
  width: 26px; height: 26px; border-radius: 8px; flex-shrink: 0;
  background: var(--accent-bg); color: var(--accent-text);
  display: flex; align-items: center; justify-content: center;
  font-size: 13px;
}
.subnav-item-label { flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.subnav-count {
  font-size: 10px; font-weight: 700; font-family: var(--font-mono); flex-shrink: 0;
  background: var(--bg-active); color: var(--text-2);
  padding: 1px 6px; border-radius: 99px;
}
.subnav-item.active .subnav-count { background: var(--accent-bg); color: var(--accent-text); }
.subnav-foot {
  flex: none;
  margin-top: 8px;
  padding: 8px 6px 2px;
  font-size: 10px;
  line-height: 1.5;
  color: var(--text-3);
  border-top: 1px solid var(--border);
}
.subnav-loading { display: flex; flex-direction: column; gap: 8px; padding: 8px 4px; }
.subnav-skel-row { display: flex; align-items: center; gap: 10px; }
.subnav-error {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 8px;
  padding: 10px 8px;
  font-size: 12px;
  color: var(--text-2);
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
  cursor: pointer; transition: all var(--dur-fast) var(--ease-out); text-align: left; width: 100%;
}
.nav-item:hover { background: var(--bg-hover); color: var(--text-0); }
.nav-item.active { background: var(--accent-bg); color: var(--accent-text); font-weight: 650; }
.nav-item:focus-visible { outline: none; box-shadow: 0 0 0 3.5px var(--button-focus); }

.settings-content { flex: 1; min-width: 0; min-height: 0; overflow: hidden; }
.settings-scroll { height: 100%; overflow-y: auto; padding: 20px 32px 48px; max-width: 1180px; margin: 0 auto; animation: fadeUp var(--dur-slow) var(--ease-out); }
.settings-head { margin-bottom: 16px; }
.settings-title { font-size: 18px; font-weight: 800; letter-spacing: -0.02em; }
.settings-desc { font-size: 12px; color: var(--text-2); margin-top: 4px; }

/* 按服务类型分组的配置卡 */
.sections { display: flex; flex-direction: column; gap: 16px; }
.svc-group { overflow: hidden; }

/* —— 能力总览条 —— */
.cap-strip {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  overflow: hidden;
}
.cap-cell {
  min-width: 0;
  padding: 14px 18px 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.cap-cell + .cap-cell { border-left: 1px solid var(--border); }
.cap-cell-top { display: flex; align-items: center; gap: 9px; min-width: 0; }
.cap-cell-top .btn { margin-left: auto; flex-shrink: 0; }
.cap-badge {
  width: 30px; height: 30px; border-radius: 9px; flex-shrink: 0;
  display: grid; place-items: center;
  font-size: 13px; font-weight: 800; color: var(--text-invert);
  background: var(--accent);
  box-shadow: var(--shadow-badge);
}
.cap-badge.t-image { background: linear-gradient(135deg, #8b5cf6, #4f46e5); }
.cap-badge.t-video { background: linear-gradient(135deg, #f43f5e, #f97316); }
.cap-badge.t-audio { background: linear-gradient(135deg, #06b6d4, #10b981); }
.cap-cell-title {
  font-size: 13.5px; font-weight: 700; color: var(--text-0);
  min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.cap-cell-meta { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; }
.cap-default {
  display: inline-flex; align-items: center; gap: 4px;
  max-width: 100%; padding: 2px 9px;
  border: 1px solid var(--accent);
  border-radius: 999px;
  background: var(--accent-bg);
  color: var(--accent);
  font-size: 10.5px;
  overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}
.cap-default svg { flex-shrink: 0; fill: currentColor; }
.cap-none {
  padding: 2px 9px; border-radius: 999px;
  background: var(--bg-2); color: var(--text-3);
  font-size: 10.5px; white-space: nowrap;
}

/* —— 能力组配置卡（二级目录切换，单列全宽展示） —— */
.cap-card { overflow: hidden; }

/* 卡内配置行：行内收纳（徽标 + 信息列 + 动作行） */
.cap-card .config-row {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr);
  gap: 2px 12px;
  align-items: start;
  padding: 12px 16px;
}
.cap-card .config-row + .config-row { border-top: 1px solid var(--border); }
.cap-card .config-row .provider-badge { width: 34px; height: 34px; border-radius: 9px; font-size: 13px; }
.cap-card .config-row .config-main {
  grid-column: 2;
  display: flex;
  flex-direction: column;
  gap: 3px;
  min-width: 0;
}
.cap-card .config-row .config-actions {
  grid-column: 2;
  display: flex;
  align-items: center;
  gap: 6px;
  padding-top: 5px;
}
.cap-card .config-actions .config-switch { margin-left: auto; }
.svc-group-head {
  display: flex; align-items: center; gap: 10px;
  padding: 14px 20px;
  border-bottom: 1px solid var(--border);
}
.svc-group-heading { min-width: 0; }
.svc-group-title { font-size: 14px; font-weight: 700; color: var(--text-0); }
.svc-group-sub { font-size: 11.5px; color: var(--text-3); margin-top: 2px; }

/* 风格预设详情卡（二级目录切换展示，默认展开可编辑） */
.styles-head { display: flex; align-items: flex-start; gap: 12px; }
.styles-head-copy { min-width: 0; flex: 1; }
.style-detail-card { overflow: hidden; }
.style-detail-badge {
  width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  background: linear-gradient(135deg, #f5a623, #e86b2a);
  color: var(--text-invert);
  box-shadow: var(--shadow-badge);
}
.style-detail-body { padding: 16px 20px 18px; display: flex; flex-direction: column; gap: 14px; }
.style-detail-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px 14px; }
.style-detail-grid .field-wide { grid-column: 1 / -1; }
.style-detail-foot { display: flex; align-items: center; gap: 8px; }
.config-row { display: flex; align-items: center; gap: 12px; padding: 12px 20px; }
.config-row + .config-row { border-top: 1px solid var(--border); }
.provider-badge {
  width: 36px; height: 36px; border-radius: 10px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 14px; color: var(--text-invert);
  background: var(--accent);
  box-shadow: var(--shadow-badge);
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
  transition: border-color var(--dur-instant) var(--ease-out), color var(--dur-instant) var(--ease-out), background var(--dur-instant) var(--ease-out);
}
.cfg-model-chip:hover { border-color: var(--accent); color: var(--accent); }
.cfg-model-chip.cfg-model-chip-ro,
.cfg-model-chip.cfg-model-chip-ro:hover { border-color: var(--border); color: var(--text-2); cursor: default; }
.cfg-model-chip.is-default {
  border-color: var(--accent);
  background: var(--accent-bg);
  color: var(--accent);
  font-weight: 600;
  cursor: default;
}
.cfg-model-star { fill: currentColor; }
.cfg-model-chip.is-selected {
  border-color: var(--accent);
  background: var(--accent-bg);
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
  border: 1px solid var(--border-strong);
  background: transparent;
}
.cfg-model-chip.is-selected .cfg-model-box {
  border-color: var(--accent);
  background: var(--accent);
}
.cfg-model-check { color: var(--text-invert); flex-shrink: 0; }
.model-fetch-actions { display: flex; gap: 8px; margin-top: 6px; }
.config-empty { font-size: 12px; color: var(--text-3); padding: 14px 20px; }
.config-switch { display: inline-flex; flex-shrink: 0; cursor: pointer; }
.config-switch input:focus-visible + .switch { box-shadow: 0 0 0 3.5px var(--button-focus); }
.btn-icon.btn-sm { width: 30px; min-width: 30px; height: 30px; min-height: 30px; }

/* Agent */
.agent-list { display: flex; flex-direction: column; gap: 10px; }
.agent-card { overflow: hidden; }
.agent-card-head { display: flex; align-items: center; gap: 12px; padding: 14px 18px; cursor: pointer; transition: background var(--dur-fast) var(--ease-out); }
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

/* Skills 页面（中栏 Agent 目录 + 右栏编辑区） */
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
.skill-card-head { display: flex; align-items: center; gap: 10px; padding: 12px 16px; cursor: pointer; transition: background var(--dur-fast) var(--ease-out); }
.skill-card-head:hover { background: var(--bg-hover); }
.skill-card-body { padding: 14px 16px 16px; display: flex; flex-direction: column; gap: 10px; border-top: 1px solid var(--border); }
.skill-card-foot { display: flex; align-items: center; gap: 8px; }
.skill-load-error {
  display: flex; align-items: center; gap: 10px; padding: 12px 14px;
  border: 1px solid var(--error-outline); background: var(--error-bg); border-radius: 10px;
}
.skill-load-error-icon { color: var(--error); }
.skill-loading {
  display: flex; align-items: center; justify-content: center; gap: 8px;
  padding: 26px 0; color: var(--text-3); font-size: 12.5px;
}

/* Shared（.field 骨架样式已随 P2-B1 下沉 Field 组件，.required 提升为 studio.css 全局类） */

/* Dialogs（弹窗宽度改由 <AppDialog width> 提供，仅保留 body 内部布局类） */
.config-dialog-body { display: flex; flex-direction: column; gap: 14px; }
/* Style AI expand bar */
.style-ai-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 9px 11px;
  border: 1px dashed color-mix(in srgb, var(--accent) 45%, var(--border));
  border-radius: 9px;
  background: var(--accent-bg);
}
.style-ai-copy { display: flex; flex-direction: column; gap: 2px; min-width: 0; }
.style-ai-copy span { font-size: 12px; font-weight: 650; color: var(--accent-text); }
.style-ai-copy small { font-size: 10.5px; line-height: 1.5; color: var(--text-3); }
.style-ai-bar .btn { flex-shrink: 0; }
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
  transition: all var(--dur-fast) var(--ease-out);
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
.test-result.ok { border-color: var(--success-border-strong); background: var(--success-bg); }
.test-result.bad { border-color: var(--error-border-strong); background: var(--error-bg); }
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

/* 拖拽分隔条时禁止选中文本 */
:global(body.resizing-panes) {
  cursor: col-resize;
  user-select: none;
}

/* 窄屏：总览条堆叠为单列 */
@media (max-width: 960px) {
  .cap-strip { grid-template-columns: 1fr; }
  .cap-cell + .cap-cell {
    border-left: none;
    border-top: 1px solid var(--border);
  }
}

/* 窄窗口：收起中间二级目录与分隔条，退回左侧导航 + 正文两栏 */
@media (max-width: 1080px) {
  .pane-resizer,
  .settings-subnav {
    display: none;
  }
  .settings-nav {
    border-right: 1px solid var(--border);
  }
}
</style>
