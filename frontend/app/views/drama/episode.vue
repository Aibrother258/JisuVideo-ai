<template>
  <!-- 工作台加载 / 失败态（P0-C1/C2）：初始加载显示骨架，失败内联错误 + 重试 -->
  <div v-if="pageLoading" class="app-page-loading">
    <div class="app-state">
      <div class="app-state-icon"><div class="app-skeleton-line" style="width:24px;height:24px;border-radius:8px"></div></div>
      <div class="app-skeleton-line" style="width:170px"></div>
      <div class="app-skeleton-line" style="width:280px;height:11px"></div>
    </div>
  </div>
  <div v-else-if="pageLoadError" class="app-page-loading">
    <div class="app-state app-state-error">
      <div class="app-state-icon">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
      </div>
      <div class="app-state-title">工作台加载失败</div>
      <p class="app-state-desc">{{ pageLoadError }}</p>
      <button class="btn btn-primary btn-sm" @click="refresh(true)">重试</button>
    </div>
  </div>
  <div class="studio" v-else-if="drama">
    <header class="studio-topbar">
      <div class="studio-topbar-main">
        <button class="back-btn topbar-back" @click="navigateTo(`/drama/${dramaId}`)">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
          </svg>
          返回项目
        </button>
        <div class="studio-identity">
          <h1 class="studio-title">{{ drama.title }}</h1>
          <span class="studio-episode-chip">第 {{ episodeNumber }} 集</span>
          <div class="studio-meta-row">
            <span class="studio-meta-pill">{{ currentSubStageLabel }}</span>
            <span class="studio-meta-pill is-progress">{{ pipelineProgress }}/{{ pipelineTotal }}</span>
            <span class="studio-meta-inline">{{ chars.length }} 角色 · {{ sbs.length }} 段落</span>
          </div>
        </div>
      </div>

      <div class="studio-topbar-side">
        <div class="studio-model-picks">
          <ModelSelect
            v-if="textModelOptions.length"
            v-model="chatModel"
            label="文本"
            :options="textModelOptions"
            :default-label="`默认 · ${textModelOptions[0].model}`"
            :show-config="textModelMultiCfg"
          />
          <ModelSelect
            v-if="imageModelOptions.length"
            v-model="imageModel"
            label="图片"
            :options="imageModelOptions"
            :default-label="`默认 · ${imageModelOptions[0].model}`"
            :show-config="imageModelMultiCfg"
          />
          <ModelSelect
            v-if="videoModelOptions.length"
            v-model="videoModel"
            label="视频"
            :options="videoModelOptions"
            :default-label="`默认 · ${videoModelOptions[0].model}`"
            :show-config="videoModelMultiCfg"
          />
          <div v-if="configsLoading" class="model-config-hint">模型配置加载中…</div>
          <div v-else-if="configsError" class="model-config-hint is-error">
            <span class="tag tag-error">模型配置加载失败</span>
            <button class="btn btn-sm btn-ghost" title="重试加载模型配置" @click="loadConfigs"><RefreshCw :size="11" /> 重试</button>
          </div>
        </div>
        <div class="studio-actions">
          <button class="btn" @click="refresh">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
            刷新
          </button>
          <button class="btn task-drawer-trigger" @click="openTaskDrawer">
            <ListTodo :size="12" />
            任务
            <span v-if="genTaskActiveCount" class="task-drawer-badge">{{ genTaskActiveCount }}</span>
          </button>
          <button class="btn" title="恢复所有工作台面板默认尺寸" @click="resetAllPanelSizes">
            恢复布局
          </button>
          <button class="btn btn-primary" @click="panel = mergeUrl ? 'export' : (sbs.length ? 'production' : 'script')">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
            {{ mergeUrl ? '查看成片' : (sbs.length ? '继续制作' : '开始制作') }}
          </button>
        </div>
      </div>
    </header>

    <div ref="studioBodyEl" class="studio-body" :style="studioBodyStyle">
    <!-- ========== LEFT SIDEBAR ========== -->
    <aside
      ref="sidebarEl"
      class="sidebar"
      :class="{ 'has-custom-height': panelLayout.sidebarHeight > 0 }"
      :style="sidebarStyle"
    >
      <nav class="pipeline">
        <div
          v-for="section in sidebarSections"
          :key="section.id"
          :class="['pipe-section', 'is-' + sectionState(section.id)]"
        >
          <div class="pipe-section-label">
            <span v-if="sectionState(section.id) !== 'none'" class="pipe-section-state">
              <svg v-if="sectionState(section.id) === 'done'" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
              <span v-else-if="sectionState(section.id) === 'active'" class="pipe-section-pulse" />
              <span v-else class="pipe-section-dot" />
            </span>
            <span>{{ section.label }}</span>
            <span v-if="sectionState(section.id) === 'active'" class="pipe-section-tag">进行中</span>
          </div>
          <button
            v-for="item in section.items"
            :key="item.key"
            :class="['pipe-item pipe-item-sub', {
              active: activeSubStepKey === item.key,
              done: sectionState(section.id) === 'done',
              doing: sectionState(section.id) === 'active',
            }]"
            @click="goSubStep(item.key)"
          >
            <span class="pipe-icon" :class="sectionState(section.id) === 'done' ? 'icon-done' : activeSubStepKey === item.key ? 'icon-active' : ''">
              <svg v-if="sectionState(section.id) === 'done'" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><polyline points="20 6 9 17 4 12"/></svg>
              <span v-else-if="sectionState(section.id) === 'active'" class="pipe-item-pulse" />
              <component v-else :is="item.icon" :size="11" />
            </span>
            <span class="pipe-copy">
              <span class="pipe-label">{{ item.label }}</span>
              <span v-if="item.desc" class="pipe-sub">{{ item.desc }}</span>
            </span>
          </button>
        </div>
      </nav>

      <!-- Bottom: Refresh -->
      <div class="sidebar-bottom">
        <div class="sidebar-jumper" v-if="sidebarJumpSteps.length">
          <button
            v-for="step in sidebarJumpSteps"
            :key="step.key"
            :class="['sidebar-jump-dot', { active: activeSubStepKey === step.key }]"
            @click="goSubStep(step.key)"
            :title="step.label"
          ></button>
        </div>
        <button class="refresh-btn" @click="refresh">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
          刷新数据
        </button>
      </div>
      <div
        class="panel-resizer panel-resizer-horizontal panel-resizer-sidebar-height"
        role="separator"
        aria-label="调整左侧导航高度"
        tabindex="0"
        title="拖动调整高度，双击恢复默认"
        @pointerdown="startSidebarHeightResize"
        @keydown="resizeSidebarHeightByKey"
        @dblclick="resetPanelSize('sidebarHeight')"
      />
    </aside>

    <div
      class="panel-resizer panel-resizer-vertical studio-sidebar-resizer"
      role="separator"
      aria-label="调整左侧导航宽度"
      tabindex="0"
      title="拖动调整宽度，双击恢复默认"
      @pointerdown="startSidebarWidthResize"
      @keydown="resizeSidebarWidthByKey"
      @dblclick="resetPanelSize('sidebarWidth')"
    />

    <!-- ========== MAIN CONTENT ========== -->
    <main class="main">
      <!-- ===== SCRIPT PANEL ===== -->
      <div v-if="panel === 'script'" class="content-panel">
        <!-- Step 0: Raw Content -->
        <div v-if="scriptStep === 0" class="step-editor">
          <div class="step-toolbar">
            <div class="toolbar-left">
              <div class="step-indicator">
                <span class="step-num">01</span>
                <span class="step-name">原始内容</span>
              </div>
            </div>
            <div class="toolbar-right">
              <span v-if="rawLen" class="char-count">{{ rawLen }} 字</span>
              <button class="btn btn-sm" @click="saveRaw(); toast.success('已保存')">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                保存
              </button>
            </div>
          </div>
          <textarea
            class="fill-textarea"
            v-model="localRaw"
            placeholder="粘贴小说原文、故事大纲或分镜描述..."
          />
        </div>

        <!-- Step 1: Rewrite -->
        <div v-else-if="scriptStep === 1" class="step-editor">
          <div class="step-toolbar">
            <div class="toolbar-left">
              <div class="step-indicator">
                <span class="step-num">02</span>
                <span class="step-name">AI 改写</span>
              </div>
            </div>
            <div class="toolbar-right">
              <span v-if="scriptLen" class="char-count">{{ scriptLen }} 字</span>
              <button v-if="rawContent" class="btn btn-sm" @click="skipRewrite">
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 12h14"/><path d="M13 18l6-6-6-6"/></svg>
                跳过改写
              </button>
              <LoadingButton v-if="scriptContent" :loading="rn && rt === 'script_rewriter'" :disabled="rn && rt !== 'script_rewriter'" class="btn btn-sm" spinner-size="11" @click="doRewrite">
                <template #icon><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg></template>
                重新改写
              </LoadingButton>
            </div>
          </div>

          <div v-if="!scriptContent && !rn" class="step-empty">
            <div class="empty-visual">
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round">
                <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/>
              </svg>
            </div>
            <div class="empty-title">AI 改写为格式化剧本</div>
            <div class="empty-desc">你可以先用 AI 把原始内容整理成格式化剧本，也可以跳过这一步，直接进入资产制作。</div>
            <div class="step-empty-actions">
              <button class="btn btn-primary" @click="doRewrite">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                开始改写
              </button>
              <button class="btn" @click="skipRewrite">
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M5 12h14"/><path d="M13 18l6-6-6-6"/></svg>
                跳过改写
              </button>
            </div>
          </div>
          <div v-else-if="rn && rt === 'script_rewriter'" class="step-loading">
            <Loader2 :size="24" class="animate-spin" style="color:var(--accent)" />
            <div class="loading-text">正在改写剧本...</div>
          </div>
          <textarea v-else class="fill-textarea" v-model="localScript" placeholder="格式化剧本内容..." />
        </div>
      </div>

      <!-- ===== PRODUCTION PANEL ===== -->
      <div v-else-if="panel === 'production'" class="content-panel">
        <!-- Guard: current production step prerequisites -->
        <div v-if="productionBlockMessage" class="step-empty" style="flex:1">
          <div class="empty-visual">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
          </div>
          <div class="empty-title">尚未准备就绪</div>
          <div class="empty-desc">{{ productionBlockMessage }}</div>
          <button class="btn btn-primary" @click="goProductionBlockTarget">{{ productionBlockActionLabel }}</button>
        </div>

        <template v-else>
          <!-- 制作子步骤导航（资产/分镜拆分/视频生成）由左侧栏承担，顶部不再重复展示 -->
          <!-- Sub: Assets -->
          <div v-if="prodTab === 'assets'" class="prod-content">
            <div class="prod-section-bar">
              <span class="dim" style="font-size:12px">资产</span>
              <span class="tag mono">{{ assetReadyCount }}/{{ assetTotalCount }} 已就绪</span>
              <span class="tag">{{ lockedImageConfigLabel }}</span>
              <div class="ml-auto flex gap-1 asset-bar-actions">
                <LoadingButton
                  v-for="t in EXTRACT_TARGETS"
                  :key="t.key"
                  :loading="isExtracting(t.key)"
                  class="btn btn-sm asset-btn-extract"
                  spinner-size="11"
                  @click="doExtract(t.key)"
                >
                  <template #icon><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg></template>
                  {{ (t.key === 'characters' ? chars.length : t.key === 'scenes' ? scenes.length : propItems.length) ? `重提${t.label}` : `提取${t.label}` }}
                </LoadingButton>
                <span class="asset-bar-divider" />
                <button class="btn btn-sm asset-btn-batch" @click="batchCharImages">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  批量角色
                </button>
                <button class="btn btn-sm asset-btn-batch" @click="batchSceneImages">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  批量场景
                </button>
                <button class="btn btn-sm asset-btn-batch" @click="batchPropImages">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
                  批量道具
                </button>
              </div>
            </div>
            <div v-if="extractingTargets.length && !chars.length && !scenes.length && !propItems.length" class="step-loading">
              <Loader2 :size="24" class="animate-spin" style="color:var(--accent)" />
              <div class="loading-text">正在提取{{ extractingLabels }}...</div>
            </div>
            <!-- R1：角色/场景/道具子资源加载失败且无任何资产时，显示加载失败而非误导性「开始提取资产」空态 -->
            <div v-else-if="assetsLoadError && !chars.length && !scenes.length && !propItems.length" class="app-state app-state-error compact-state">
              <div class="app-state-icon"><CircleAlert :size="20" /></div>
              <div class="app-state-title">资产加载失败</div>
              <p class="app-state-desc">{{ assetsLoadError }}</p>
              <button class="btn btn-primary btn-sm" @click="loadEpisodeAssets(episode)"><RefreshCw :size="12" /> 重试</button>
            </div>
            <div v-else-if="!chars.length && !scenes.length && !propItems.length" class="step-empty asset-empty-state">
              <div class="empty-visual">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              </div>
              <div class="empty-title">开始提取资产</div>
              <div class="empty-desc">角色、场景和道具会在提取后显示在这里，可分别单独提取，也可一键并行提取全部。</div>
              <LoadingButton :loading="!!extractingTargets.length" class="btn btn-primary" spinner-size="13" @click="doExtractAll">
                <template #icon><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg></template>
                {{ extractingTargets.length ? `正在提取${extractingLabels}…` : '开始提取' }}
              </LoadingButton>
            </div>
            <template v-else>
            <!-- R1：有旧数据时刷新失败：非破坏性错误条，保留已加载资产 -->
            <div v-if="assetsLoadError" class="video-history-error-row">
              <span class="tag tag-error">资产刷新失败</span>
              <span class="dim" style="font-size:11px">{{ assetsLoadError }}</span>
              <button class="btn btn-sm ml-auto" @click="loadEpisodeAssets(episode)"><RefreshCw :size="11" /> 重试</button>
            </div>
            <div class="asset-section-title">
              角色
              <button class="asset-add-btn" @click="openAssetCreate('character')"><Plus :size="11" /> 新增</button>
            </div>
            <template v-if="visualChars.length">
            <div class="character-asset-grid">
              <article
                v-for="c in visualChars"
                :key="c.id"
                class="card character-asset-card"
                tabindex="0"
                role="button"
                @click="openAssetDetail('character', c)"
                @keydown.enter.prevent="openAssetDetail('character', c)"
                @keydown.space.prevent="openAssetDetail('character', c)"
              >
                <button class="asset-del-btn" title="删除角色" @click.stop="askDeleteAsset('character', c)"><X :size="11" /></button>
                <div class="character-asset-main">
                  <div class="character-asset-overview"><div class="character-portrait">
                      <img
                        v-if="c.image_url || c.imageUrl"
                        :src="thumbOf(assetImageSrc(c))"
                        class="previewable-image"
                        loading="lazy"
                        @error="thumbFallback($event, assetImageSrc(c))"
                        @click.stop="openImageViewer(assetImageSrc(c), `${c.name} 角色形象`)"
                      />
                      <div v-else class="character-portrait-empty">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                      </div>
                      <StatusBadge variant="cover" :state="(c.image_url || c.imageUrl) ? 'ready' : (isPendingCharImage(c.id) ? 'pending' : '')">
                        {{ (c.image_url || c.imageUrl) ? '形象已生成' : (isPendingCharImage(c.id) ? '形象生成中' : '形象待生成') }}
                      </StatusBadge>
                    </div>

                    <div class="character-asset-head">
                      <div class="character-title-block">
                        <div class="character-name-row">
                          <strong class="character-name">{{ c.name }}</strong>
                          <span class="tag">{{ c.role || '角色' }}</span>
                        </div>
                        <div class="character-visual-summary" :title="characterVisualSummary(c)">
                          <span>样貌：{{ characterAppearanceValue(c) }}</span>
                          <span>妆造：{{ characterStylingValue(c) }}</span>
                        </div>
                      </div>
                      <LoadingButton class="btn btn-sm character-gen-btn" :loading="isPendingCharImage(c.id)" spinner-size="11" @click.stop="genCharImg(c.id)">
                        {{ (c.image_url || c.imageUrl) ? '重绘' : (isPendingCharImage(c.id) ? '生成中' : '生成') }}
                      </LoadingButton>
                      <LoadingButton class="btn btn-sm" title="上传角色形象图" :loading="isUploadingAsset('character', c.id)" spinner-size="11" @click.stop="uploadAssetImage('character', c.id)">
                        <template #icon><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg></template>
                        上传
                      </LoadingButton>
                    </div>
                  </div>
                  <div class="asset-final-prompt" :title="c.final_prompt || c.finalPrompt || ''">
                    <span class="afp-label">最终提示词 · 三视图</span>
                    <span :class="['afp-text', !(c.final_prompt || c.finalPrompt) && 'dim']">{{ c.final_prompt || c.finalPrompt || '首次生成形象时由提示词 Agent 自动生成' }}</span>
                  </div>
                </div>
              </article>
            </div>
            </template>

            <div class="asset-section-title">
              场景
              <button class="asset-add-btn" @click="openAssetCreate('scene')"><Plus :size="11" /> 新增</button>
            </div>
            <template v-if="scenes.length">
            <div class="asset-grid">
              <div
                v-for="s in scenes"
                :key="s.id"
                class="card asset-card asset-click-card"
                tabindex="0"
                role="button"
                @click="openAssetDetail('scene', s)"
                @keydown.enter.prevent="openAssetDetail('scene', s)"
                @keydown.space.prevent="openAssetDetail('scene', s)"
              >
                <button class="asset-del-btn" title="删除场景" @click.stop="askDeleteAsset('scene', s)"><X :size="11" /></button>
                <div class="asset-cover wide">
                  <img
                    v-if="s.image_url || s.imageUrl"
                    :src="thumbOf(assetImageSrc(s))"
                    class="previewable-image"
                    loading="lazy"
                    @error="thumbFallback($event, assetImageSrc(s))"
                    @click.stop="openImageViewer(assetImageSrc(s), `${s.location} 场景图`)"
                  />
                  <div v-else class="asset-cover-empty">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  </div>
                  <StatusBadge variant="cover" :state="(s.image_url || s.imageUrl) ? 'ready' : (isPendingSceneImage(s.id) ? 'pending' : '')">{{ (s.image_url || s.imageUrl) ? '已生成' : (isPendingSceneImage(s.id) ? '生成中' : '待生成') }}</StatusBadge>
                </div>
                <div class="asset-body">
                  <div class="asset-name" :title="s.location">{{ s.location }}</div>
                  <div class="asset-meta asset-desc dim" :title="sceneDescriptionValue(s)">{{ sceneDescriptionValue(s) }}</div>
                  <div v-if="sceneLightingValue(s)" class="asset-meta asset-light dim" :title="sceneLightingValue(s)">光照 · {{ sceneLightingValue(s) }}</div>
                  <div class="asset-meta asset-final" :class="{ dim: !(s.final_prompt || s.finalPrompt) }" :title="s.final_prompt || s.finalPrompt || ''">
                    <span class="afp-label">最终提示词 · 固定视角</span>
                    {{ s.final_prompt || s.finalPrompt || '首次生成图片时由提示词 Agent 自动生成（前景/中景/后景）' }}
                  </div>
                </div>
                <div class="asset-foot">
                  <span :class="['dot', (s.image_url || s.imageUrl) && 'ok', isPendingSceneImage(s.id) && 'pending']" />
                  <LoadingButton class="btn btn-sm ml-auto" title="上传场景图" :loading="isUploadingAsset('scene', s.id)" spinner-size="11" @click.stop="uploadAssetImage('scene', s.id)">
                    <template #icon><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg></template>
                    上传
                  </LoadingButton>
                  <LoadingButton class="btn btn-sm" :loading="isPendingSceneImage(s.id)" spinner-size="11" @click.stop="genSceneImg(s.id)">
                    {{ (s.image_url || s.imageUrl) ? '重绘' : (isPendingSceneImage(s.id) ? '生成中' : '生成') }}
                  </LoadingButton>
                </div>
              </div>
            </div>
            </template>

            <div class="asset-section-title">
              道具
              <button class="asset-add-btn" @click="openAssetCreate('prop')"><Plus :size="11" /> 新增</button>
            </div>
            <div v-if="propItems.length" class="asset-grid">
              <div
                v-for="p in propItems"
                :key="p.id"
                class="card asset-card asset-click-card prop-card"
                tabindex="0"
                role="button"
                @click="openAssetDetail('prop', p)"
                @keydown.enter.prevent="openAssetDetail('prop', p)"
                @keydown.space.prevent="openAssetDetail('prop', p)"
              >
                <button class="asset-del-btn" title="删除道具" @click.stop="askDeleteAsset('prop', p)"><X :size="11" /></button>
                <div class="asset-cover wide">
                  <img
                    v-if="p.image_url || p.imageUrl"
                    :src="thumbOf(assetImageSrc(p))"
                    class="previewable-image"
                    loading="lazy"
                    @error="thumbFallback($event, assetImageSrc(p))"
                    @click.stop="openImageViewer(assetImageSrc(p), `${p.name} 道具图`)"
                  />
                  <div v-else class="asset-cover-empty">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
                  </div>
                  <StatusBadge variant="cover" :state="(p.image_url || p.imageUrl) ? 'ready' : (isPendingPropImage(p.id) ? 'pending' : '')">{{ (p.image_url || p.imageUrl) ? '已生成' : (isPendingPropImage(p.id) ? '生成中' : '待生成') }}</StatusBadge>
                </div>
                <div class="asset-body">
                  <div class="prop-name-row">
                    <span class="asset-name" :title="p.name">{{ p.name }}</span>
                    <span class="tag">{{ p.type || '道具' }}</span>
                  </div>
                  <div class="asset-meta asset-desc dim" :title="p.description || ''">{{ p.description || '暂无描述' }}</div>
                  <div class="asset-meta asset-final" :class="{ dim: !(p.final_prompt || p.finalPrompt) }" :title="p.final_prompt || p.finalPrompt || ''">
                    <span class="afp-label">最终提示词 · 白底单品</span>
                    {{ p.final_prompt || p.finalPrompt || '首次生成图片时由提示词 Agent 自动生成（白底单品）' }}
                  </div>
                </div>
                <div class="asset-foot">
                  <span :class="['dot', (p.image_url || p.imageUrl) && 'ok', isPendingPropImage(p.id) && 'pending']" />
                  <LoadingButton class="btn btn-sm ml-auto" title="上传道具图" :loading="isUploadingAsset('prop', p.id)" spinner-size="11" @click.stop="uploadAssetImage('prop', p.id)">
                    <template #icon><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg></template>
                    上传
                  </LoadingButton>
                  <LoadingButton class="btn btn-sm" :loading="isPendingPropImage(p.id)" spinner-size="11" @click.stop="genPropImg(p.id)">
                    {{ (p.image_url || p.imageUrl) ? '重绘' : (isPendingPropImage(p.id) ? '生成中' : '生成') }}
                  </LoadingButton>
                </div>
              </div>
            </div>
            <div v-else class="asset-props-empty">本集暂无涉及事态发展的关键道具</div>
            </template>
          </div>

          <!-- Sub: Storyboard Split -->
          <div v-if="prodTab === 'storyboard'" class="prod-content">
            <div class="prod-section-bar">
              <span class="dim" style="font-size:12px">分镜拆分</span>
              <span class="tag mono">{{ sbs.length }} 段落 · {{ totalDuration }}s</span>
              <span class="tag">{{ lockedVideoConfigLabel }}</span>
              <div class="ml-auto flex gap-1">
                <LoadingButton :loading="rt === 'storyboard_breaker'" :disabled="rn && rt !== 'storyboard_breaker'" class="btn btn-sm" spinner-size="11" @click="doBreakdown">
                  <template #icon><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg></template>
                  {{ sbs.length ? '重新拆分' : '开始拆分' }}
                </LoadingButton>
                <LoadingButton :loading="videoPromptBatch.running" :disabled="!sbs.length" class="btn btn-sm" spinner-size="11" @click="batchVideoPrompts">
                  <template #icon><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></template>
                  {{ videoPromptBatch.running ? `提示词 ${videoPromptBatch.completed}/${videoPromptBatch.total}` : (selectedSbIds.length ? `生成所选提示词(${selectedSbIds.length})` : '批量视频提示词') }}
                </LoadingButton>
              </div>
            </div>

            <div
              v-if="sbs.length"
              ref="storyboardWorkbenchEl"
              class="storyboard-workbench"
              :class="{ 'has-custom-height': panelLayout.storyboardWorkbenchHeight > 0 }"
              :style="storyboardWorkbenchStyle"
            >
              <aside ref="storyboardListEl" class="storyboard-shot-list">
                <div class="shot-list-head">
                  <div class="shot-list-head-main">
                    <div class="shot-list-head-copy">
                      <div class="shot-list-title">分镜列表</div>
                      <div class="shot-list-sub">检查拆分描述和绑定的角色场景</div>
                    </div>
                    <span class="tag mono">{{ totalDuration }}s</span>
                    <button v-if="!sbSelectMode && sbs.length" class="shot-quick-btn" @click="sbSelectMode = true">选择</button>
                  </div>
                  <div v-if="sbSelectMode" class="shot-quick-actions">
                    <button class="shot-quick-btn" @click="toggleSelectAllSbs">全选</button>
                    <button class="shot-quick-btn" @click="selectMissingSbs">仅缺失</button>
                    <button class="shot-quick-btn" @click="selectedSbIds = []">清空</button>
                  </div>
                </div>
                <div class="shot-list-body">
                  <button
                    v-for="(sb, i) in sbs"
                    :key="sb.id"
                    type="button"
                    class="storyboard-shot-card"
                    :class="{ active: !sbSelectMode && selectedSb?.id === sb.id, 'is-selected': sbSelectMode && isSbSelected(sb.id) }"
                    @click="onShotCardClick(sb)"
                  >
                    <div class="storyboard-shot-head">
                      <span
                        v-if="sbSelectMode"
                        class="shot-check"
                        :class="{ on: isSbSelected(sb.id) }"
                      >
                        <svg v-if="isSbSelected(sb.id)" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                      </span>
                      <div class="shot-num">#{{ String(i + 1).padStart(2, '0') }}</div>
                      <span class="storyboard-shot-chip">{{ sb.duration || 10 }}s</span>
                      <span v-if="getSceneName(sb)" class="shot-location"><MapPin :size="9" />{{ getSceneName(sb) }}</span>
                      <span v-if="hasVid(sb)" class="shot-chip-video" title="已生成视频"><Play :size="8" />已出片</span>
                    </div>
                    <div class="shot-body">
                      <div class="shot-desc" :class="{ 'is-empty': !sb.description }">{{ sb.description || '暂无画面描述' }}</div>
                    </div>
                    <div class="shot-meta">
                      <div class="shot-avatars">
                        <template v-if="getStoryboardCharacters(sb).length">
                          <span
                            v-for="c in getStoryboardCharacters(sb).slice(0, 3)"
                            :key="c.id"
                            class="shot-avatar"
                            :title="c.name"
                          >
                            <img v-if="assetImageSrc(c)" :src="thumbOf(assetImageSrc(c))" :alt="c.name" loading="lazy" @error="thumbFallback($event, assetImageSrc(c))" />
                            <template v-else>{{ (c.name || '?').slice(0, 1) }}</template>
                          </span>
                          <span v-if="getStoryboardCharacters(sb).length > 3" class="shot-avatar shot-avatar-more">+{{ getStoryboardCharacters(sb).length - 3 }}</span>
                        </template>
                        <span v-else class="shot-avatars-empty">0 角色</span>
                      </div>
                      <div class="shot-flags">
                        <span class="shot-flag flag-video" :class="{ on: hasVid(sb) }" :title="hasVid(sb) ? '已生成视频' : '未生成视频'"><i class="dot"></i>视</span>
                      </div>
                    </div>
                  </button>
                </div>
                <div v-if="sbSelectMode" class="shot-select-bar">
                  <div class="shot-select-info">
                    <span class="shot-select-count">已选 {{ selectedSbIds.length }} 个</span>
                    <button class="btn btn-sm" @click="exitSbSelectMode">取消</button>
                  </div>
                  <LoadingButton :loading="videoPromptBatch.running" :disabled="!selectedSbIds.length" class="btn btn-sm btn-primary shot-select-go" spinner-size="11" @click="generateSelectedVideoPrompts">
                    {{ videoPromptBatch.running ? `生成中 ${videoPromptBatch.completed}/${videoPromptBatch.total}` : `生成视频提示词(${selectedSbIds.length})` }}
                  </LoadingButton>
                </div>
              </aside>

              <div
                class="panel-resizer panel-resizer-vertical storyboard-column-resizer"
                role="separator"
                aria-label="调整分镜列表宽度"
                tabindex="0"
                title="拖动调整宽度，双击恢复默认"
                @pointerdown="startStoryboardListResize"
                @keydown="resizeStoryboardListByKey"
                @dblclick="resetPanelSize('storyboardListWidth')"
              />

              <section class="storyboard-editor-main" v-if="selectedSb">
                <div class="sb-header-top">
                  <div class="sb-nav-group">
                    <button
                      type="button"
                      class="btn btn-icon btn-sm sb-nav-btn"
                      :disabled="sbs.indexOf(selectedSb) <= 0"
                      @click="selectedSb = sbs[sbs.indexOf(selectedSb) - 1]"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
                    </button>
                    <div class="detail-head-copy">
                      <span class="detail-head-title">分镜 #{{ sbs.indexOf(selectedSb) + 1 }}</span>
                      <span class="dim sb-header-total">/ 共 {{ sbs.length }} 个</span>
                    </div>
                    <button
                      type="button"
                      class="btn btn-icon btn-sm sb-nav-btn"
                      :disabled="sbs.indexOf(selectedSb) >= sbs.length - 1"
                      @click="selectedSb = sbs[sbs.indexOf(selectedSb) + 1]"
                    >
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
                    </button>
                  </div>
                </div>
                <div class="sb-header-fields">
                  <span class="sb-field-label">时长</span>
                  <span class="sb-duration-input">
                    <input :value="selectedSb.duration || 10" class="input" type="number" min="1" max="60" @blur="updateField(selectedSb, 'duration', Number($event.target.value))" />
                    <span class="sb-duration-unit">s</span>
                  </span>
                  <!-- 角色/场景/道具绑定已移至右侧参考素材面板 -->
                </div>

                <div class="storyboard-editor-scroll">
                  <div ref="storyboardSplitEl" class="sb-split" :style="storyboardSplitStyle">
                    <div ref="storyboardDescriptionPanelEl" class="detail-section sb-description-panel">
                      <div class="detail-section-head">
                        <span class="detail-section-title">分镜描述</span>
                      </div>
                      <label class="field">
                        <span class="field-label">画面描述 <span class="dim">(按【镜头1】【镜头2】…逐子镜头描述；台词写「角色名说：「台词」」，旁白写「旁白：内容」)</span></span>
                        <textarea :value="selectedSb.description || ''" class="textarea" rows="8" @blur="updateField(selectedSb, 'description', $event.target.value)" placeholder="分镜画面描述" />
                      </label>
                      <label class="field">
                        <span class="field-label">氛围</span>
                        <textarea :value="selectedSb.atmosphere || ''" class="textarea" rows="3" @blur="updateField(selectedSb, 'atmosphere', $event.target.value)" placeholder="光线、色调、空气感、环境氛围" />
                      </label>
                    </div>

                    <div
                      class="panel-resizer panel-resizer-vertical sb-content-resizer"
                      role="separator"
                      aria-label="调整分镜描述与提示词宽度"
                      tabindex="0"
                      title="拖动调整宽度，双击恢复默认"
                      @pointerdown="startStoryboardDescriptionResize"
                      @keydown="resizeStoryboardDescriptionByKey"
                      @dblclick="resetPanelSize('storyboardDescriptionWidth')"
                    />

                    <div ref="storyboardPromptStackEl" class="sb-prompt-stack" :style="storyboardPromptStackStyle">
                    <div ref="storyboardVideoPromptEl" class="detail-section">
                      <div class="detail-section-head">
                        <span class="detail-section-title">视频提示词</span>
                        <LoadingButton
                          :loading="videoPromptGeneratingIds.includes(selectedSb?.id)"
                          :disabled="videoPromptBatch.running"
                          type="button"
                          class="btn btn-sm"
                          spinner-size="11"
                          @click="genVideoPrompt(selectedSb)"
                        >
                          {{ (selectedSb.video_prompt || selectedSb.videoPrompt) ? '重新生成' : 'AI 生成' }}
                        </LoadingButton>
                      </div>
                      <div class="detail-section-copy">根据当前分镜的画面描述（含台词/旁白）与氛围生成</div>
                      <MentionTextarea
                        :model-value="selectedSb.video_prompt || selectedSb.videoPrompt || ''"
                        :options="mentionOptions"
                        :rows="12"
                        input-class="textarea"
                        placeholder="用 @角色名 / @场景名 / @道具名 引用参考素材，按 3 秒一段换行描述画面运动与镜头；也可点 AI 生成由提示词 Agent 自动创作…"
                        @commit="v => updateField(selectedSb, 'video_prompt', v)"
                      />
                    </div>

                    <div
                      class="panel-resizer panel-resizer-horizontal sb-prompt-height-resizer"
                      role="separator"
                      aria-label="调整视频提示词与 H3 提示词高度"
                      tabindex="0"
                      title="拖动调整高度，双击恢复默认"
                      @pointerdown="startStoryboardPromptHeightResize"
                      @keydown="resizeStoryboardPromptHeightByKey"
                      @dblclick="resetPanelSize('storyboardVideoPromptHeight')"
                    />

                    <div class="detail-section">
                      <div class="detail-section-head">
                        <span class="detail-section-title">MiniMax H3 大模型提示词</span>
                        <LoadingButton
                          :loading="minimaxH3PromptGeneratingIds.includes(selectedSb?.id)"
                          type="button"
                          class="btn btn-sm"
                          spinner-size="11"
                          @click="genMinimaxH3Prompt(selectedSb)"
                        >
                          MiniMax H3 提示词
                        </LoadingButton>
                      </div>
                      <div class="detail-section-copy">根据中文版视频提示词和实际参考素材顺序生成；不会覆盖中文版</div>
                      <textarea
                        :value="selectedSb.minimax_h3_prompt || selectedSb.minimaxH3Prompt || ''"
                        class="textarea"
                        rows="14"
                        placeholder="点击“MiniMax H3 提示词”，自动生成 T2VA / I2VA / Ref2VA 英文结构化提示词…"
                        @blur="updateField(selectedSb, 'minimax_h3_prompt', $event.target.value)"
                      />
                    </div>
                    </div>
                  </div>
                </div>
              </section>

              <div
                class="panel-resizer panel-resizer-vertical storyboard-column-resizer"
                role="separator"
                aria-label="调整参考素材栏宽度"
                tabindex="0"
                title="拖动调整宽度，双击恢复默认"
                @pointerdown="startStoryboardReferenceResize"
                @keydown="resizeStoryboardReferenceByKey"
                @dblclick="resetPanelSize('storyboardReferenceWidth')"
              />

              <aside ref="storyboardReferenceEl" class="storyboard-reference-panel" v-if="selectedSb">
                <div class="storyboard-ref-head">
                  <div>
                    <div class="storyboard-ref-title">参考素材</div>
                    <div class="storyboard-ref-copy">绑定角色 / 场景 / 道具作为视频参考</div>
                  </div>
                  <span class="tag mono">{{ refBindableAssets.filter(a => a.bound).length }}/{{ refBindableAssets.length }} 已绑定</span>
                </div>
                <div class="storyboard-ref-list">
                  <template v-for="group in ['角色', '场景', '道具']" :key="group">
                    <div v-if="refBindableAssets.filter(a => a.type === group).length" class="storyboard-ref-group">
                      <div class="storyboard-ref-group-label">{{ group }}</div>
                      <div
                        v-for="asset in refBindableAssets.filter(a => a.type === group)"
                        :key="asset.key"
                        :class="['storyboard-ref-item', { bound: asset.bound }]"
                        :title="asset.bound ? '点击移出参考' : '点击添加为参考'"
                        @click="toggleShotBind(selectedSb, asset)"
                      >
                        <button
                          type="button"
                          class="storyboard-ref-thumb"
                          :disabled="!asset.ready"
                          @click.stop="asset.ready && openImageViewer(assetImageSrc({ imageUrl: asset.imageUrl }), `${asset.name} ${asset.type}`)"
                        >
                          <img v-if="asset.ready" :src="thumbOf(assetImageSrc({ imageUrl: asset.imageUrl }))" class="previewable-image" loading="lazy" @error="thumbFallback($event, assetImageSrc({ imageUrl: asset.imageUrl }))" />
                          <span v-else>{{ asset.type === '场景' ? '景' : asset.type === '道具' ? '具' : '角' }}</span>
                        </button>
                        <div class="storyboard-ref-main">
                          <div class="storyboard-ref-line">
                            <span class="storyboard-ref-name">{{ asset.name }}</span>
                            <span :class="['storyboard-ref-state', asset.bound && asset.ready ? 'is-ready' : '']">
                              {{ asset.bound ? (asset.ready ? '可参考' : '未生成') : '未绑定' }}
                            </span>
                          </div>
                          <div class="storyboard-ref-meta">{{ asset.type }} · {{ asset.meta }}</div>
                          <button v-if="asset.bound && !asset.ready" type="button" class="storyboard-ref-goto" @click.stop="prodTab = 'assets'">去生成 →</button>
                        </div>
                      </div>
                    </div>
                  </template>
                  <div v-if="!refBindableAssets.length" class="storyboard-ref-empty">
                    当前集还没有场景、角色或道具，先到「资产」提取素材后即可绑定。
                  </div>
                </div>
              </aside>
            </div>

            <div
              v-if="sbs.length"
              class="panel-resizer panel-resizer-horizontal workbench-height-resizer"
              role="separator"
              aria-label="调整分镜拆分工作区高度"
              tabindex="0"
              title="拖动调整工作区高度，双击恢复默认"
              @pointerdown="startStoryboardWorkbenchHeightResize"
              @keydown="resizeStoryboardWorkbenchHeightByKey"
              @dblclick="resetPanelSize('storyboardWorkbenchHeight')"
            />

            <div v-else-if="rn && rt === 'storyboard_breaker'" class="step-loading">
              <Loader2 :size="24" class="animate-spin" style="color:var(--accent)" />
              <div class="loading-text">正在拆分分镜...</div>
            </div>

            <div v-else class="step-empty video-task-empty-state">
              <div class="empty-visual">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><rect x="2" y="2" width="20" height="20" rx="2.5"/><line x1="7" y1="8" x2="7" y2="16"/><line x1="10" y1="8" x2="10" y2="16"/><line x1="13" y1="8" x2="13" y2="16"/></svg>
              </div>
              <div class="empty-title">开始拆分分镜</div>
              <div class="empty-desc">根据剧本、角色和场景拆分镜头，生成分镜描述和绑定信息。</div>
              <LoadingButton :loading="rt === 'storyboard_breaker'" :disabled="rn && rt !== 'storyboard_breaker'" class="btn btn-primary" spinner-size="13" @click="doBreakdown">
                <template #icon><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg></template>
                开始拆分
              </LoadingButton>
            </div>
          </div>

          <!-- Sub: Videos -->
          <div v-if="prodTab === 'videos'" class="prod-content">
            <div class="prod-section-bar">
              <span class="dim" style="font-size:12px">{{ sbs.length }} 个镜头</span>
              <span class="tag mono">{{ shotVidCount }}/{{ sbs.length }} 已生成</span>
              <div class="ml-auto flex gap-1">
                <LoadingButton :loading="videoPromptBatch.running" :disabled="!sbs.length" class="btn btn-sm" spinner-size="11" @click="batchVideoPrompts">
                  <template #icon><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg></template>
                  {{ videoPromptBatch.running ? `提示词 ${videoPromptBatch.completed}/${videoPromptBatch.total}` : (selectedSbIds.length ? `生成所选提示词(${selectedSbIds.length})` : '批量视频提示词') }}
                </LoadingButton>
                <button class="btn btn-sm" :disabled="!sbs.length" @click="batchVideos">
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
                  批量视频
                </button>
              </div>
            </div>
            <div v-if="!sbs.length" class="step-empty video-task-empty-state">
              <div class="empty-visual">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
              </div>
              <div class="empty-title">先生成分镜</div>
              <div class="empty-desc">视频任务来自分镜拆分结果。先生成分镜描述和视频提示词，再批量生成视频。</div>
              <div class="locked-config-banner">当前集视频模型：{{ lockedVideoConfigLabel }}</div>
              <LoadingButton :loading="rt === 'storyboard_breaker'" :disabled="rn && rt !== 'storyboard_breaker'" class="btn btn-primary" spinner-size="13" @click="prodTab = 'storyboard'; doBreakdown()">
                <template #icon><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg></template>
                AI 生成分镜
              </LoadingButton>
            </div>
            <div
              v-else
              ref="videoWorkbenchEl"
              class="video-task-workbench"
              :class="{ 'has-player': !!selectedSb, 'has-custom-height': panelLayout.videoWorkbenchHeight > 0 }"
              :style="videoWorkbenchStyle"
            >
              <section ref="videoTaskListEl" class="video-task-list">
                <div class="video-task-head">
                <div>
                  <div class="video-task-title">视频任务列表</div>
                  <div class="video-task-meta">按镜头顺序 · {{ videoTaskRows.length }} 个任务</div>
                </div>
                <div class="video-task-metrics">
                  <span class="video-task-metric is-pending">{{ pendingVideoIds.length }} 生成中</span>
                  <span class="video-task-metric is-done">{{ videoTaskDoneCount }} 完成</span>
                  <span class="video-task-metric is-failed">{{ videoTaskFailedCount }} 失败</span>
                </div>
                </div>
                <div class="video-task-table">
                <div
                  v-for="task in videoTaskRows"
                  :key="task.id"
                  :class="['video-task-row', 'is-' + videoTaskState(task.storyboard), { active: selectedSb?.id === task.storyboard.id }]"
                  role="button"
                  tabindex="0"
                  @click="selectedSb = task.storyboard"
                  @keydown.enter.prevent="selectedSb = task.storyboard"
                  @keydown.space.prevent="selectedSb = task.storyboard"
                >
                  <div class="video-task-preview">
                    <video
                      v-if="hasVid(task.storyboard)"
                      :src="'/' + getVideoUrl(task.storyboard)"
                      :poster="posterOf('/' + getVideoUrl(task.storyboard)) || undefined"
                      preload="none"
                      playsinline
                      muted
                      tabindex="-1"
                    />
                    <div v-else class="video-task-empty">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
                    </div>
                    <span class="video-task-index">#{{ String(task.index + 1).padStart(2, '0') }}</span>
                  </div>
                  <div class="video-task-main">
                    <div class="video-task-line">
                      <strong class="video-task-name truncate">{{ task.title }}</strong>
                    </div>
                    <div class="video-task-meta-line">
                      <span v-if="task.meta" class="video-task-loc truncate">{{ task.meta }}</span>
                      <span class="video-task-sep">·</span>
                      <span>{{ task.duration }}s</span>
                      <span class="video-task-sep">·</span>
                      <span>参考 {{ task.referenceCount }}</span>
                    </div>
                    <div v-if="task.error" class="video-task-error">{{ task.error }}</div>
                  </div>
                  <span :class="['video-task-status', 'is-' + videoTaskState(task.storyboard)]">
                    <span :class="['dot', videoTaskState(task.storyboard) === 'done' && 'ok', videoTaskState(task.storyboard) === 'pending' && 'pending']" />
                    {{ videoTaskStatusLabel(task.storyboard) }}
                  </span>
                  <button
                    class="btn btn-sm video-task-action"
                    :disabled="videoTaskState(task.storyboard) === 'pending'"
                    @click.stop="genVid(task.storyboard)"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
                    {{ videoTaskActionLabel(task.storyboard) }}
                  </button>
                </div>
                </div>
              </section>

              <div
                v-if="selectedSb"
                class="panel-resizer panel-resizer-vertical video-column-resizer"
                role="separator"
                aria-label="调整视频任务列表宽度"
                tabindex="0"
                title="拖动调整宽度，双击恢复默认"
                @pointerdown="startVideoTaskListResize"
                @keydown="resizeVideoTaskListByKey"
                @dblclick="resetPanelSize('videoTaskListWidth')"
              />

              <div v-if="selectedSb" ref="videoTaskSideEl" class="video-task-side" :style="videoTaskSideStyle">
              <div ref="videoPreviewStackEl" class="video-task-preview-stack">
              <aside class="video-task-player">
                <div class="video-player-head">
                  <div class="video-player-head-info">
                    <div class="video-player-title">分镜 {{ String(selectedVideoTaskNumber).padStart(2, '0') }}</div>
                    <span :class="['video-task-status', 'is-' + videoTaskState(selectedSb)]">
                      <span :class="['dot', videoTaskState(selectedSb) === 'done' && 'ok', videoTaskState(selectedSb) === 'pending' && 'pending']" />
                      {{ videoTaskStatusLabel(selectedSb) }}
                    </span>
                    <span v-if="selectedSb.duration" class="video-player-sub">{{ selectedSb.duration }}s</span>
                  </div>
                  <button
                    v-if="previewVideoUrl"
                    class="btn btn-sm btn-primary"
                    @click="setAsMainVideo"
                  >
                    设为主视频
                  </button>
                  <a
                    v-if="previewVideoUrl || hasVid(selectedSb)"
                    :href="'/' + (previewVideoUrl || getVideoUrl(selectedSb))"
                    download
                    class="btn btn-sm"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    下载
                  </a>
                </div>
                <div class="video-player-stage">
                  <video
                    v-if="previewVideoUrl || hasVid(selectedSb)"
                    :key="previewVideoUrl || getVideoUrl(selectedSb)"
                    :src="'/' + (previewVideoUrl || getVideoUrl(selectedSb))"
                    :poster="posterOf('/' + (previewVideoUrl || getVideoUrl(selectedSb))) || undefined"
                    controls
                    preload="metadata"
                    playsinline
                    class="video-player-video"
                  />
                  <div v-else class="video-player-empty">
                    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
                    <div class="video-player-empty-title">{{ videoTaskState(selectedSb) === 'pending' ? '视频生成中…' : '尚未生成视频' }}</div>
                    <div class="video-player-empty-desc">{{ videoTaskState(selectedSb) === 'pending' ? '生成完成后可在此播放预览' : '点击下方按钮为当前分镜生成视频' }}</div>
                    <button
                      v-if="videoTaskState(selectedSb) !== 'pending'"
                      class="btn btn-primary btn-sm"
                      style="margin-top:4px"
                      @click="genVid(selectedSb)"
                    >
                      生成视频
                    </button>
                  </div>
                </div>
              </aside>

              <div v-if="sbVideoHistory.length" class="video-player-history">
                <div class="video-player-history-head">
                  <span>历史视频</span>
                  <span class="video-player-history-count">{{ sbVideoHistory.length }}</span>
                </div>
                <!-- 有数据时刷新失败：非破坏性错误条，保留旧列表 -->
                <div v-if="sbVideoHistoryError" class="video-history-error-row">
                  <span class="tag tag-error">历史记录刷新失败</span>
                  <span class="dim" style="font-size:11px">{{ sbVideoHistoryError }}</span>
                  <button class="btn btn-sm ml-auto" @click="loadSbVideoHistory"><RefreshCw :size="11" /> 重试</button>
                </div>
                <div class="video-player-history-list">
                  <div
                    v-for="t in sbVideoHistory"
                    :key="t.id"
                    :class="['video-history-item', { current: isCurrentVideo(t), viewing: !!previewVideoUrl && previewVideoUrl === taskVideoPath(t) }]"
                    role="button"
                    tabindex="0"
                    @click="previewHistoryVideo(t)"
                    @keydown.enter.prevent="previewHistoryVideo(t)"
                  >
                    <video :src="'/' + taskVideoPath(t)" :poster="posterOf('/' + taskVideoPath(t)) || undefined" preload="none" muted playsinline tabindex="-1" />
                    <span class="video-history-time">{{ formatHistoryTime(taskCreatedAt(t)) }}</span>
                    <span v-if="isCurrentVideo(t)" class="video-history-badge">当前</span>
                    <button v-else type="button" class="video-history-del" title="删除该记录" @click.stop="removeHistoryVideo(t)">×</button>
                  </div>
                </div>
              </div>
              <div v-else-if="sbVideoHistoryError" class="video-player-history video-history-error">
                <div class="video-player-history-head">
                  <span>历史视频</span>
                </div>
                <div class="video-history-error-row">
                  <span class="tag tag-error">历史记录加载失败</span>
                  <span class="dim" style="font-size:11px">{{ sbVideoHistoryError }}</span>
                  <button class="btn btn-sm ml-auto" @click="loadSbVideoHistory"><RefreshCw :size="11" /> 重试</button>
                </div>
              </div>
              </div>

              <div
                class="panel-resizer panel-resizer-horizontal video-row-resizer"
                role="separator"
                aria-label="调整视频预览与提示词区域高度"
                tabindex="0"
                title="拖动调整高度，双击恢复默认"
                @pointerdown="startVideoPreviewHeightResize"
                @keydown="resizeVideoPreviewHeightByKey"
                @dblclick="resetPanelSize('videoPreviewHeight')"
              />

              <aside class="video-task-inspector">
                <div class="video-inspector-body">
                  <section class="video-inspector-section">
                    <div class="video-inspector-prompt-head">
                      <span class="video-inspector-label video-inspector-label-hero">视频提示词</span>
                      <LoadingButton
                        :loading="videoPromptGeneratingIds.includes(selectedSb?.id)"
                        :disabled="videoPromptBatch.running"
                        type="button"
                        class="btn btn-sm"
                        spinner-size="11"
                        @click="genVideoPrompt(selectedSb)"
                      >
                        {{ (selectedSb.video_prompt || selectedSb.videoPrompt) ? '重新生成' : 'AI 生成' }}
                      </LoadingButton>
                    </div>
                    <MentionTextarea
                      :model-value="selectedSb.video_prompt || selectedSb.videoPrompt || ''"
                      :options="mentionOptions"
                      :rows="9"
                      input-class="textarea video-inspector-prompt"
                      placeholder="用 @角色名 / @场景名 / @道具名 引用参考素材，生成时自动映射为参考图片；再按时间段描述画面运动与镜头…"
                      @commit="v => updateField(selectedSb, 'video_prompt', v)"
                    />
                  </section>

                  <section class="video-inspector-section video-inspector-h3-section">
                    <div class="video-inspector-prompt-head">
                      <div>
                        <span class="video-inspector-label video-inspector-label-hero">MiniMax H3 大模型提示词</span>
                        <div class="video-inspector-hint">按实际参考素材自动选择 T2VA / I2VA / Ref2VA</div>
                      </div>
                      <LoadingButton
                        :loading="minimaxH3PromptGeneratingIds.includes(selectedSb?.id)"
                        type="button"
                        class="btn btn-sm"
                        spinner-size="11"
                        @click="genMinimaxH3Prompt(selectedSb)"
                      >
                        MiniMax H3 提示词
                      </LoadingButton>
                    </div>
                    <textarea
                      :value="selectedSb.minimax_h3_prompt || selectedSb.minimaxH3Prompt || ''"
                      class="textarea video-inspector-prompt video-inspector-h3-prompt"
                      rows="12"
                      placeholder="先准备中文版视频提示词，再点击上方按钮生成 H3 专用提示词…"
                      @blur="updateField(selectedSb, 'minimax_h3_prompt', $event.target.value)"
                    />
                    <div v-if="['autodl', 'minimax'].includes(selectedVideoProvider) && (selectedSb.minimax_h3_prompt || selectedSb.minimaxH3Prompt)" class="video-inspector-h3-active">
                      当前视频生成将优先使用这份 H3 提示词
                    </div>
                    <div v-if="(selectedSb.minimax_h3_prompt || selectedSb.minimaxH3Prompt) && !selectedSb.minimax_h3_source_hash" class="video-inspector-h3-stale">
                      H3 提示词可能已过期：分镜内容或参考素材发生变化，请重新生成
                    </div>
                  </section>

                  <section class="video-inspector-section">
                    <div class="video-inspector-prompt-head">
                      <div>
                        <span class="video-inspector-label">已继承的分镜素材</span>
                        <div class="video-inspector-hint">角色、场景和道具在「分镜拆分」中维护，此处只读继承</div>
                      </div>
                      <button type="button" class="btn btn-sm" @click="prodTab = 'storyboard'">管理分镜绑定</button>
                    </div>
                    <div class="video-inspector-assets">
                      <button
                        v-for="asset in getShotReferenceAssets(selectedSb)"
                        :key="asset.key"
                        type="button"
                        class="video-inspector-asset"
                        :disabled="!asset.ready"
                        @click="asset.ready && openImageViewer(assetImageSrc({ imageUrl: asset.imageUrl }), `${asset.name} ${asset.type}`)"
                      >
                        <img v-if="asset.ready" :src="thumbOf(assetImageSrc({ imageUrl: asset.imageUrl }))" :alt="asset.name" loading="lazy" @error="thumbFallback($event, assetImageSrc({ imageUrl: asset.imageUrl }))" />
                        <span v-else>{{ asset.type }}</span>
                        <small>{{ asset.name }}</small>
                      </button>
                      <div v-if="!getShotReferenceAssets(selectedSb).length" class="video-inspector-empty">当前分镜未绑定参考素材</div>
                    </div>
                  </section>

                  <section class="video-inspector-section">
                    <span class="video-inspector-label">额外投产参考</span>
                    <div class="video-inspector-hint">仅用于本次视频任务，不会修改分镜的正式角色、场景或道具绑定</div>
                    <div v-if="videoRefImageUrls.length || videoRefVideoUrls.length || videoRefAudioUrls.length" class="video-ref-media-list">
                      <span v-for="(url, i) in videoRefImageUrls" :key="'ref-i-' + i" class="video-ref-media-chip">
                        图片 {{ i + 1 }}
                        <button type="button" class="video-ref-media-remove" @click="removeRefMedia('image', i)">×</button>
                      </span>
                      <span v-for="(url, i) in videoRefVideoUrls" :key="'ref-v-' + i" class="video-ref-media-chip">
                        视频 {{ i + 1 }}
                        <button type="button" class="video-ref-media-remove" @click="removeRefMedia('video', i)">×</button>
                      </span>
                      <span v-for="(url, i) in videoRefAudioUrls" :key="'ref-a-' + i" class="video-ref-media-chip">
                        音频 {{ i + 1 }}
                        <button type="button" class="video-ref-media-remove" @click="removeRefMedia('audio', i)">×</button>
                      </span>
                    </div>
                    <div class="video-ref-media-actions">
                      <div class="video-ref-action-group">
                        <span>图片 {{ refImageUsedCount }}/9</span>
                        <button type="button" class="btn btn-sm" :disabled="uploadingRefMedia || refImageFull" @click="uploadRefMedia('image')">本地上传</button>
                        <button type="button" class="btn btn-sm" :disabled="refImageFull" @click="openRefAssetPicker('image')">从资产库选择</button>
                      </div>
                      <div class="video-ref-action-group">
                        <span>视频 {{ videoRefVideoUrls.length }}/3</span>
                        <button type="button" class="btn btn-sm" :disabled="uploadingRefMedia || videoRefVideoUrls.length >= 3" @click="uploadRefMedia('video')">本地上传</button>
                        <button type="button" class="btn btn-sm" :disabled="videoRefVideoUrls.length >= 3" @click="openRefAssetPicker('video')">从资产库选择</button>
                      </div>
                      <div class="video-ref-action-group">
                        <span>音频 {{ videoRefAudioUrls.length }}/3</span>
                        <button type="button" class="btn btn-sm" :disabled="uploadingRefMedia || videoRefAudioUrls.length >= 3" @click="uploadRefMedia('audio')">本地上传</button>
                        <button type="button" class="btn btn-sm" :disabled="videoRefAudioUrls.length >= 3" @click="openRefAssetPicker('audio')">从资产库选择</button>
                      </div>
                    </div>
                    <div v-if="selectedVideoProvider === 'autodl' && videoRefVideoUrls.length" class="video-ref-media-hint">
                      当前 AutoDL H3 工作流不接收参考视频；这些视频可在切换到 Seedance 等支持视频参考的模型后使用。
                    </div>
                    <div
                      v-if="videoRefAudioUrls.length && !getShotReferenceImages(selectedSb).length && !videoRefVideoUrls.length"
                      class="video-ref-media-hint"
                    >参考音频需至少 1 个参考图片或视频</div>
                  </section>

                  <section class="video-inspector-section">
                    <span class="video-inspector-label">生成参数</span>
                    <div class="video-param-row">
                      <span class="video-param-name">生成时长</span>
                      <span class="video-param-control">
                        <input v-model.number="videoDuration" type="number" min="4" max="15" class="input video-duration-input" />
                        <span class="video-param-unit">s（4-15）</span>
                      </span>
                    </div>
                  </section>

                  <button
                    class="btn btn-primary video-inspector-action"
                    :disabled="videoTaskState(selectedSb) === 'pending'"
                    @click="genVid(selectedSb)"
                  >
                    {{ videoTaskActionLabel(selectedSb) }}
                  </button>
                </div>
              </aside>
              </div>
            </div>
            <div
              v-if="sbs.length"
              class="panel-resizer panel-resizer-horizontal workbench-height-resizer"
              role="separator"
              aria-label="调整视频任务工作区高度"
              tabindex="0"
              title="拖动调整工作区高度，双击恢复默认"
              @pointerdown="startVideoWorkbenchHeightResize"
              @keydown="resizeVideoWorkbenchHeightByKey"
              @dblclick="resetPanelSize('videoWorkbenchHeight')"
            />
          </div>

          <!-- Production Navigator -->
        </template>
      </div>

      <!-- ===== EXPORT PANEL ===== -->
      <div v-else class="content-panel">
        <div v-if="!sbs.length" class="step-empty" style="flex:1">
          <div class="empty-visual">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          </div>
          <div class="empty-title">尚未准备就绪</div>
          <div class="empty-desc">请先完成分镜和制作流程</div>
          <button class="btn btn-primary" @click="panel = 'script'">前往剧本</button>
        </div>
        <!-- P2-B2：拼接导出面板下沉 EpisodeExportPanel（成片列表三态与勾选交互在组件内；
             拼接发起与轮询仍主壳持有——mergeData 供顶栏/侧栏/阶段进度读取；
             勾选集合为页面级受控状态 selected-ids，切面板不丢选择，自动全选由主壳 watch sbs 承担） -->
        <EpisodeExportPanel
          v-else
          :sbs="sbs"
          :episode-id="epId"
          :selected-ids="exportSelectedIds"
          :merge-error="mergeError"
          :list-rev="exportListRev"
          @merge="doMerge"
          @retry-merge="doMerge(lastMergeIds)"
          @clear-merge-error="mergeError = ''"
          @preview-merge="activeMerge = $event"
          @update:selected-ids="onExportSelectedChange"
        />
      </div>

      <!-- ===== TASK DRAWER ===== -->
      <!-- P2-B1 batch3：抽屉骨架收敛至 AppDrawer；Esc 关闭沿用页面 handleImageViewerKeydown
           优先级协议（imageViewer → assetDetail → taskDrawer），故组件内 Esc 置否 -->
      <AppDrawer
        v-if="taskDrawer"
        width="min(560px, 100vw)"
        aria-label="生成任务列表"
        :esc-close="false"
        @close="closeTaskDrawer"
      >
        <template #head>
          <div>
            <div class="video-task-title">生成任务列表</div>
            <div class="video-task-meta">按创建时间倒序 · {{ genTaskRows.length }} 个任务</div>
          </div>
          <div class="task-drawer-head-actions">
            <button class="btn btn-sm" @click="loadGenTasks(true)">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>
              刷新
            </button>
            <button class="btn btn-ghost btn-icon" @click="closeTaskDrawer"><X :size="14" /></button>
          </div>
        </template>
        <div class="video-task-metrics task-drawer-metrics">
          <span class="video-task-metric is-pending">{{ genTaskActiveCount }} 生成中</span>
          <span class="video-task-metric is-done">{{ genTaskDoneCount }} 完成</span>
          <span class="video-task-metric is-failed">{{ genTaskFailedCount }} 失败</span>
        </div>
        <!-- 任务列表加载失败：内联错误 + 重试（区分「加载失败」与「真无任务」） -->
        <div v-if="taskListError" class="task-drawer-body">
          <div class="app-state app-state-error compact-state">
            <div class="app-state-icon"><CircleAlert :size="20" /></div>
            <div class="app-state-title">任务列表加载失败</div>
            <p class="app-state-desc">{{ taskListError }}</p>
            <button class="btn btn-primary btn-sm" @click="loadGenTasks(true)"><RefreshCw :size="12" /> 重试</button>
          </div>
        </div>
        <div v-else-if="taskListLoading && !genTaskRows.length" class="task-drawer-body task-drawer-skeleton">
          <div class="app-skeleton-line" style="height:72px;border-radius:12px"></div>
          <div class="app-skeleton-line" style="height:72px;border-radius:12px;margin-top:10px"></div>
          <div class="app-skeleton-line" style="height:72px;border-radius:12px;margin-top:10px"></div>
        </div>
        <div v-else-if="!genTaskRows.length" class="step-empty task-drawer-empty">
          <div class="empty-visual">
            <ListTodo :size="32" />
          </div>
          <div class="empty-title">暂无生成任务</div>
          <div class="empty-desc">在资产、分镜或视频步骤中触发图片 / 视频生成后,任务会自动出现在这里。</div>
        </div>
        <div v-else class="video-task-table task-drawer-body">
          <div
            v-for="row in genTaskRows"
            :key="row.key"
            :class="['video-task-row', 'gen-task-row', 'is-' + genTaskStateClass(row.status)]"
          >
            <div class="video-task-preview">
              <video
                v-if="row.previewUrl && (row.kind === 'video' || row.kind === 'merge')"
                :src="genTaskPreviewSrc(row.previewUrl)"
                :poster="posterOf(genTaskPreviewSrc(row.previewUrl)) || undefined"
                controls
                preload="none"
                playsinline
              />
              <img
                v-else-if="row.previewUrl"
                :src="thumbOf(genTaskPreviewSrc(row.previewUrl))"
                :alt="row.targetLabel"
                loading="lazy"
                @error="thumbFallback($event, genTaskPreviewSrc(row.previewUrl))"
                @click="openImageViewer(genTaskPreviewSrc(row.previewUrl), row.targetLabel)"
              />
              <div v-else class="video-task-empty">
                <Loader2 v-if="genTaskStateClass(row.status) === 'pending'" :size="18" class="animate-spin" />
                <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
              </div>
              <span class="video-task-index">{{ genTaskKindLabel(row.kind) }}</span>
            </div>
            <div class="video-task-main">
              <div class="video-task-line">
                <strong class="video-task-name truncate">{{ row.targetLabel }}</strong>
              </div>
              <div class="video-task-meta-line">
                <span class="video-task-loc truncate">{{ row.provider }}{{ row.model ? ' · ' + row.model : '' }}</span>
                <template v-if="genTaskDuration(row)">
                  <span class="video-task-sep">·</span>
                  <span>耗时 {{ genTaskDuration(row) }}</span>
                </template>
                <span class="video-task-sep">·</span>
                <span>#{{ row.id }}</span>
              </div>
              <div v-if="row.errorMsg" class="video-task-error">{{ row.errorMsg }}</div>
            </div>
            <span :class="['video-task-status', 'is-' + genTaskStateClass(row.status)]">
              <span :class="['dot', genTaskStateClass(row.status) === 'done' && 'ok', genTaskStateClass(row.status) === 'pending' && 'pending']" />
              {{ genTaskStatusLabel(row.status) }}
            </span>
          </div>
        </div>
      </AppDrawer>

      <div v-if="showBottomBubble" class="step-bubble">
        <button
          v-if="panel === 'script'"
          class="bubble-btn"
          :disabled="scriptStep === 0"
          @click="goPrevStep"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
          </svg>
          {{ prevStepLabel || '上一步' }}
        </button>
        <button
          v-else-if="panel === 'production'"
          class="bubble-btn"
          :disabled="prodTabIdx === 0"
          @click="prodTabIdx = Math.max(0, prodTabIdx - 1)"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
          </svg>
          {{ prodTabDefs[Math.max(0, prodTabIdx - 1)]?.label || '上一步' }}
        </button>

        <div class="bubble-dots">
          <button
            v-for="step in bubbleSteps"
            :key="step.key"
            :class="['bubble-dot', { current: step.key === activeBubbleKey }]"
            @click="goSubStep(step.key)"
            :title="step.label"
          ></button>
        </div>

        <button
          v-if="panel === 'script'"
          class="bubble-btn primary"
          :disabled="!canGoNext"
          @click="goNextStep"
        >
          {{ nextStepLabel || '下一步' }}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
          </svg>
        </button>
        <button
          v-else-if="panel === 'production'"
          class="bubble-btn primary"
          :disabled="prodTab === 'videos' && !canExport"
          @click="goNextProd"
        >
          {{ prodTabIdx < prodTabDefs.length - 1 ? (prodTabDefs[prodTabIdx + 1]?.label || '下一步') : '进入导出' }}
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
          </svg>
        </button>
      </div>

      <div v-if="assetDetail.open && assetDetail.item" class="overlay asset-detail-overlay" @click.self="closeAssetDetail">
        <section
          class="dialog asset-detail-dialog"
          role="dialog"
          aria-modal="true"
          :aria-label="(assetDetail.type === 'character' ? '角色' : assetDetail.type === 'scene' ? '场景' : '道具') + '详情'"
        >
          <header class="dialog-head asset-detail-head">
            <div class="asset-detail-title-block">
              <span class="asset-detail-kicker">{{ assetTypeLabel(assetDetail.type) }}</span>
              <h2 class="asset-detail-title">{{ assetDetailTitle(assetDetail) }}</h2>
            </div>
            <div class="asset-detail-head-actions">
              <span class="tag" v-if="assetDetail.type === 'character'">{{ assetDetail.item.role || '角色' }}</span>
              <span class="tag" v-else-if="assetDetail.type === 'prop'">{{ assetDetail.item.type || '道具' }}</span>
              <span class="tag" v-else>{{ assetDetail.item.time || '未设时间' }}</span>
              <button class="btn btn-ghost btn-icon" @click="closeAssetDetail">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </header>

          <div class="dialog-body asset-detail-body">
            <div class="asset-detail-shell">
              <aside class="asset-detail-preview-panel">
                <div class="asset-detail-section-title">
                  <span>视觉预览</span>
                  <StatusBadge :state="assetImageSrc(assetDetail.item) ? 'ready' : ''">
                    {{ assetImageSrc(assetDetail.item) ? '已生成' : '待生成' }}
                  </StatusBadge>
                </div>

                <button
                  type="button"
                  class="asset-detail-media-frame"
                  :disabled="!assetImageSrc(assetDetail.item)"
                  @click.stop="openImageViewer(assetImageSrc(assetDetail.item), `${assetDetailTitle(assetDetail)} ${assetDetail.type === 'character' ? '角色形象' : assetDetail.type === 'scene' ? '场景图' : '道具图'}`)"
                >
                  <img
                    v-if="assetImageSrc(assetDetail.item)"
                    :src="thumbOf(assetImageSrc(assetDetail.item))"
                    class="previewable-image"
                    @error="thumbFallback($event, assetImageSrc(assetDetail.item))"
                  />
                  <span v-else class="asset-detail-media-empty">
                    <svg v-if="assetDetail.type === 'character'" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    <svg v-else-if="assetDetail.type === 'prop'" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
                    <svg v-else width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  </span>
                </button>

                <div class="asset-detail-meta-row">
                  <div class="asset-detail-meta-item">
                    <span>类型</span>
                    <strong>{{ assetDetail.type === 'character' ? '角色形象' : assetDetail.type === 'prop' ? '道具' : '场景图片' }}</strong>
                  </div>
                  <div class="asset-detail-meta-item">
                    <span>{{ assetDetail.type === 'character' ? '定位' : assetDetail.type === 'prop' ? '道具类型' : '时间' }}</span>
                    <strong>{{ assetDetail.type === 'character' ? (assetDetail.item.role || '角色') : assetDetail.type === 'prop' ? (assetDetail.item.type || '道具') : (assetDetail.item.time || '未设时间') }}</strong>
                  </div>
                </div>
              </aside>

              <section class="asset-detail-editor-panel">
                <div class="asset-detail-section-title">
                  <span>编辑信息</span>
                  <span class="dim">{{ assetDetail.type === 'character' ? '样貌与妆造会影响角色形象' : assetDetail.type === 'prop' ? '物品外貌会影响道具图' : '空间与光影会影响场景图' }}</span>
                </div>

                <div v-if="assetDetail.type === 'prop'" class="asset-detail-edit-grid asset-detail-edit-grid--prop">
                  <label class="asset-detail-edit-field">
                    <span>物品外貌</span>
                    <textarea
                      v-model="assetDetailDraft.description"
                      class="textarea asset-detail-textarea"
                      rows="6"
                      placeholder="材质、颜色、形状、大小、新旧程度、磨损痕迹等"
                    />
                  </label>
                </div>

                <div v-else :class="['asset-detail-edit-grid', `asset-detail-edit-grid--${assetDetail.type}`]">
                  <label v-if="assetDetail.type === 'character'" class="asset-detail-edit-field">
                    <span>样貌</span>
                    <textarea
                      v-model="assetDetailDraft.appearance"
                      class="textarea asset-detail-textarea"
                      rows="6"
                      placeholder="年龄感、五官、体态、气质等"
                    />
                  </label>
                  <label v-if="assetDetail.type === 'character'" class="asset-detail-edit-field">
                    <span>妆造</span>
                    <textarea
                      v-model="assetDetailDraft.styling"
                      class="textarea asset-detail-textarea"
                      rows="6"
                      placeholder="发型、服装、妆面、配饰等"
                    />
                  </label>
                  <label v-if="assetDetail.type === 'scene'" class="asset-detail-edit-field">
                    <span>场景描述</span>
                    <textarea
                      v-model="assetDetailDraft.prompt"
                      class="textarea asset-detail-textarea"
                      rows="5"
                      placeholder="空间、陈设、年代质感、关键视觉元素等"
                    />
                  </label>
                  <label v-if="assetDetail.type === 'scene'" class="asset-detail-edit-field">
                    <span>场景光影</span>
                    <textarea
                      v-model="assetDetailDraft.lighting"
                      class="textarea asset-detail-textarea"
                      rows="5"
                      placeholder="光源、色调、明暗、氛围等"
                    />
                  </label>
                </div>

              </section>
            </div>

            <section class="asset-detail-prompt-panel">
              <div class="asset-detail-section-title">
                <span>{{ assetDetail.type === 'character' ? '最终提示词 · 三视图' : assetDetail.type === 'scene' ? '最终提示词 · 固定视角' : '最终提示词 · 白底单品' }}</span>
                <div class="asset-detail-prompt-head-actions">
                  <LoadingButton
                    :loading="isGeneratingPrompt(assetDetail.type, assetDetail.item.id)"
                    :disabled="isAssetImagePending(assetDetail.type, assetDetail.item.id)"
                    class="btn btn-sm"
                    spinner-size="11"
                    @click="genAssetFinalPrompt"
                  >
                    {{ isGeneratingPrompt(assetDetail.type, assetDetail.item.id) ? '生成中' : (assetFinalPrompt ? '重新生成' : '生成提示词') }}
                  </LoadingButton>
                  <StatusBadge :state="assetFinalPrompt ? 'ready' : ''">
                    {{ assetFinalPrompt ? '已生成' : '待生成' }}
                  </StatusBadge>
                  <button
                    v-if="assetPromptDraft"
                    class="btn btn-ghost btn-sm asset-detail-copy-btn"
                    @click="copyAssetFinalPrompt"
                  >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
                    复制
                  </button>
                </div>
              </div>
              <textarea
                :value="assetPromptDraft"
                @input="onAssetPromptInput"
                class="textarea asset-detail-prompt-textarea"
                rows="5"
                :placeholder="assetDetail.type === 'character'
                  ? '可手动编写三视图最终提示词，或点击「生成提示词」由 Agent 生成'
                  : assetDetail.type === 'scene'
                    ? '可手动编写固定视角最终提示词，或点击「生成提示词」由 Agent 生成'
                    : '可手动编写白底单品最终提示词，或点击「生成提示词」由 Agent 生成'"
              />
              <p class="asset-detail-prompt-hint">
                {{ assetDetail.type === 'character'
                  ? '提示词可直接编辑，保存后生效；修改样貌或妆造并保存后，最终提示词将被清空，下次生成形象时由提示词 Agent 重新生成。'
                  : assetDetail.type === 'scene'
                    ? '提示词可直接编辑，保存后生效；修改场景描述或光影并保存后，最终提示词将被清空，下次生成场景图时由提示词 Agent 重新生成。'
                    : '提示词可直接编辑，保存后生效；修改物品外貌并保存后，最终提示词将被清空，下次生成道具图时由提示词 Agent 重新生成。' }}
              </p>
            </section>
          </div>

          <footer class="dialog-foot asset-detail-foot">
            <div class="asset-detail-secondary-actions">
              <button class="btn btn-danger" @click="askDeleteAsset(assetDetail.type, assetDetail.item)">删除</button>
              <button class="btn" @click="closeAssetDetail">关闭</button>
            </div>
            <div class="asset-detail-primary-actions">
              <LoadingButton
                :loading="isUploadingAsset(assetDetail.type, assetDetail.item.id)"
                class="btn"
                spinner-size="11"
                @click="uploadAssetImage(assetDetail.type, assetDetail.item.id)"
              >
                <template #icon><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg></template>
                上传图片
              </LoadingButton>
              <button
                v-if="assetDetail.type === 'character'"
                class="btn"
                :disabled="isPendingCharImage(assetDetail.item.id)"
                @click="genCharImg(assetDetail.item.id)"
              >
                {{ assetImageSrc(assetDetail.item) ? '重绘形象' : (isPendingCharImage(assetDetail.item.id) ? '生成中' : '生成形象') }}
              </button>
              <button
                v-else-if="assetDetail.type === 'scene'"
                class="btn"
                :disabled="isPendingSceneImage(assetDetail.item.id)"
                @click="genSceneImg(assetDetail.item.id)"
              >
                {{ assetImageSrc(assetDetail.item) ? '重绘场景' : (isPendingSceneImage(assetDetail.item.id) ? '生成中' : '生成场景') }}
              </button>
              <button
                v-else-if="assetDetail.type === 'prop'"
                class="btn"
                :disabled="isPendingPropImage(assetDetail.item.id)"
                @click="genPropImg(assetDetail.item.id)"
              >
                {{ assetImageSrc(assetDetail.item) ? '重绘道具图' : (isPendingPropImage(assetDetail.item.id) ? '生成中' : '生成道具图') }}
              </button>
              <LoadingButton :loading="savingAssetDetail" class="btn btn-primary" spinner-size="12" @click="saveAssetDetail">
                保存修改
              </LoadingButton>
            </div>
          </footer>
        </section>
      </div>

      <AppDialog
        v-if="refAssetPicker.open"
        class="ref-asset-picker-overlay"
        width="min(920px, calc(100vw - 48px))"
        :dialog-style="{ maxHeight: 'min(760px, calc(100vh - 48px))' }"
        @close="closeRefAssetPicker"
      >
        <template #head>
          <div>
            <h2 class="dialog-title">选择参考{{ refAssetKindLabel }}</h2>
            <p class="ref-asset-picker-sub">可选择本剧已有资产，也可复用之前从本地上传并保存到素材库的文件。</p>
          </div>
          <button class="btn btn-ghost btn-icon" @click="closeRefAssetPicker"><X :size="14" /></button>
        </template>
        <div class="ref-asset-picker-body">
          <div v-if="refAssetPickerLoading" class="ref-asset-picker-empty"><Loader2 :size="18" class="animate-spin" /> 正在加载素材库</div>
          <div v-else-if="refAssetLibraryError" class="app-state app-state-error compact-state">
            <div class="app-state-icon"><CircleAlert :size="20" /></div>
            <div class="app-state-title">素材库加载失败</div>
            <p class="app-state-desc">{{ refAssetLibraryError }}</p>
            <button class="btn btn-primary btn-sm" @click="loadRefAssetLibrary"><RefreshCw :size="12" /> 重试</button>
          </div>
          <div v-else-if="refAssetCandidates.length" class="ref-asset-picker-grid">
            <button
              v-for="asset in refAssetCandidates"
              :key="asset.key"
              type="button"
              :class="['ref-asset-card', { selected: isRefAssetSelected(asset), locked: isAutoBoundImageAsset(asset) }]"
              @click="toggleRefAsset(asset)"
            >
              <img v-if="asset.kind === 'image'" :src="asset.thumbnail || asset.url" :alt="asset.name" loading="lazy" />
              <video v-else-if="asset.kind === 'video'" :src="asset.url" preload="metadata" muted playsinline />
              <div v-else class="ref-asset-audio-preview">♫</div>
              <span class="ref-asset-card-check">{{ isAutoBoundImageAsset(asset) ? '已绑定' : isRefAssetSelected(asset) ? '已选' : '选择' }}</span>
              <strong>{{ asset.name }}</strong>
              <small>{{ asset.source }}</small>
            </button>
          </div>
          <div v-else class="ref-asset-picker-empty">素材库里还没有{{ refAssetKindLabel }}，请先使用“本地上传”。</div>
        </div>
        <template #foot>
          <span class="dim">已选 {{ selectedRefAssetCount }} 个</span>
          <button class="btn btn-primary" @click="closeRefAssetPicker">完成</button>
        </template>
      </AppDialog>

      <div v-if="imageViewer.open && imageViewer.src" class="overlay image-viewer-overlay" @click.self="closeImageViewer">
        <div class="dialog image-viewer-dialog">
          <div class="image-viewer-head">
            <div class="image-viewer-title">{{ imageViewer.title || '图片预览' }}</div>
            <button class="btn btn-ghost btn-icon" @click="closeImageViewer">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <div class="image-viewer-body">
            <img :src="imageViewer.src" :alt="imageViewer.title || '图片预览'" class="image-viewer-img" />
          </div>
        </div>
      </div>

      <div v-if="activeMerge" class="overlay image-viewer-overlay" @click.self="activeMerge = null">
        <div class="dialog image-viewer-dialog merge-viewer-dialog">
          <div class="image-viewer-head">
            <div class="image-viewer-title">成片预览</div>
            <span class="dim" style="font-size:11px">{{ formatHistoryTime(activeMerge.created_at) }}<template v-if="activeMerge.duration"> · {{ activeMerge.duration }}s</template></span>
            <a :href="'/' + activeMerge.merged_url" download class="btn btn-sm" style="margin-left:auto">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              下载成片
            </a>
            <button class="btn btn-ghost btn-icon" @click="activeMerge = null">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <div class="merge-viewer-body">
            <video
              :key="activeMerge.id"
              :src="'/' + activeMerge.merged_url"
              controls
              autoplay
              playsinline
              class="merge-viewer-video"
            />
          </div>
        </div>
      </div>

      <AppDialog
        v-if="assetCreate.open"
        width="440px"
        :dialog-style="{ maxWidth: 'calc(100vw - 48px)' }"
        @close="assetCreate.open = false"
      >
        <template #head>
          <h2 class="dialog-title">新增{{ assetCreateTypeLabel }}</h2>
          <button class="btn btn-ghost btn-icon" @click="assetCreate.open = false">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </template>
        <div class="asset-create-body">
          <template v-if="assetCreate.type === 'character'">
            <label class="field"><span class="field-label">名称</span><input v-model="assetCreateDraft.name" class="input" placeholder="角色名称" /></label>
            <label class="field"><span class="field-label">角色定位</span><input v-model="assetCreateDraft.role" class="input" placeholder="如：主角 / 反派 / 配角" /></label>
            <label class="field"><span class="field-label">样貌</span><textarea v-model="assetCreateDraft.appearance" class="textarea" rows="3" placeholder="外貌特征（可融入性格）" /></label>
            <label class="field"><span class="field-label">妆造</span><textarea v-model="assetCreateDraft.styling" class="textarea" rows="2" placeholder="服装、妆容、配饰" /></label>
          </template>
          <template v-else-if="assetCreate.type === 'scene'">
            <label class="field"><span class="field-label">地点</span><input v-model="assetCreateDraft.location" class="input" placeholder="场景地点" /></label>
            <label class="field"><span class="field-label">时间</span><input v-model="assetCreateDraft.time" class="input" placeholder="如：白天 / 夜晚" /></label>
            <label class="field"><span class="field-label">场景描述</span><textarea v-model="assetCreateDraft.prompt" class="textarea" rows="3" placeholder="环境、陈设、氛围" /></label>
            <label class="field"><span class="field-label">场景光影</span><input v-model="assetCreateDraft.lighting" class="input" placeholder="如：黄昏暖光、冷清顶光" /></label>
          </template>
          <template v-else>
            <label class="field"><span class="field-label">名称</span><input v-model="assetCreateDraft.name" class="input" placeholder="道具名称" /></label>
            <label class="field"><span class="field-label">类型</span><input v-model="assetCreateDraft.type" class="input" placeholder="如：武器 / 信物 / 文件" /></label>
            <label class="field"><span class="field-label">物品外貌</span><textarea v-model="assetCreateDraft.description" class="textarea" rows="3" placeholder="只描述物品的外观，与其他无关" /></label>
          </template>
        </div>
        <template #foot>
          <button class="btn" @click="assetCreate.open = false">取消</button>
          <LoadingButton :loading="assetCreate.saving" class="btn btn-primary" spinner-size="12" @click="saveAssetCreate">
            新增
          </LoadingButton>
        </template>
      </AppDialog>

      <ConfirmDialog
        :open="assetDelete.open"
        :title="`删除${assetDeleteTypeLabel}`"
        :message="`确定删除${assetDeleteTypeLabel}「${assetDeleteName}」吗？将从本剧所有集中移除。`"
        :loading="assetDelete.loading"
        @confirm="confirmDeleteAsset"
        @cancel="assetDelete.open = false"
      />
    </main>
    </div>
  </div>
</template>

<script setup>
import { toast } from 'vue-sonner'
import { nextTick } from 'vue'
import {
  Users, Video, FileText, FolderKanban, Clapperboard, Download, Loader2,
  MapPin, Play, Plus, X, ListTodo, RefreshCw, CircleAlert,
} from 'lucide-vue-next'
import { api, dramaAPI, episodeAPI, storyboardAPI, characterAPI, sceneAPI, propAPI, taskAPI, mergeAPI, aiConfigAPI, uploadAPI, assetLibraryAPI } from '~/composables/useApi'
import AppDialog from '~/components/AppDialog.vue'
import AppDrawer from '~/components/AppDrawer.vue'
import StatusBadge from '~/components/StatusBadge.vue'
import LoadingButton from '~/components/LoadingButton.vue'
import EpisodeExportPanel from '~/components/EpisodeExportPanel.vue'
import { useAgent } from '~/composables/useAgent'

definePageMeta({ layout: 'studio' })

const route = useRoute()
const dramaId = Number(route.params.id)
const episodeNumber = Number(route.params.episodeNumber)

const drama = ref(null), episode = ref(null), chars = ref([]), scenes = ref([]), propItems = ref([]), sbs = ref([]), mergeData = ref(null)
// 角色/场景/道具子资源加载错误（R1：失败保留旧值并内联呈现，禁止静默置空回落「开始提取资产」空态）
const assetsLoadError = ref('')
const pageLoading = ref(false)
const pageLoadError = ref('')
// 工作台面板位置记忆（按剧集隔离）：仅页面刷新(reload)时恢复到上次所在步骤；
// 从列表/详情页点击进入时始终默认「剧本」面板
const PANEL_STORE_KEY = `huobao:workbench:panel:${dramaId}:${episodeNumber}`
const isPageReload = (() => {
  try { return performance.getEntriesByType('navigation')[0]?.type === 'reload' } catch { return false }
})()
const storedPanel = (() => {
  if (!isPageReload) return null
  try { return JSON.parse(localStorage.getItem(PANEL_STORE_KEY) || 'null') } catch { return null }
})()
// 首个 refresh 时若已恢复面板位置，跳过按内容自动重置 scriptStep
let panelRestored = !!storedPanel
const panel = ref(['production', 'export'].includes(storedPanel?.panel) ? storedPanel.panel : 'script')
const { running: rn, runningType: rt, run: runAgent } = useAgent()

// ===== 可拖拽工作台布局 =====
// 尺寸偏好跨项目复用；0 表示使用响应式默认值。拖动后自动记忆，双击分隔线恢复默认。
const PANEL_LAYOUT_STORE_KEY = 'huobao:studio:panel-layout:v2'
const DEFAULT_PANEL_LAYOUT = Object.freeze({
  sidebarWidth: 208,
  sidebarHeight: 0,
  videoTaskListWidth: 0,
  videoPreviewHeight: 0,
  videoWorkbenchHeight: 0,
  storyboardListWidth: 0,
  storyboardReferenceWidth: 0,
  storyboardDescriptionWidth: 0,
  storyboardVideoPromptHeight: 0,
  storyboardWorkbenchHeight: 0,
})

function loadPanelLayout() {
  try {
    const saved = JSON.parse(localStorage.getItem(PANEL_LAYOUT_STORE_KEY) || '{}')
    const normalized = {}
    for (const [key, fallback] of Object.entries(DEFAULT_PANEL_LAYOUT)) {
      const value = Number(saved?.[key])
      normalized[key] = Number.isFinite(value) && value >= 0 ? value : fallback
    }
    return normalized
  } catch {
    return { ...DEFAULT_PANEL_LAYOUT }
  }
}

const panelLayout = reactive(loadPanelLayout())
const studioBodyEl = ref(null)
const sidebarEl = ref(null)
const videoWorkbenchEl = ref(null)
const videoTaskListEl = ref(null)
const videoTaskSideEl = ref(null)
const videoPreviewStackEl = ref(null)
const storyboardWorkbenchEl = ref(null)
const storyboardListEl = ref(null)
const storyboardReferenceEl = ref(null)
const storyboardSplitEl = ref(null)
const storyboardDescriptionPanelEl = ref(null)
const storyboardPromptStackEl = ref(null)
const storyboardVideoPromptEl = ref(null)

const cssPx = value => Number(value) > 0 ? `${Math.round(Number(value))}px` : undefined
const studioBodyStyle = computed(() => ({
  '--studio-sidebar-width': cssPx(panelLayout.sidebarWidth),
}))
const sidebarStyle = computed(() => panelLayout.sidebarHeight > 0 ? {
  height: cssPx(panelLayout.sidebarHeight),
  alignSelf: 'start',
} : {})
const videoWorkbenchStyle = computed(() => ({
  '--video-task-list-width': cssPx(panelLayout.videoTaskListWidth),
  ...(panelLayout.videoWorkbenchHeight > 0 ? {
    height: cssPx(panelLayout.videoWorkbenchHeight),
    flex: '0 0 auto',
  } : {}),
}))
const videoTaskSideStyle = computed(() => ({
  '--video-preview-height': cssPx(panelLayout.videoPreviewHeight),
}))
const storyboardWorkbenchStyle = computed(() => ({
  '--storyboard-list-width': cssPx(panelLayout.storyboardListWidth),
  '--storyboard-reference-width': cssPx(panelLayout.storyboardReferenceWidth),
  ...(panelLayout.storyboardWorkbenchHeight > 0 ? {
    height: cssPx(panelLayout.storyboardWorkbenchHeight),
    flex: '0 0 auto',
  } : {}),
}))
const storyboardSplitStyle = computed(() => ({
  '--storyboard-description-width': cssPx(panelLayout.storyboardDescriptionWidth),
}))
const storyboardPromptStackStyle = computed(() => ({
  '--storyboard-video-prompt-height': cssPx(panelLayout.storyboardVideoPromptHeight),
}))

let layoutSaveTimer = null
function persistPanelLayout() {
  try { localStorage.setItem(PANEL_LAYOUT_STORE_KEY, JSON.stringify(panelLayout)) } catch {}
}
function schedulePanelLayoutSave() {
  if (layoutSaveTimer != null || typeof window === 'undefined') return
  layoutSaveTimer = window.setTimeout(() => {
    layoutSaveTimer = null
    persistPanelLayout()
  }, 120)
}
watch(panelLayout, schedulePanelLayoutSave, { deep: true })

let activePanelResizeCleanup = null

function panelResizeConfig(key) {
  const viewportHeight = typeof window !== 'undefined' ? window.innerHeight : 900
  const configs = {
    sidebarWidth: {
      axis: 'x', element: sidebarEl.value, min: 168,
      max: Math.min(380, Math.max(220, (studioBodyEl.value?.clientWidth || 1280) - 560)),
    },
    sidebarHeight: {
      axis: 'y', element: sidebarEl.value, min: 260,
      max: Math.max(260, studioBodyEl.value?.clientHeight || viewportHeight - 72),
    },
    videoTaskListWidth: {
      axis: 'x', element: videoTaskListEl.value, min: 280,
      max: Math.max(320, (videoWorkbenchEl.value?.clientWidth || 1100) - 328),
    },
    videoPreviewHeight: {
      axis: 'y', element: videoPreviewStackEl.value, min: 190,
      max: Math.max(230, (videoTaskSideEl.value?.clientHeight || 720) - 220),
    },
    videoWorkbenchHeight: {
      axis: 'y', element: videoWorkbenchEl.value, min: 360,
      max: Math.max(420, viewportHeight - 126),
    },
    storyboardListWidth: {
      axis: 'x', element: storyboardListEl.value, min: 140, max: 380,
    },
    storyboardReferenceWidth: {
      axis: 'x', element: storyboardReferenceEl.value, min: 160, max: 400, reverse: true,
    },
    storyboardDescriptionWidth: {
      axis: 'x', element: storyboardDescriptionPanelEl.value, min: 120,
      max: Math.max(160, (storyboardSplitEl.value?.clientWidth || 900) - 148),
    },
    storyboardVideoPromptHeight: {
      axis: 'y', element: storyboardVideoPromptEl.value, min: 170,
      max: Math.max(220, (storyboardPromptStackEl.value?.clientHeight || 640) - 190),
    },
    storyboardWorkbenchHeight: {
      axis: 'y', element: storyboardWorkbenchEl.value, min: 360,
      max: Math.max(420, viewportHeight - 126),
    },
  }
  return configs[key]
}

function clampedPanelSize(value, config) {
  return Math.round(Math.min(config.max, Math.max(config.min, value)))
}

function currentPanelSize(key, config) {
  const saved = Number(panelLayout[key])
  if (saved > 0) return saved
  const rect = config.element?.getBoundingClientRect?.()
  return config.axis === 'x' ? (rect?.width || config.min) : (rect?.height || config.min)
}

function startConfiguredPanelResize(event, key) {
  if (event.button != null && event.button !== 0) return
  const config = panelResizeConfig(key)
  if (!config?.element) return
  event.preventDefault()
  activePanelResizeCleanup?.()

  const startPoint = config.axis === 'x' ? event.clientX : event.clientY
  const startSize = currentPanelSize(key, config)
  const direction = config.reverse ? -1 : 1
  const cursor = config.axis === 'x' ? 'col-resize' : 'row-resize'
  const previousCursor = document.body.style.cursor
  const previousUserSelect = document.body.style.userSelect
  document.body.style.cursor = cursor
  document.body.style.userSelect = 'none'
  document.body.classList.add('is-panel-resizing')

  const onMove = moveEvent => {
    const point = config.axis === 'x' ? moveEvent.clientX : moveEvent.clientY
    panelLayout[key] = clampedPanelSize(startSize + ((point - startPoint) * direction), config)
  }
  const cleanup = () => {
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', cleanup)
    window.removeEventListener('pointercancel', cleanup)
    document.body.style.cursor = previousCursor
    document.body.style.userSelect = previousUserSelect
    document.body.classList.remove('is-panel-resizing')
    persistPanelLayout()
    if (activePanelResizeCleanup === cleanup) activePanelResizeCleanup = null
  }
  activePanelResizeCleanup = cleanup
  window.addEventListener('pointermove', onMove)
  window.addEventListener('pointerup', cleanup)
  window.addEventListener('pointercancel', cleanup)
}

function resizeConfiguredPanelByKey(event, key) {
  const config = panelResizeConfig(key)
  if (!config?.element) return
  const negativeKey = config.axis === 'x' ? 'ArrowLeft' : 'ArrowUp'
  const positiveKey = config.axis === 'x' ? 'ArrowRight' : 'ArrowDown'
  if (event.key === 'Home') {
    event.preventDefault()
    resetPanelSize(key)
    return
  }
  if (![negativeKey, positiveKey].includes(event.key)) return
  event.preventDefault()
  const direction = (event.key === positiveKey ? 1 : -1) * (config.reverse ? -1 : 1)
  const step = event.shiftKey ? 48 : 16
  panelLayout[key] = clampedPanelSize(currentPanelSize(key, config) + direction * step, config)
}

function resetPanelSize(key) {
  panelLayout[key] = DEFAULT_PANEL_LAYOUT[key] ?? 0
  persistPanelLayout()
}

function resetAllPanelSizes() {
  Object.assign(panelLayout, DEFAULT_PANEL_LAYOUT)
  persistPanelLayout()
}

function clampAllPanelSizes() {
  for (const key of Object.keys(DEFAULT_PANEL_LAYOUT)) {
    const config = panelResizeConfig(key)
    const value = Number(panelLayout[key])
    if (!config || value <= 0) continue
    panelLayout[key] = clampedPanelSize(value, config)
  }
  persistPanelLayout()
}

const bindPanelResizeHandlers = key => ({
  start: event => startConfiguredPanelResize(event, key),
  keydown: event => resizeConfiguredPanelByKey(event, key),
})
const sidebarWidthResize = bindPanelResizeHandlers('sidebarWidth')
const sidebarHeightResize = bindPanelResizeHandlers('sidebarHeight')
const videoTaskListResize = bindPanelResizeHandlers('videoTaskListWidth')
const videoPreviewHeightResize = bindPanelResizeHandlers('videoPreviewHeight')
const videoWorkbenchHeightResize = bindPanelResizeHandlers('videoWorkbenchHeight')
const storyboardListResize = bindPanelResizeHandlers('storyboardListWidth')
const storyboardReferenceResize = bindPanelResizeHandlers('storyboardReferenceWidth')
const storyboardDescriptionResize = bindPanelResizeHandlers('storyboardDescriptionWidth')
const storyboardPromptHeightResize = bindPanelResizeHandlers('storyboardVideoPromptHeight')
const storyboardWorkbenchHeightResize = bindPanelResizeHandlers('storyboardWorkbenchHeight')

const startSidebarWidthResize = sidebarWidthResize.start
const resizeSidebarWidthByKey = sidebarWidthResize.keydown
const startSidebarHeightResize = sidebarHeightResize.start
const resizeSidebarHeightByKey = sidebarHeightResize.keydown
const startVideoTaskListResize = videoTaskListResize.start
const resizeVideoTaskListByKey = videoTaskListResize.keydown
const startVideoPreviewHeightResize = videoPreviewHeightResize.start
const resizeVideoPreviewHeightByKey = videoPreviewHeightResize.keydown
const startVideoWorkbenchHeightResize = videoWorkbenchHeightResize.start
const resizeVideoWorkbenchHeightByKey = videoWorkbenchHeightResize.keydown
const startStoryboardListResize = storyboardListResize.start
const resizeStoryboardListByKey = storyboardListResize.keydown
const startStoryboardReferenceResize = storyboardReferenceResize.start
const resizeStoryboardReferenceByKey = storyboardReferenceResize.keydown
const startStoryboardDescriptionResize = storyboardDescriptionResize.start
const resizeStoryboardDescriptionByKey = storyboardDescriptionResize.keydown
const startStoryboardPromptHeightResize = storyboardPromptHeightResize.start
const resizeStoryboardPromptHeightByKey = storyboardPromptHeightResize.keydown
const startStoryboardWorkbenchHeightResize = storyboardWorkbenchHeightResize.start
const resizeStoryboardWorkbenchHeightByKey = storyboardWorkbenchHeightResize.keydown

const localRaw = ref(''), localScript = ref('')
const rawContent = computed(() => episode.value?.content || '')
const scriptContent = computed(() => episode.value?.script_content || episode.value?.scriptContent || '')
const epId = computed(() => episode.value?.id || 0)
const rawLen = computed(() => localRaw.value.replace(/\s/g, '').length || 0)
const scriptLen = computed(() => localScript.value.replace(/\s/g, '').length || 0)
const mergeUrl = computed(() => mergeData.value?.merged_url || mergeData.value?.mergedUrl || null)

// ===== 拼接导出（P2-B2）：面板 UI 已下沉 EpisodeExportPanel =====
// 主壳保留：① 拼接发起/轮询需读写 mergeData（顶栏「查看成片」/侧栏阶段/底部气泡共用）；
// ② 镜头勾选 exportSelectedIds 为页面级状态——迁移前主壳 watch sbs 自动全选/保留跨面板切换选择，
//    故提升于主壳、以 selected-ids 受控下发，避免面板切 tab 卸载丢选择（P2-B2 评审修复）；
// ③ mergeError + lastMergeIds 供重试回调；exportListRev 自增通知子组件静默刷新成片列表
const mergeError = ref('')
const lastMergeIds = ref(null)
const exportListRev = ref(0)
// 镜头勾选（页面级状态，跨面板切换保留；面板内勾选/全选经 update:selected-ids 事件回写）
const exportSelectedIds = ref([]) // 勾选的镜头 id
let exportSelTouched = false      // 用户手动操作过选择后,不再自动全选
const exportReadyIds = computed(() => sbs.value.filter(s => hasVid(s)).map(s => s.id))
watch(exportReadyIds, (ids) => {
  if (exportSelTouched) {
    exportSelectedIds.value = exportSelectedIds.value.filter(id => ids.includes(id))
  } else {
    exportSelectedIds.value = [...ids]
  }
})
function onExportSelectedChange(ids) {
  exportSelTouched = true
  exportSelectedIds.value = ids
}

const scriptStep = ref(storedPanel ? (storedPanel.scriptStep === 0 ? 0 : 1) : 0)
const prodTab = ref(['assets', 'storyboard', 'videos'].includes(storedPanel?.prodTab) ? storedPanel.prodTab : 'assets')
// 面板位置变化即持久化
watch([panel, scriptStep, prodTab], ([p, s, t]) => {
  try { localStorage.setItem(PANEL_STORE_KEY, JSON.stringify({ panel: p, scriptStep: s, prodTab: t })) } catch { /* 静默 */ }
})
const activeExtractTab = ref('characters')
const prodTabIdx = computed({
  get: () => prodTabDefs.value.findIndex(t => t.id === prodTab.value),
  set: (v) => { prodTab.value = prodTabDefs.value[v]?.id || 'assets' },
})
const imageConfigs = ref([])
const videoConfigs = ref([])
const textConfigs = ref([])
// 模型配置加载态：失败时顶栏模型下拉静默消失，改为内联提示 + 重试
const configsLoading = ref(false)
const configsError = ref('')
// 生成时可选模型：空串 = 跟随配置默认（models[0]）；选择持久化到 localStorage，刷新页面后保留
const MODEL_STORE_KEYS = { chat: 'huobao:model:chat', image: 'huobao:model:image', video: 'huobao:model:video' }
function readStoredModel(key, legacyKey = '') {
  try { return localStorage.getItem(key) || (legacyKey && localStorage.getItem(legacyKey)) || '' } catch { return '' }
}
// 顶栏文本模型：适用于所有 Chat Agent 调用（改写/提取/拆镜/视频提示词/最终提示词），空串 = 跟随配置默认
const chatModel = ref(readStoredModel(MODEL_STORE_KEYS.chat, 'huobao:model:rewrite'))
const imageModel = ref(readStoredModel(MODEL_STORE_KEYS.image))
const videoModel = ref(readStoredModel(MODEL_STORE_KEYS.video))
function persistModel(modelRef, key) {
  watch(modelRef, v => {
    try { v ? localStorage.setItem(key, v) : localStorage.removeItem(key) } catch {}
  })
}
persistModel(chatModel, MODEL_STORE_KEYS.chat)
persistModel(imageModel, MODEL_STORE_KEYS.image)
persistModel(videoModel, MODEL_STORE_KEYS.video)
/** 顶栏文本模型覆盖参数：未选择时为 undefined，后端回退到 Agent/文本配置默认 */
function chatModelOverride() { return bareModelName(chatModel.value) || undefined }
function chatConfigId() { return ownerConfigId(textModelOptions.value, chatModel.value) }
const pendingCharImageIds = ref([])
const pendingSceneImageIds = ref([])
const pendingPropImageIds = ref([])
const pendingVideoIds = ref([])
const failedVideoMessages = ref({})
// 任务列表面板：顶栏按钮触发的右侧抽屉,按集聚合 sys_task + video_merges
const genTasks = ref([])
const genMerges = ref([])
const taskDrawer = ref(false)
// 任务列表加载三态（P0-C3 扫尾）：打开抽屉失败内联呈现，避免误导「暂无任务」
const taskListLoading = ref(false)
const taskListError = ref('')
let genTasksTimer = null

function openTaskDrawer() {
  taskDrawer.value = true
  loadGenTasks(true)
}
function closeTaskDrawer() {
  taskDrawer.value = false
}
// Seedance 2.0 视频生成面板：仅多模态参考（参考图 0-9 + 参考视频 0-3 + 参考音频 0-3 + 可选文本）
const videoRefVideoUrls = ref([])
const videoRefAudioUrls = ref([])
const videoRefImageUrls = ref([])
const videoDuration = ref(10)
const uploadingRefMedia = ref(false)
const mediaLibraryAssets = ref([])
const refAssetPicker = ref({ open: false, kind: 'image' })
const refAssetPickerLoading = ref(false)
const refAssetLibraryError = ref('')
const REF_SELECTION_STORE_KEY = `huobao:video-refs:${dramaId}:${episodeNumber}`
const storedShotRefSelections = ref((() => {
  try { return JSON.parse(localStorage.getItem(REF_SELECTION_STORE_KEY) || '{}') }
  catch { return {} }
})())
let restoringShotRefSelection = false
// 已成功写入 MySQL 的参考素材签名。内容相同的重复提交（页面刷新、切换分镜恢复状态）
// 直接跳过，避免无意义回写把刚生成的 H3 提示词判定为过期。
const lastSavedShotRefSelections = ref({})
// 每个分镜一条串行保存队列 + 最新待存签名。
// 快速连续选择素材时（deep watcher 每次变更都会触发保存），请求按提交顺序依次执行，
// 避免网络返回顺序颠倒导致旧状态覆盖新状态——后端事务只保证单次请求完整，
// 无法解决多个请求完成顺序颠倒的问题。
const shotRefSaveQueues = {}
const shotRefPendingSignatures = {}
// 某分镜最近一次失败的保存错误：flushShotRefSaves 读取后抛出并清空，
// 让「生成 H3 / 提交视频」在素材还没全部落库时中止，而不是继续用旧状态生成。
const shotRefLastErrors = {}
// URL → asset_id：记录参考素材来自资产库/上传落库的哪条资产，供后端追溯来源
const refAssetOrigins = ref({})
const imageViewer = ref({ open: false, src: '', title: '' })
const activeMerge = ref(null) // 成片大预览弹窗中正在播放的拼接记录
const assetDetail = ref({ open: false, type: '', item: null })
const assetDetailDraft = ref({ appearance: '', styling: '', prompt: '', lighting: '', description: '' })
// 最终提示词手动编辑：dirty 时才随保存提交，避免无修改保存误清空 Agent 生成的提示词
const assetPromptDraft = ref('')
const assetPromptDirty = ref(false)
const savingAssetDetail = ref(false)

function configLabel(config) {
  if (!config) return '未配置'
  const modelName = configModels(config)[0] || ''
  return modelName ? `${config.name} · ${modelName} (${config.provider})` : `${config.name} (${config.provider})`
}

function isPendingCharImage(id) {
  return pendingCharImageIds.value.includes(id)
}

function openImageViewer(src, title = '') {
  if (!src) return
  imageViewer.value = { open: true, src, title }
}

function closeImageViewer() {
  imageViewer.value = { open: false, src: '', title: '' }
}

function openAssetDetail(type, item) {
  if (!item) return
  assetDetail.value = { open: true, type, item }
  assetDetailDraft.value = {
    appearance: item.appearance || '',
    styling: item.styling || '',
    prompt: item.prompt || (type === 'prop' ? '' : item.description) || '',
    lighting: item.lighting || '',
    description: item.description || '',
  }
  assetPromptDraft.value = item.final_prompt || item.finalPrompt || ''
  assetPromptDirty.value = false
}

function closeAssetDetail() {
  assetDetail.value = { open: false, type: '', item: null }
  assetDetailDraft.value = { appearance: '', styling: '', prompt: '', lighting: '', description: '' }
  assetPromptDraft.value = ''
  assetPromptDirty.value = false
}

// ─── 手动新增资产 ────────────────────────────────────────────
const ASSET_TYPE_SHORT = { character: '角色', scene: '场景', prop: '道具' }
const assetCreate = ref({ open: false, type: 'character', saving: false })
const assetCreateDraft = ref({})
const assetCreateTypeLabel = computed(() => ASSET_TYPE_SHORT[assetCreate.value.type] || '资产')

function openAssetCreate(type) {
  assetCreateDraft.value = { name: '', role: '', appearance: '', styling: '', location: '', time: '', prompt: '', lighting: '', type: '', description: '' }
  assetCreate.value = { open: true, type, saving: false }
}

async function saveAssetCreate() {
  const d = assetCreateDraft.value
  const type = assetCreate.value.type
  if (assetCreate.value.saving) return
  if (type === 'scene' ? !d.location?.trim() : !d.name?.trim()) {
    toast.warning(type === 'scene' ? '请填写场景地点' : '请填写名称')
    return
  }
  assetCreate.value.saving = true
  try {
    const base = { drama_id: dramaId, episode_id: epId.value }
    if (type === 'character') await characterAPI.create({ ...base, name: d.name, role: d.role, appearance: d.appearance, styling: d.styling })
    else if (type === 'scene') await sceneAPI.create({ ...base, location: d.location, time: d.time, prompt: d.prompt, lighting: d.lighting })
    else await propAPI.create({ ...base, name: d.name, type: d.type, description: d.description })
    toast.success(`已新增${assetCreateTypeLabel.value}`)
    assetCreate.value.open = false
    await refresh()
  } catch (e) {
    toast.error(e.message)
  } finally {
    assetCreate.value.saving = false
  }
}

// ─── 删除资产 ────────────────────────────────────────────────
const assetDelete = ref({ open: false, type: '', item: null, loading: false })
const assetDeleteTypeLabel = computed(() => ASSET_TYPE_SHORT[assetDelete.value.type] || '资产')
const assetDeleteName = computed(() => assetDelete.value.item?.name || assetDelete.value.item?.location || '')

function askDeleteAsset(type, item) {
  assetDelete.value = { open: true, type, item, loading: false }
}

async function confirmDeleteAsset() {
  const { type, item } = assetDelete.value
  if (!item || assetDelete.value.loading) return
  assetDelete.value.loading = true
  try {
    if (type === 'character') await characterAPI.del(item.id)
    else if (type === 'scene') await sceneAPI.del(item.id)
    else await propAPI.del(item.id)
    toast.success(`已删除${assetDeleteTypeLabel.value}`)
    assetDelete.value.open = false
    if (assetDetail.value.open && assetDetail.value.type === type && assetDetail.value.item?.id === item.id) closeAssetDetail()
    await refresh()
  } catch (e) {
    toast.error(e.message)
  } finally {
    assetDelete.value.loading = false
  }
}

function onAssetPromptInput(event) {
  assetPromptDraft.value = event.target.value
  assetPromptDirty.value = true
}

const assetFinalPrompt = computed(() => {
  const item = assetDetail.value?.item
  return item?.final_prompt || item?.finalPrompt || ''
})

/** 把生成好的最终提示词同步到列表项与弹窗项 */
function applyFinalPrompt(type, id, fp) {
  const patch = { final_prompt: fp, finalPrompt: fp }
  const list = type === 'character' ? chars.value : type === 'scene' ? scenes.value : propItems.value
  const target = list.find(x => x.id === id)
  if (target) Object.assign(target, patch)
  if (assetDetail.value.open && assetDetail.value.type === type && assetDetail.value.item?.id === id) {
    Object.assign(assetDetail.value.item, patch)
  }
}

const generatingPromptKeys = ref([])

function isGeneratingPrompt(type, id) {
  return generatingPromptKeys.value.includes(`${type}:${id}`)
}

/** 该资产图片是否在外层「生成」流程中（含提示词阶段与生图阶段） */
function isAssetImagePending(type, id) {
  return type === 'character' ? isPendingCharImage(id) : type === 'scene' ? isPendingSceneImage(id) : isPendingPropImage(id)
}

/**
 * 生成最终提示词（弹窗按钮与外层两段式生图共用同一 key 状态，避免重复触发）
 * force=true 时忽略已有提示词强制重新生成
 * 返回最终提示词；生成失败由接口抛错，Agent 返回空时返回 ''
 */
async function ensureAssetPrompt(type, id, force = false) {
  const key = `${type}:${id}`
  if (generatingPromptKeys.value.includes(key)) return ''
  generatingPromptKeys.value.push(key)
  try {
    const res = type === 'character'
      ? await characterAPI.generatePrompt(id, epId.value, force, chatModelOverride(), chatConfigId())
      : type === 'scene'
        ? await sceneAPI.generatePrompt(id, epId.value, force, chatModelOverride(), chatConfigId())
        : await propAPI.generatePrompt(id, epId.value, force, chatModelOverride(), chatConfigId())
    const fp = res?.final_prompt || res?.finalPrompt || ''
    if (fp) applyFinalPrompt(type, id, fp)
    return fp
  } finally {
    generatingPromptKeys.value = generatingPromptKeys.value.filter(k => k !== key)
  }
}

/** 弹窗内生成最终提示词（不生图）；已有最终提示词时重新生成（force） */
async function genAssetFinalPrompt() {
  const detail = assetDetail.value
  if (!detail.open || !detail.item?.id) return
  const force = !!assetFinalPrompt.value
  try {
    const fp = await ensureAssetPrompt(detail.type, detail.item.id, force)
    if (!fp) throw new Error('最终提示词生成失败，请重试')
    assetPromptDraft.value = fp
    assetPromptDirty.value = false
    toast.success(force ? '最终提示词已重新生成' : '最终提示词已生成')
  } catch (e) {
    toast.error(e.message || '最终提示词生成失败')
  }
}

async function copyAssetFinalPrompt() {
  const text = assetPromptDraft.value || assetFinalPrompt.value
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    toast.success('最终提示词已复制')
  } catch {
    toast.error('复制失败，请手动选择文本复制')
  }
}

async function saveAssetDetail() {
  const detail = assetDetail.value
  if (!detail.open || !detail.item?.id) return
  const item = detail.item
  // 只提交真正修改过的字段：无修改保存不应触发后端的提示词失效置空
  const payload = {}
  let infoChanged = false
  if (detail.type === 'character') {
    if (assetDetailDraft.value.appearance !== (item.appearance || '')) payload.appearance = assetDetailDraft.value.appearance
    if (assetDetailDraft.value.styling !== (item.styling || '')) payload.styling = assetDetailDraft.value.styling
  } else if (detail.type === 'scene') {
    if (assetDetailDraft.value.prompt !== (item.prompt || '')) payload.prompt = assetDetailDraft.value.prompt
    if (assetDetailDraft.value.lighting !== (item.lighting || '')) payload.lighting = assetDetailDraft.value.lighting
  } else {
    if (assetDetailDraft.value.description !== (item.description || '')) payload.description = assetDetailDraft.value.description
  }
  infoChanged = Object.keys(payload).length > 0
  // 手动编辑过最终提示词才提交；空串视为清空
  if (assetPromptDirty.value) payload.final_prompt = assetPromptDraft.value.trim() || ''
  if (!infoChanged && !assetPromptDirty.value) {
    toast.info('没有需要保存的修改')
    return
  }
  savingAssetDetail.value = true
  try {
    if (detail.type === 'character') await characterAPI.update(item.id, payload)
    else if (detail.type === 'scene') await sceneAPI.update(item.id, payload)
    else await propAPI.update(item.id, payload)
    // 本地同步：手动编辑的提示词以草稿为准；仅信息字段变更时提示词已被后端置空
    const { final_prompt, ...infoPatch } = payload
    const promptValue = assetPromptDirty.value ? (payload.final_prompt || null) : (infoChanged ? null : (item.final_prompt || item.finalPrompt || null))
    Object.assign(item, infoPatch, { final_prompt: promptValue, finalPrompt: promptValue })
    const list = detail.type === 'character' ? chars.value : detail.type === 'scene' ? scenes.value : propItems.value
    const target = list.find(x => x.id === item.id)
    if (target) Object.assign(target, infoPatch, { final_prompt: promptValue, finalPrompt: promptValue })
    if (assetPromptDirty.value) assetPromptDraft.value = payload.final_prompt || ''
    assetPromptDirty.value = false
    toast.success('修改已保存')
  } catch (e) {
    toast.error(e.message || '保存失败')
  } finally {
    savingAssetDetail.value = false
  }
}

function assetImageSrc(item) {
  const raw = item?.image_url || item?.imageUrl || ''
  if (!raw) return ''
  if (/^https?:\/\//i.test(raw) || raw.startsWith('/')) return raw
  return `/${raw}`
}

function assetDetailTitle(detail) {
  if (!detail?.item) return ''
  if (detail.type === 'character') return detail.item.name || '未命名角色'
  if (detail.type === 'prop') return detail.item.name || '未命名道具'
  return detail.item.location || '未命名场景'
}

function assetTypeLabel(type) {
  return { character: '角色资产', scene: '场景资产', prop: '道具资产' }[type] || '资产'
}

function characterAppearanceValue(char) {
  return char?.appearance || '样貌待补充'
}

function characterStylingValue(char) {
  return char?.styling || '妆造待补充'
}

function characterVisualSummary(char) {
  return `样貌：${characterAppearanceValue(char)} · 妆造：${characterStylingValue(char)}`
}

function sceneDescriptionValue(scene) {
  return scene?.prompt || scene?.description || '场景描述待补充'
}

function sceneLightingValue(scene) {
  return scene?.lighting || '场景光影待补充'
}

function handleImageViewerKeydown(event) {
  if (event.key !== 'Escape') return
  if (imageViewer.value.open) closeImageViewer()
  else if (assetDetail.value.open) closeAssetDetail()
  else if (taskDrawer.value) closeTaskDrawer()
}

onMounted(() => {
  window.addEventListener('keydown', handleImageViewerKeydown)
  window.addEventListener('resize', clampAllPanelSizes)
})

onBeforeUnmount(() => {
  window.removeEventListener('keydown', handleImageViewerKeydown)
  window.removeEventListener('resize', clampAllPanelSizes)
  if (layoutSaveTimer != null) window.clearTimeout(layoutSaveTimer)
  layoutSaveTimer = null
  activePanelResizeCleanup?.()
  stopGenTasksPolling()
})

function isPendingSceneImage(id) {
  return pendingSceneImageIds.value.includes(id)
}

function isPendingVideo(id) {
  return pendingVideoIds.value.includes(id)
}

function videoFailMessage(id) {
  return failedVideoMessages.value[id] || ''
}

function videoTaskState(sb) {
  if (hasVid(sb)) return 'done'
  if (isPendingVideo(sb?.id)) return 'pending'
  if (videoFailMessage(sb?.id)) return 'failed'
  return 'ready'
}

function videoTaskStatusLabel(sb) {
  const state = videoTaskState(sb)
  if (state === 'done') return '已完成'
  if (state === 'pending') return '生成中'
  if (state === 'failed') return '失败'
  return '待生成'
}

function videoTaskActionLabel(sb) {
  const state = videoTaskState(sb)
  if (state === 'done') return '重新生成'
  if (state === 'pending') return '生成中'
  return '生成'
}

const videoTaskRows = computed(() => sbs.value.map((sb, index) => {
  const duration = Number(sb.duration || 5)
  const referenceCount = getShotReferenceImages(sb).length
  const sceneName = getSceneName(sb)
  return {
    id: sb.id,
    index,
    storyboard: sb,
    title: sb.description || `镜头 #${String(index + 1).padStart(2, '0')}`,
    meta: sceneName || `${referenceCount} 个参考素材`,
    duration: Number.isFinite(duration) ? duration : 5,
    referenceCount,
    state: videoTaskState(sb),
    // 只有当前处于失败状态才显示错误,避免重试成功的分镜残留历史错误信息
    error: videoTaskState(sb) === 'failed' ? videoFailMessage(sb.id) : '',
  }
}))
const videoTaskDoneCount = computed(() => videoTaskRows.value.filter(task => task.state === 'done').length)
const videoTaskFailedCount = computed(() => videoTaskRows.value.filter(task => task.state === 'failed').length)

function isNarratorCharacter(char) {
  const text = `${char?.name || ''} ${char?.role || ''}`.toLowerCase()
  return text.includes('旁白') || text.includes('narrator') || text.includes('画外音')
}

const visualChars = computed(() => chars.value.filter(c => !isNarratorCharacter(c)))
const lockedImageConfigId = computed(() => episode.value?.image_config_id || episode.value?.imageConfigId || null)
const lockedVideoConfigId = computed(() => episode.value?.video_config_id || episode.value?.videoConfigId || null)
const lockedImageConfigLabel = computed(() => configLabel(imageConfigs.value.find(c => c.id === lockedImageConfigId.value)))
const lockedVideoConfigLabel = computed(() => configLabel(videoConfigs.value.find(c => c.id === lockedVideoConfigId.value)))
// 画面比例在创建项目时固定，视频生成统一使用
const dramaAspectRatio = computed(() => drama.value?.aspect_ratio || drama.value?.aspectRatio || '16:9')

// 生成可选模型列表：配置中的模型数组（首位为配置默认）；API 可能返回数组或 JSON 字符串
function configModels(cfg) {
  const raw = cfg?.model
  if (!raw) return []
  if (Array.isArray(raw)) return raw.filter(Boolean)
  try { const m = JSON.parse(raw); return Array.isArray(m) ? m.filter(Boolean) : [m].filter(Boolean) } catch { return [raw].filter(Boolean) }
}
// 汇总该类型全部启用配置的模型（按 厂商+模型 去重，按优先级排序），选中模型时连同所属配置一起调用
// 选中值使用 'provider/model' 复合键：同名模型可能来自不同厂商（如中转站与官方），必须区分
function collectModelOptions(cfgs) {
  const seen = new Set()
  const out = []
  const sorted = [...cfgs].filter(c => c.is_active).sort((a, b) => (b.priority || 0) - (a.priority || 0))
  for (const c of sorted) {
    for (const m of configModels(c)) {
      const key = `${c.provider}/${m}`
      if (seen.has(key)) continue
      seen.add(key)
      out.push({ key, model: m, provider: c.provider, configId: c.id, configName: c.name || c.provider })
    }
  }
  return out
}
// 复合键 → 裸模型名（后端适配器按厂商校验模型名，不能带 provider 前缀）
function bareModelName(key) {
  if (!key) return ''
  const i = key.indexOf('/')
  return i >= 0 ? key.slice(i + 1) : key
}
function ownerConfigId(options, key) {
  return key ? (options.find(o => o.key === key)?.configId || undefined) : undefined
}
function hasMultiConfigs(options) {
  return new Set(options.map(o => o.configId)).size > 1
}
const textModelOptions = computed(() => collectModelOptions(textConfigs.value))
const imageModelOptions = computed(() => collectModelOptions(imageConfigs.value))
const videoModelOptions = computed(() => collectModelOptions(videoConfigs.value))
const selectedVideoProvider = computed(() => {
  const locked = videoConfigs.value.find(config => config.id === lockedVideoConfigId.value)
  if (locked?.provider) return locked.provider
  const selected = videoModelOptions.value.find(option => option.key === videoModel.value)
  return selected?.provider || videoModelOptions.value[0]?.provider || ''
})

const refAssetKindLabel = computed(() => ({ image: '图片', video: '视频', audio: '音频' })[refAssetPicker.value.kind] || '素材')

function normalizeMediaUrl(value) {
  const raw = String(value || '').trim()
  if (!raw || /^https?:\/\//i.test(raw) || raw.startsWith('data:') || raw.startsWith('/')) return raw
  return `/${raw}`
}

function addRefAssetCandidate(target, seen, item) {
  const url = normalizeMediaUrl(item.url)
  if (!url || seen.has(url)) return
  seen.add(url)
  target.push({ ...item, url, thumbnail: normalizeMediaUrl(item.thumbnail || '') })
}

const refAssetCandidates = computed(() => {
  const kind = refAssetPicker.value.kind
  const items = []
  const seen = new Set()
  if (kind === 'image') {
    for (const char of visualChars.value) {
      addRefAssetCandidate(items, seen, { key: `character-${char.id}`, kind, name: char.name || '未命名角色', source: '角色资产', url: char.image_url || char.imageUrl, thumbnail: thumbOf(assetImageSrc(char)) })
    }
    for (const scene of scenes.value) {
      addRefAssetCandidate(items, seen, { key: `scene-${scene.id}`, kind, name: scene.location || '未命名场景', source: '场景资产', url: scene.image_url || scene.imageUrl, thumbnail: thumbOf(assetImageSrc(scene)) })
    }
    for (const prop of propItems.value) {
      addRefAssetCandidate(items, seen, { key: `prop-${prop.id}`, kind, name: prop.name || '未命名道具', source: '道具资产', url: prop.image_url || prop.imageUrl, thumbnail: thumbOf(assetImageSrc(prop)) })
    }
  } else if (kind === 'video') {
    for (const sb of sbs.value) {
      const url = getVideoUrl(sb)
      addRefAssetCandidate(items, seen, { key: `storyboard-video-${sb.id}`, kind, name: `分镜 ${sb.storyboard_number || sb.storyboardNumber || sb.id} · ${sb.title || '已生成视频'}`, source: '分镜视频', url })
    }
  }
  for (const asset of mediaLibraryAssets.value) {
    const assetKind = String(asset.type || '').toLowerCase()
    if (assetKind !== kind) continue
    addRefAssetCandidate(items, seen, {
      key: `library-${asset.id}`,
      kind,
      name: asset.name || `${refAssetKindLabel.value}素材`,
      source: '本地上传素材库',
      url: asset.url || asset.local_path || asset.localPath,
      thumbnail: asset.thumbnail_url || asset.thumbnailUrl,
      // 带上资产库记录 ID，保存参考素材时后端可追溯到原始资产
      asset_id: asset.id,
    })
  }
  return items
})

function selectedRefList(kind = refAssetPicker.value.kind) {
  if (kind === 'image') return videoRefImageUrls
  if (kind === 'video') return videoRefVideoUrls
  return videoRefAudioUrls
}

function isAutoBoundImageAsset(asset) {
  if (asset?.kind !== 'image' || !selectedSb.value) return false
  return getShotReferenceImages(selectedSb.value).includes(asset.url) && !videoRefImageUrls.value.includes(asset.url)
}

function isRefAssetSelected(asset) {
  return isAutoBoundImageAsset(asset) || selectedRefList(asset.kind).value.includes(asset.url)
}

const selectedRefAssetCount = computed(() => selectedRefList().value.length)

async function loadRefAssetLibrary() {
  refAssetPickerLoading.value = true
  refAssetLibraryError.value = ''
  try {
    mediaLibraryAssets.value = await assetLibraryAPI.list({ drama_id: dramaId, episode_id: epId.value }) || []
  } catch (error) {
    // 失败内联呈现 + 重试，避免回落误导性「素材库还没有…」空态
    refAssetLibraryError.value = error.message || '素材库加载失败'
  } finally {
    refAssetPickerLoading.value = false
  }
}

async function openRefAssetPicker(kind) {
  refAssetPicker.value = { open: true, kind }
  await loadRefAssetLibrary()
}

function closeRefAssetPicker() {
  refAssetPicker.value = { ...refAssetPicker.value, open: false }
}

function toggleRefAsset(asset) {
  if (isAutoBoundImageAsset(asset)) {
    toast.info('该图片已随当前分镜绑定，无需重复选择')
    return
  }
  const list = selectedRefList(asset.kind)
  if (list.value.includes(asset.url)) {
    list.value = list.value.filter(url => url !== asset.url)
    return
  }
  const limit = asset.kind === 'image' ? 9 : 3
  const used = asset.kind === 'image' ? refImageUsedCount.value : list.value.length
  if (used >= limit) {
    toast.info(`参考${({ image: '图片', video: '视频', audio: '音频' })[asset.kind]}最多 ${limit} 个`)
    return
  }
  list.value = [...list.value, asset.url]
  rememberRefAssetOrigin(asset.url, asset.asset_id)
}

// 配置变化后校验持久化的模型是否仍存在（配置被删/模型被移除时回退默认，避免把失效模型传给后端）
function pruneStaleModel(modelRef, optionsRef) {
  watch(optionsRef, opts => {
    if (!modelRef.value || !opts.length) return
    if (opts.some(o => o.key === modelRef.value)) return
    // 旧版本地存储只有裸模型名：能对上则升级为复合键，对不上回退默认
    const legacy = opts.filter(o => o.model === modelRef.value)
    modelRef.value = legacy.length ? legacy[0].key : ''
  }, { immediate: true })
}
pruneStaleModel(chatModel, textModelOptions)
pruneStaleModel(imageModel, imageModelOptions)
pruneStaleModel(videoModel, videoModelOptions)
const textModelMultiCfg = computed(() => hasMultiConfigs(textModelOptions.value))
const imageModelMultiCfg = computed(() => hasMultiConfigs(imageModelOptions.value))
const videoModelMultiCfg = computed(() => hasMultiConfigs(videoModelOptions.value))

// Production step helpers
// ========== 任务列表面板 ==========
async function loadGenTasks(initial = false) {
  if (!epId.value) return
  if (initial) { taskListLoading.value = true; taskListError.value = '' }
  try {
    const data = await taskAPI.listByEpisode(epId.value)
    genTasks.value = data?.tasks || []
    genMerges.value = data?.merges || []
    taskListError.value = ''

    // 生成中/失败状态只存在内存里,页面刷新后丢失;从 sys_task 记录按分镜恢复,
    // 否则已失败的镜头刷新后会退化成"待生成"
    const videoTasks = genTasks.value.filter(t => t.type === 'video' && t.storyboard_id)
    // 每个分镜只取最新一条任务(created_at 降序、id 兜底),旧任务不干预当前状态
    const latestBySb = new Map()
    for (const t of videoTasks) {
      const prev = latestBySb.get(t.storyboard_id)
      if (!prev
        || String(t.created_at || '') > String(prev.created_at || '')
        || (String(t.created_at || '') === String(prev.created_at || '') && t.id > prev.id)) {
        latestBySb.set(t.storyboard_id, t)
      }
    }
    // pending/failed 全量重建而非与现有值并集——否则刷新恢复的"生成中"在任务失败后
    // 永不消退(videoTaskState 中 pending 优先于 failed,重试按钮还被禁用)
    const pending = new Set()
    const failed = {}
    for (const [sbId, t] of latestBySb) {
      // 分镜已有视频(失败后重试成功)时不再报历史错误
      if (hasVid(sbs.value.find(s => s.id === sbId))) continue
      if (t.status === 'processing') pending.add(sbId)
      else if (t.status === 'failed') failed[sbId] = t.error_msg || '生成失败'
    }
    // 刚点击提交、任务记录尚未加载出来的本地状态保留,避免状态闪退
    for (const id of pendingVideoIds.value) if (!latestBySb.has(id)) pending.add(id)
    for (const id of Object.keys(failedVideoMessages.value)) {
      if (!latestBySb.has(Number(id))) failed[id] = failedVideoMessages.value[id]
    }
    pendingVideoIds.value = [...pending]
    failedVideoMessages.value = failed
  } catch (e) {
    // 用户打开抽屉/手动刷新失败 -> 内联错误 + 重试；后台轮询刷新保持旧数据
    if (initial) taskListError.value = e.message || '任务列表加载失败'
  } finally {
    if (initial) taskListLoading.value = false
  }
}

function stopGenTasksPolling() {
  if (genTasksTimer) { clearInterval(genTasksTimer); genTasksTimer = null }
}

const genTaskActiveCount = computed(() =>
  genTasks.value.filter(t => t.status === 'processing').length +
  genMerges.value.filter(m => m.status === 'processing' || m.status === 'pending').length
)
const genTaskDoneCount = computed(() =>
  genTasks.value.filter(t => t.status === 'completed').length +
  genMerges.value.filter(m => m.status === 'completed').length
)
const genTaskFailedCount = computed(() =>
  genTasks.value.filter(t => t.status === 'failed').length +
  genMerges.value.filter(m => m.status === 'failed').length
)

function genTaskTargetLabel(t) {
  if (t.storyboard_id) {
    const sb = sbs.value.find(x => x.id === t.storyboard_id)
    return `分镜 #${sb?.storyboard_number ?? sb?.storyboardNumber ?? t.storyboard_id}`
  }
  if (t.character_id) {
    const c = chars.value.find(x => x.id === t.character_id)
    return `角色 · ${c?.name || t.character_id}`
  }
  if (t.scene_id) {
    const s = scenes.value.find(x => x.id === t.scene_id)
    return `场景 · ${s?.location || t.scene_id}`
  }
  if (t.prop_id) {
    const p = propItems.value.find(x => x.id === t.prop_id)
    return `道具 · ${p?.name || t.prop_id}`
  }
  return '通用'
}

// 统一行结构：image / video / merge 三类合并按时间倒序
const genTaskRows = computed(() => {
  const taskRows = genTasks.value.map(t => ({
    key: `task-${t.id}`,
    kind: t.type, // image | video
    id: t.id,
    targetLabel: genTaskTargetLabel(t),
    provider: t.provider || '',
    model: t.model || '',
    status: t.status || 'processing',
    errorMsg: t.error_msg || '',
    previewUrl: t.local_path || t.result_url || '',
    prompt: t.prompt || '',
    createdAt: t.created_at || '',
    completedAt: t.completed_at || '',
  }))
  const mergeRows = genMerges.value.map(m => ({
    key: `merge-${m.id}`,
    kind: 'merge',
    id: m.id,
    targetLabel: '整集拼接',
    provider: m.provider || 'ffmpeg',
    model: m.model || '',
    status: m.status || 'pending',
    errorMsg: m.error_msg || '',
    previewUrl: m.merged_url || '',
    prompt: '',
    createdAt: m.created_at || '',
    completedAt: m.completed_at || '',
  }))
  return [...taskRows, ...mergeRows].sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''))
})

function genTaskKindLabel(kind) {
  return kind === 'image' ? '图片' : kind === 'video' ? '视频' : '合并'
}

function genTaskStatusLabel(status) {
  if (status === 'completed') return '已完成'
  if (status === 'failed') return '失败'
  return '生成中'
}

// 映射到现有 video-task-status 的样式类:is-done / is-pending / is-failed
function genTaskStateClass(status) {
  if (status === 'completed') return 'done'
  if (status === 'failed') return 'failed'
  return 'pending'
}

// local_path 为站内相对路径补 '/',远端 result_url 原样使用
function genTaskPreviewSrc(url) {
  if (!url) return ''
  return /^https?:\/\//.test(url) ? url : '/' + url
}

function genTaskDuration(row) {
  if (!row.createdAt || !row.completedAt) return ''
  const ms = new Date(row.completedAt).getTime() - new Date(row.createdAt).getTime()
  if (!Number.isFinite(ms) || ms < 0) return ''
  return ms >= 60000 ? `${Math.floor(ms / 60000)}m${Math.round((ms % 60000) / 1000)}s` : `${Math.round(ms / 1000)}s`
}

// 抽屉打开且有进行中任务时,4s 轮询;关闭或全部结束时停止
watch([taskDrawer, genTaskActiveCount], ([open, active]) => {
  stopGenTasksPolling()
  if (open && active > 0) {
    genTasksTimer = setInterval(loadGenTasks, 4000)
  }
})

const productionBlockMessage = computed(() => {
  if (!scriptContent.value) return '请先完成剧本编写'
  return ''
})
const productionBlockActionLabel = computed(() => {
  if (!scriptContent.value) return '前往剧本'
  return '返回处理'
})
function goProductionBlockTarget() {
  if (!scriptContent.value) {
    panel.value = 'script'
    scriptStep.value = rawContent.value ? 1 : 0
    return
  }
  panel.value = 'production'
  prodTab.value = 'assets'
}
const canExport = computed(() => !!sbs.value.length && shotVidCount.value === sbs.value.length)
function goNextProd() {
  if (prodTab.value === 'assets') {
    prodTab.value = 'storyboard'
    return
  }
  if (prodTab.value === 'storyboard') {
    prodTab.value = 'videos'
    return
  }
  if (prodTabIdx.value < prodTabDefs.value.length - 1) {
    prodTabIdx.value++
  } else {
    panel.value = 'export'
  }
}

// Script step navigation
const stepLabels = ['原始内容', 'AI 改写']
const prevStepLabel = computed(() => scriptStep.value > 0 ? stepLabels[scriptStep.value - 1] : '')
const nextStepLabel = computed(() => {
  if (scriptStep.value === 1) return '资产'
  return stepLabels[scriptStep.value + 1] || ''
})
const canGoNext = computed(() => {
  if (scriptStep.value === 0) return !!localRaw.value.trim()
  if (scriptStep.value === 1) return !!localScript.value.trim() || !!scriptContent.value
  return false
})
function goPrevStep() { if (scriptStep.value > 0) scriptStep.value-- }
function goNextStep() {
  if (scriptStep.value === 0 && localRaw.value.trim()) {
    saveRaw()
    scriptStep.value = 1
    return
  }
  if (scriptStep.value === 1 && canGoNext.value) {
    if (localScript.value.trim()) saveScr()
    panel.value = 'production'
    prodTab.value = 'assets'
  }
}

const charImgCount = computed(() => visualChars.value.filter(c => c.image_url || c.imageUrl).length)
const sceneImgCount = computed(() => scenes.value.filter(s => s.image_url || s.imageUrl).length)
const propImgCount = computed(() => propItems.value.filter(p => p.image_url || p.imageUrl).length)
const shotVidCount = computed(() => sbs.value.filter(s => s.video_url || s.videoUrl).length)
const visualCharTotal = computed(() => visualChars.value.length)
const pendingCharacterImageCount = computed(() => Math.max(visualCharTotal.value - charImgCount.value, 0))
const pendingSceneImageCount = computed(() => Math.max(scenes.value.length - sceneImgCount.value, 0))
const pendingAssetImageCount = computed(() => pendingCharacterImageCount.value + pendingSceneImageCount.value)
const assetTotalCount = computed(() => visualCharTotal.value + scenes.value.length + propItems.value.length)
const assetReadyCount = computed(() => charImgCount.value + sceneImgCount.value + propImgCount.value)

const prodTabDefs = computed(() => [
  { id: 'assets', label: '资产', icon: FolderKanban, badge: assetTotalCount.value ? `${assetReadyCount.value}/${assetTotalCount.value}` : '' },
  { id: 'storyboard', label: '分镜拆分', icon: Clapperboard, badge: sbs.value.length ? `${sbs.value.length}` : '' },
  { id: 'videos', label: '视频生成', icon: Video, badge: shotVidCount.value ? `${shotVidCount.value}/${sbs.value.length}` : '' },
])

const mainStageDefs = [
  { id: 'script', label: '剧本', desc: '内容改写与整理', icon: FileText },
  { id: 'assets', label: '资产', desc: '角色 / 场景 / 道具', icon: FolderKanban },
  { id: 'storyboard', label: '分镜', desc: '分镜拆分与提示词', icon: Clapperboard },
  { id: 'videos', label: '视频', desc: '视频任务与生成', icon: Video },
  { id: 'export', label: '导出', desc: '拼接与成片输出', icon: Download },
]

const sidebarSections = computed(() => ([
  {
    id: 'script',
    label: '剧本',
    items: [
      { key: 'script:raw', label: '原始内容', desc: '', icon: FileText },
      { key: 'script:rewrite', label: 'AI 改写', desc: '', icon: FileText },
    ],
  },
  {
    id: 'production',
    label: '制作',
    items: [
      { key: 'prod:assets', label: '资产', desc: '', icon: Users },
      { key: 'prod:storyboard', label: '分镜拆分', desc: '', icon: Clapperboard },
      { key: 'prod:videos', label: '视频生成', desc: '', icon: Video },
    ],
  },
  {
    id: 'export',
    label: '导出',
    items: [
      { key: 'export:merge', label: '拼接导出', desc: '', icon: Download },
    ],
  },
]))

// 大环节状态:pending(未开始)/ active(进行中)/ done(已完成)/ none(不显示状态,导出用)
// 进行中 = 环节内有任意进度但未全部完成,或当前正处于该环节
function sectionState(sectionId) {
  if (sectionId === 'export') return 'none'
  const done = sectionId === 'script'
    ? mainStageDone('script')
    : mainStageDone('assets') && mainStageDone('storyboard') && mainStageDone('videos')
  if (done) return 'done'

  const hasProgress = sectionId === 'script'
    ? !!(rawContent.value || scriptContent.value)
    : !!(chars.value.length || scenes.value.length || propItems.value.length || sbs.value.length || shotVidCount.value)
  const isCurrent = sectionId === 'script'
    ? panel.value === 'script'
    : panel.value === 'production'
  return (hasProgress || isCurrent) ? 'active' : 'pending'
}

const activeMainStage = computed(() => {
  if (panel.value === 'export') return 'export'
  if (panel.value === 'production') {
    if (prodTab.value === 'assets') return 'assets'
    if (prodTab.value === 'storyboard') return 'storyboard'
    return 'videos'
  }
  return 'script'
})

function mainStageDone(stageId) {
  if (stageId === 'script') return !!scriptContent.value
  if (stageId === 'assets') return assetTotalCount.value > 0 && assetReadyCount.value === assetTotalCount.value
  if (stageId === 'videos') {
    return !!sbs.value.length && shotVidCount.value === sbs.value.length
  }
  if (stageId === 'storyboard') return !!sbs.value.length
  if (stageId === 'export') return !!mergeUrl.value
  return false
}

function goMainStage(stageId) {
  if (stageId === 'script') {
    panel.value = 'script'
    scriptStep.value = Math.min(scriptStep.value, 1)
    return
  }
  if (stageId === 'assets') {
    panel.value = 'production'
    prodTab.value = 'assets'
    return
  }
  if (stageId === 'videos') {
    panel.value = 'production'
    prodTab.value = 'videos'
    return
  }
  if (stageId === 'storyboard') {
    panel.value = 'production'
    prodTab.value = 'storyboard'
    return
  }
  panel.value = 'export'
}

const activeSubStepKey = computed(() => {
  if (panel.value === 'script') {
    if (scriptStep.value === 0) return 'script:raw'
    return 'script:rewrite'
  }
  if (panel.value === 'production') return `prod:${prodTab.value}`
  return 'export:merge'
})

const sidebarJumpSteps = computed(() => {
  const section = sidebarSections.value.find((item) => item.items.some(step => step.key === activeSubStepKey.value))
  return section?.items || []
})

const bubbleSteps = computed(() => {
  if (panel.value === 'script') {
    return [
      { key: 'script:raw', label: '原始内容' },
      { key: 'script:rewrite', label: 'AI 改写' },
    ]
  }
  if (panel.value === 'production') {
    return prodTabDefs.value.map(step => ({
      key: `prod:${step.id}`,
      label: step.label,
    }))
  }
  return []
})

const activeBubbleKey = computed(() => {
  if (panel.value === 'script') return activeSubStepKey.value
  if (panel.value === 'production') return `prod:${prodTab.value}`
  return ''
})

const showBottomBubble = computed(() => panel.value === 'script' || panel.value === 'production')

function goSubStep(key) {
  if (key.startsWith('script:')) {
    panel.value = 'script'
    const stepMap = {
      'script:raw': 0,
      'script:rewrite': 1,
    }
    scriptStep.value = stepMap[key] ?? 0
    return
  }
  if (key.startsWith('prod:')) {
    panel.value = 'production'
    prodTab.value = key.replace('prod:', '')
    return
  }
  panel.value = 'export'
}

const pipelineTotal = 2
const pipelineProgress = computed(() =>
  ['script', 'production'].filter(id => sectionState(id) === 'done').length
)

const currentStageLabel = computed(() => {
  if (panel.value === 'script') return `剧本阶段 · ${stepLabels[scriptStep.value]}`
  if (panel.value === 'production') return `制作阶段 · ${prodTabDefs.value[prodTabIdx.value]?.label || '制作'}`
  return mergeUrl.value ? '导出阶段 · 成片已生成' : '导出阶段 · 等待拼接'
})

const currentMainStageLabel = computed(() => {
  const current = mainStageDefs.find(stage => stage.id === activeMainStage.value)
  return current?.label || '工作台'
})

const currentSubStageLabel = computed(() => currentStageLabel.value)

const totalDuration = computed(() => sbs.value.reduce((s, sb) => s + (sb.duration || 10), 0))
const selectedSb = ref(null)
const selectedVideoTaskNumber = computed(() => {
  const index = videoTaskRows.value.findIndex(task => String(task.id) === String(selectedSb.value?.id))
  return index >= 0 ? index + 1 : 0
})

function updateField(sb, field, value) {
  const current = sb[field] ?? sb[toCamel(field)]
  if (current === value) return
  sb[field] = value
  const camelField = toCamel(field)
  if (camelField !== field) sb[camelField] = value
  storyboardAPI.update(sb.id, { [field]: value }).catch(e => toast.error(e.message))
}

function toCamel(field) {
  return field.replace(/_([a-z])/g, (_, c) => c.toUpperCase())
}

function getStoryboardCharacterIds(sb) {
  return sb?.character_ids || sb?.characterIds || []
}

function getStoryboardCharacters(sb) {
  const ids = getStoryboardCharacterIds(sb)
  return visualChars.value.filter(char => ids.includes(char.id)).sort((a, b) => Number(a.id) - Number(b.id))
}

function getStoryboardScene(sb) {
  const sceneId = sb?.scene_id || sb?.sceneId
  if (!sceneId) return null
  return scenes.value.find(s => s.id === sceneId) || null
}

function isStoryboardCharacterSelected(sb, charId) {
  return getStoryboardCharacterIds(sb).includes(charId)
}

function toggleStoryboardCharacter(sb, charId) {
  const currentIds = getStoryboardCharacterIds(sb)
  const nextIds = currentIds.includes(charId)
    ? currentIds.filter(id => id !== charId)
    : [...currentIds, charId]
  updateField(sb, 'character_ids', nextIds)
}

function getStoryboardPropIds(sb) {
  return sb?.prop_ids || sb?.propIds || []
}

function getStoryboardProps(sb) {
  const ids = getStoryboardPropIds(sb)
  return propItems.value.filter(p => ids.includes(p.id)).sort((a, b) => Number(a.id) - Number(b.id))
}

function isStoryboardPropSelected(sb, propId) {
  return getStoryboardPropIds(sb).includes(propId)
}

function toggleStoryboardProp(sb, propId) {
  const currentIds = getStoryboardPropIds(sb)
  const nextIds = currentIds.includes(propId)
    ? currentIds.filter(id => id !== propId)
    : [...currentIds, propId]
  updateField(sb, 'prop_ids', nextIds)
}

function getSceneName(sb) {
  const scene = getStoryboardScene(sb)
  if (!scene) return ''
  return `${scene.location} · ${scene.time || '未设时间'}`
}

const sceneOptions = computed(() => [
  { label: '未绑定场景', value: '' },
  ...scenes.value.map(s => ({ label: `${s.location} · ${s.time || '未设时间'}`, value: s.id })),
])


function sceneShotCount(sceneId) {
  return sbs.value.filter(sb => String(sb?.scene_id || sb?.sceneId || '') === String(sceneId)).length
}

watch(rawContent, v => { localRaw.value = v }, { immediate: true })
watch(scriptContent, v => { localScript.value = v }, { immediate: true })

// 角色/场景/道具子资源加载（R1）：任一失败保留上次数据并汇总错误，供资产区内联呈现 + 重试
async function loadEpisodeAssets(ep) {
  const errors = []
  try { chars.value = await episodeAPI.characters(ep.id) } catch (e) { errors.push(`角色：${e.message || '加载失败'}`) }
  try { scenes.value = await episodeAPI.scenes(ep.id) } catch (e) { errors.push(`场景：${e.message || '加载失败'}`) }
  try { propItems.value = await episodeAPI.props(ep.id) } catch (e) { errors.push(`道具：${e.message || '加载失败'}`) }
  assetsLoadError.value = errors.join('；')
}

async function refresh(initial = false) {
  if (initial) { pageLoading.value = true; pageLoadError.value = '' }
  try {
    drama.value = await dramaAPI.get(dramaId)
    const ep = drama.value.episodes?.find(e => (e.episode_number || e.episodeNumber) === episodeNumber)
    if (ep) {
      episode.value = ep
      await loadEpisodeAssets(ep)
      sbs.value = await episodeAPI.storyboards(ep.id)
      selectedSbIds.value = selectedSbIds.value.filter(id => sbs.value.some(sb => sb.id === id))
      if (sbs.value.length) {
        const currentSelectedId = selectedSb.value?.id
        selectedSb.value = sbs.value.find(sb => sb.id === currentSelectedId) || sbs.value[0]
      } else {
        selectedSb.value = null
      }

      const epHasContent = !!(episode.value?.content)
      const epHasScript = !!(episode.value?.script_content || episode.value?.scriptContent)

      if (panelRestored) {
        // 已恢复到上次所在步骤，跳过自动重置（仅首次加载生效）
        panelRestored = false
      } else if (epHasScript || epHasContent) scriptStep.value = 1
      else scriptStep.value = 0
    }
  } catch (e) {
    if (initial) { pageLoadError.value = e.message || '加载失败'; return }
    toast.error(e.message)
  } finally {
    if (initial) pageLoading.value = false
  }
  try { mergeData.value = await mergeAPI.status(epId.value) } catch {}
  // 成片列表加载已下沉 EpisodeExportPanel：面板挂载/切回时自取最新，refresh 仅以令牌通知刷新
  exportListRev.value++
  await loadGenTasks(initial)
}

function saveRaw() { episodeAPI.update(epId.value, { content: localRaw.value }); episode.value.content = localRaw.value }
function saveScr() { episodeAPI.update(epId.value, { script_content: localScript.value }); episode.value.script_content = localScript.value }
function doRewrite() { saveRaw(); runAgent('script_rewriter', '请读取剧本并改写为格式化剧本，然后保存', dramaId, epId.value, refresh, chatModelOverride(), chatConfigId()) }
function skipRewrite() {
  const raw = (localRaw.value || rawContent.value || '').trim()
  if (!raw) {
    toast.warning('请先填写原始内容')
    return
  }
  localScript.value = raw
  saveScr()
  toast.success('已跳过 AI 改写，当前将直接使用原始内容')
  panel.value = 'production'
  prodTab.value = 'assets'
}
// 资产提取：按类型独立的异步任务（后端任务表驱动），三类可并行；前端轮询状态直到完成
const EXTRACT_TARGETS = [
  { key: 'characters', label: '角色' },
  { key: 'scenes', label: '场景' },
  { key: 'props', label: '道具' },
]
const extractingTargets = ref([])
const extractingLabels = computed(() => EXTRACT_TARGETS.filter(t => extractingTargets.value.includes(t.key)).map(t => t.label).join('、'))
function isExtracting(target) { return extractingTargets.value.includes(target) }

function doExtract(target) {
  if (isExtracting(target) || !epId.value) return
  saveScr()
  extractingTargets.value.push(target)
  episodeAPI.extract(epId.value, target, chatModelOverride(), chatConfigId())
    .then(() => pollExtractStatus(target))
    .catch(e => {
      extractingTargets.value = extractingTargets.value.filter(t => t !== target)
      toast.error(e.message)
    })
}
function doExtractAll() { EXTRACT_TARGETS.forEach(t => doExtract(t.key)) }

function pollExtractStatus(target, attempts = 150) {
  const label = EXTRACT_TARGETS.find(t => t.key === target)?.label || target
  const tick = async (left) => {
    try {
      const st = await episodeAPI.extractStatus(epId.value)
      const task = st?.[target]
      if (task && task.status !== 'running') {
        extractingTargets.value = extractingTargets.value.filter(t => t !== target)
        if (task.status === 'done') {
          toast.success(`${label}提取完成`)
          await refresh()
        } else {
          toast.error(task.error || `${label}提取失败`)
        }
        return
      }
    } catch {}
    if (left > 0) setTimeout(() => tick(left - 1), 2500)
    else extractingTargets.value = extractingTargets.value.filter(t => t !== target)
  }
  setTimeout(() => tick(attempts), 2500)
}

/** 页面加载后恢复仍在运行的提取任务状态（刷新页面不丢进度展示） */
async function syncExtractStatus() {
  if (!epId.value) return
  try {
    const st = await episodeAPI.extractStatus(epId.value)
    for (const t of EXTRACT_TARGETS) {
      if (st?.[t.key]?.status === 'running' && !isExtracting(t.key)) {
        extractingTargets.value.push(t.key)
        pollExtractStatus(t.key)
      }
    }
  } catch {}
  try {
    const vp = await episodeAPI.videoPromptsStatus(epId.value)
    if (vp?.status === 'running' && !videoPromptBatch.value.running) {
      videoPromptBatch.value = { running: true, total: vp.total || 0, completed: vp.completed || 0 }
      pollVideoPromptBatch()
    }
  } catch {}
}

// ─── 批量视频提示词：后端异步逐分镜生成，前端轮询进度 ──────────
const videoPromptBatch = ref({ running: false, total: 0, completed: 0 })
// 单个视频提示词生成：按分镜 ID 跟踪，允许不同分镜并行生成（不走全局 rn 锁）
const videoPromptGeneratingIds = ref([])
// MiniMax H3 大模型提示词独立生成，不覆盖中文 video_prompt。
const minimaxH3PromptGeneratingIds = ref([])
// 分镜勾选：勾选后批量生成只处理所选（已有提示词也会重新生成）；未勾选时处理全部缺失
const selectedSbIds = ref([])
// 多选模式：进入后点击卡片=勾选/取消，底部操作条确认生成
const sbSelectMode = ref(false)
function isSbSelected(id) { return selectedSbIds.value.includes(id) }
function toggleSbSelect(id) {
  selectedSbIds.value = isSbSelected(id) ? selectedSbIds.value.filter(x => x !== id) : [...selectedSbIds.value, id]
}
function toggleSelectAllSbs() {
  selectedSbIds.value = selectedSbIds.value.length === sbs.value.length ? [] : sbs.value.map(sb => sb.id)
}
function onShotCardClick(sb) {
  if (sbSelectMode.value) toggleSbSelect(sb.id)
  else selectedSb.value = sb
}
// 仅缺失：选中还没有视频提示词的分镜
function selectMissingSbs() {
  selectedSbIds.value = sbs.value.filter(sb => !((sb.video_prompt || sb.videoPrompt || '').trim())).map(sb => sb.id)
}
function exitSbSelectMode() {
  sbSelectMode.value = false
  selectedSbIds.value = []
}
function generateSelectedVideoPrompts() {
  batchVideoPrompts() // 内部同步捕获所选 ids
  exitSbSelectMode()
}

async function batchVideoPrompts() {
  if (videoPromptBatch.value.running || !epId.value) return
  if (!sbs.value.length) { toast.warning('请先拆分分镜'); return }
  const ids = selectedSbIds.value.length ? [...selectedSbIds.value] : undefined
  try {
    const res = await episodeAPI.generateVideoPrompts(epId.value, chatModelOverride(), chatConfigId(), ids)
    if (!res?.total) {
      if (res?.already_running) {
        videoPromptBatch.value = { running: true, total: 0, completed: 0 }
        pollVideoPromptBatch()
      } else toast.info(ids ? '所选分镜不存在' : '所有分镜已有视频提示词')
      return
    }
    videoPromptBatch.value = { running: true, total: res.total, completed: 0 }
    toast.info(`开始生成 ${res.total} 个分镜的视频提示词…`)
    pollVideoPromptBatch()
  } catch (e) {
    toast.error(e.message)
  }
}

function pollVideoPromptBatch(attempts = 240) {
  const tick = async (left) => {
    try {
      const st = await episodeAPI.videoPromptsStatus(epId.value)
      if (st && st.status !== 'running') {
        videoPromptBatch.value = { running: false, total: 0, completed: 0 }
        await refresh()
        if (st.status === 'done') {
          toast.success(st.failed ? `视频提示词批量生成完成，${st.failed} 个失败` : '视频提示词批量生成完成')
        } else {
          toast.error(st.error || '视频提示词批量生成失败')
        }
        return
      }
      if (st) {
        const prev = videoPromptBatch.value.completed
        videoPromptBatch.value = { running: true, total: st.total || 0, completed: st.completed || 0 }
        if ((st.completed || 0) !== prev) await refresh() // 每完成一条刷新，提示词逐步出现
      }
    } catch {}
    if (left > 0) setTimeout(() => tick(left - 1), 2500)
    else videoPromptBatch.value = { running: false, total: 0, completed: 0 }
  }
  setTimeout(() => tick(attempts), 2500)
}
function doBreakdown() {
  const charList = chars.value.length
    ? chars.value.map(c => `${c.name}(ID:${c.id})`).join('、')
    : '（当前集还没有角色）'
  const sceneList = scenes.value.length
    ? scenes.value.map(s => `${s.location} · ${s.time || '未设时间'}(ID:${s.id})`).join('、')
    : '（当前集还没有场景）'
  const propList = propItems.value.length
    ? propItems.value.map(p => `${p.name}(ID:${p.id})`).join('、')
    : '（当前集还没有道具）'
  runAgent('storyboard_breaker', `请基于当前集剧本拆分分镜（不需要生成视频提示词，video_prompt 在视频生成阶段按需生成）。

当前集已有角色：${charList}
当前集已有场景：${sceneList}
当前集已有道具：${propList}

绑定要求：
- 每个镜头必须根据剧本内容，从上述当前集已有角色中选出出场的角色绑定 character_ids（ID 必须来自上述列表；有角色出场就必须绑定，不要遗漏）
- 每个镜头尽量匹配上述已有场景填写 scene_id（ID 必须来自上述列表），不要凭空创造新场景
- 每个镜头出现关键道具（被使用、交接、特写或在画面中明显可见）时，从上述当前集已有道具中绑定 prop_ids（ID 必须来自上述列表）；没有道具出现可传空数组
- 只有纯环境空镜头才可以不绑定角色`, dramaId, epId.value, refresh, chatModelOverride(), chatConfigId())
}

// 按需为单个分镜生成视频提示词：由 prompt_generator 读取分镜字段生成并保存到 video_prompt
async function genVideoPrompt(sb) {
  if (!sb || videoPromptGeneratingIds.value.includes(sb.id)) return
  const idx = sbs.value.indexOf(sb) + 1
  const cfg = videoConfigs.value.find(c => c.id === lockedVideoConfigId.value)
  const label = cfg ? `${cfg.name} (${cfg.provider})` : '默认'
  const charNames = getStoryboardCharacters(sb).map(c => c.name).join('、') || '无'
  const propNames = getStoryboardProps(sb).map(p => p.name).join('、') || '无'
  videoPromptGeneratingIds.value.push(sb.id)
  try {
    await api.post(`/agent/prompt_generator/chat`, {
      message: `请为分镜 #${idx}(ID:${sb.id})生成视频提示词(video_prompt)。视频模型:${label},请根据该模型的特性和时长限制生成。

该分镜信息:时长 ${sb.duration || 10}s;场景:${getSceneName(sb) || '未绑定'};角色:${charNames};道具:${propNames}。

请先调用 read_storyboard_context 获取该分镜的画面描述(含【镜头N】子镜头与台词/旁白)、氛围及时长,据此生成 video_prompt(按 3 秒分段换行、用 @角色名/@场景名/@道具名 引用参考素材；段落内允许多镜头切镜,但不跨场景,切镜点对齐 description 的【镜头N】结构),然后调用 update_storyboard 保存到分镜 ID:${sb.id}。只更新 video_prompt 字段,不要改动其他字段,不要重新拆分整集。`,
      drama_id: dramaId,
      episode_id: epId.value,
      model: chatModelOverride() || undefined,
      config_id: chatConfigId() || undefined,
    })
    toast.success(`分镜 #${idx} 视频提示词已生成`)
    await refresh()
  } catch (e) {
    toast.error(e.message)
  } finally {
    videoPromptGeneratingIds.value = videoPromptGeneratingIds.value.filter(id => id !== sb.id)
  }
}

function buildMinimaxH3ReferencePlan(sb) {
  const images = getShotReferenceImages(sb)
  const videos = [...videoRefVideoUrls.value]
  const audios = [...videoRefAudioUrls.value]
  const knownImages = []
  const remember = (url, role) => {
    const normalized = normalizeMediaUrl(url)
    if (normalized && !knownImages.some(item => item.url === normalized)) knownImages.push({ url: normalized, role })
  }
  const scene = getStoryboardScene(sb)
  remember(scene?.image_url || scene?.imageUrl, `场景设定图：${scene?.location || '未命名场景'}`)
  for (const char of getStoryboardCharacters(sb)) remember(char.image_url || char.imageUrl, `角色设定图：${char.name}`)
  for (const prop of getStoryboardProps(sb)) remember(prop.image_url || prop.imageUrl, `道具设定图：${prop.name}`)

  const firstFrame = normalizeMediaUrl(sb?.first_frame_image || sb?.firstFrameImage || '')
  const mode = images.length === 0 && videos.length === 0 && audios.length === 0
    ? 'T2VA'
    : images.length === 1 && videos.length === 0 && audios.length === 0 && firstFrame && firstFrame === images[0]
      ? 'I2VA'
      : 'Ref2VA'
  const imageLines = images.map((url, index) => {
    const known = knownImages.find(item => item.url === url)
    const role = firstFrame && firstFrame === url ? '0.00 秒首帧' : known?.role || '用户从本地或资产库选择的补充参考图'
    return `<Picture ${index + 1}>：${role}`
  })
  const videoLines = videos.map((_, index) => `<Video ${index + 1}>：用户选择的参考视频`)
  const audioLines = audios.map((_, index) => `<Audio ${index + 1}>：用户选择的参考音频；除非中文提示词明确要求原音复用，否则作为声音参考`)
  return {
    mode,
    lines: [...imageLines, ...videoLines, ...audioLines],
  }
}

async function genMinimaxH3Prompt(sb) {
  if (!sb || minimaxH3PromptGeneratingIds.value.includes(sb.id)) return
  const sourcePrompt = String(sb.video_prompt || sb.videoPrompt || '').trim()
  if (!sourcePrompt) {
    toast.info('请先生成或填写中文版视频提示词')
    return
  }
  const idx = sbs.value.indexOf(sb) + 1
  const referencePlan = buildMinimaxH3ReferencePlan(sb)
  minimaxH3PromptGeneratingIds.value.push(sb.id)
  try {
    // 最新参考素材可能还在排队写入 MySQL：先等保存队列清空，
    // 否则 H3 会基于旧素材生成，刚保存的参考图没有进入 H3 的输入。
    await flushShotRefSaves(sb.id)
    await api.post('/agent/minimax_h3_prompt_generator/chat', {
      message: `请为分镜 #${idx}(ID:${sb.id})生成并保存 MiniMax H3 大模型提示词(minimax_h3_prompt)。

目标视频时长：${Number(sb.duration || 10)} 秒
输入模式：${referencePlan.mode}
实际提交给视频工作流的参考素材顺序：
${referencePlan.lines.length ? referencePlan.lines.join('\n') : '无参考素材'}

请调用 read_storyboard_context 读取该分镜。以已有中文 video_prompt 为镜头、动作、台词和声音的优先事实源，description 与 atmosphere 用于补足细节；严格按照 h3-prompt-writing Skill 的字段名、字段顺序、时间格式和引用标签写成英文结构，对白、旁白和画面文字保持中文原文。最后调用 save_minimax_h3_prompt，仅保存 storyboard_id:${sb.id} 与 minimax_h3_prompt，不得覆盖 video_prompt 或其他字段。`,
      drama_id: dramaId,
      episode_id: epId.value,
      model: chatModelOverride() || undefined,
      config_id: chatConfigId() || undefined,
    })
    toast.success(`分镜 #${idx} MiniMax H3 提示词已生成`)
    await refresh()
  } catch (e) {
    toast.error(e.message)
  } finally {
    minimaxH3PromptGeneratingIds.value = minimaxH3PromptGeneratingIds.value.filter(id => id !== sb.id)
  }
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

function watchAsyncResult(check, attempts = 24, delay = 2500) {
  void (async () => {
    for (let i = 0; i < attempts; i++) {
      await sleep(delay)
      await refresh()
      if (check()) return
    }
  })()
}

async function genCharImg(id) {
  try {
    if (!isPendingCharImage(id)) pendingCharImageIds.value.push(id)
    const char = chars.value.find(c => c.id === id)
    if (char && !(char.final_prompt || char.finalPrompt)) {
      toast.info('正在生成最终提示词…')
      try {
        await ensureAssetPrompt('character', id)
      } catch {} // 提示词生成失败不阻断：后端生图前会再兜底生成或回退本地拼接
    }
    await characterAPI.generateImage(id, epId.value, bareModelName(imageModel.value) || undefined, ownerConfigId(imageModelOptions.value, imageModel.value), chatModelOverride(), chatConfigId())
    toast.success('角色图片生成中')
    await refresh()
    watchAsyncResult(() => {
      const char = chars.value.find(c => c.id === id)
      const done = !!(char?.image_url || char?.imageUrl)
      if (done) pendingCharImageIds.value = pendingCharImageIds.value.filter(item => item !== id)
      return done
    })
  } catch (e) {
    pendingCharImageIds.value = pendingCharImageIds.value.filter(item => item !== id)
    toast.error(e.message)
  }
}
function batchCharImages() {
  const ids = visualChars.value.filter(c => !(c.image_url || c.imageUrl)).map(c => c.id)
  if (!ids.length) { toast.info('所有角色图片已生成'); return }
  pendingCharImageIds.value = [...new Set([...pendingCharImageIds.value, ...ids])]
  characterAPI.batchImages(ids, epId.value, bareModelName(imageModel.value) || undefined, ownerConfigId(imageModelOptions.value, imageModel.value), chatModelOverride(), chatConfigId()).then(async () => {
    toast.success('角色图片批量生成中')
    await refresh()
    watchAsyncResult(() => ids.every(id => {
      const char = chars.value.find(c => c.id === id)
      const done = !!(char?.image_url || char?.imageUrl)
      if (done) pendingCharImageIds.value = pendingCharImageIds.value.filter(item => item !== id)
      return done
    }), 36)
  }).catch(e => {
    pendingCharImageIds.value = pendingCharImageIds.value.filter(item => !ids.includes(item))
    toast.error(e.message)
  })
}
async function genSceneImg(id) {
  try {
    if (!isPendingSceneImage(id)) pendingSceneImageIds.value.push(id)
    const scene = scenes.value.find(s => s.id === id)
    if (scene && !(scene.final_prompt || scene.finalPrompt)) {
      toast.info('正在生成最终提示词…')
      try {
        await ensureAssetPrompt('scene', id)
      } catch {} // 提示词生成失败不阻断：后端生图前会再兜底生成或回退本地拼接
    }
    await sceneAPI.generateImage(id, epId.value, bareModelName(imageModel.value) || undefined, ownerConfigId(imageModelOptions.value, imageModel.value), chatModelOverride(), chatConfigId())
    toast.success('场景图片生成中')
    await refresh()
    watchAsyncResult(() => {
      const scene = scenes.value.find(s => s.id === id)
      const done = !!(scene?.image_url || scene?.imageUrl)
      if (done) pendingSceneImageIds.value = pendingSceneImageIds.value.filter(item => item !== id)
      return done
    })
  } catch (e) {
    pendingSceneImageIds.value = pendingSceneImageIds.value.filter(item => item !== id)
    toast.error(e.message)
  }
}
function isPendingPropImage(id) {
  return pendingPropImageIds.value.includes(id)
}
async function genPropImg(id) {
  try {
    if (!isPendingPropImage(id)) pendingPropImageIds.value.push(id)
    const prop = propItems.value.find(p => p.id === id)
    if (prop && !(prop.final_prompt || prop.finalPrompt)) {
      toast.info('正在生成最终提示词…')
      try {
        await ensureAssetPrompt('prop', id)
      } catch {} // 提示词生成失败不阻断：后端生图前会再兜底生成或回退本地拼接
    }
    await propAPI.generateImage(id, epId.value, bareModelName(imageModel.value) || undefined, ownerConfigId(imageModelOptions.value, imageModel.value), chatModelOverride(), chatConfigId())
    toast.success('道具图片生成中')
    await refresh()
    watchAsyncResult(() => {
      const prop = propItems.value.find(p => p.id === id)
      const done = !!(prop?.image_url || prop?.imageUrl)
      if (done) pendingPropImageIds.value = pendingPropImageIds.value.filter(item => item !== id)
      return done
    })
  } catch (e) {
    pendingPropImageIds.value = pendingPropImageIds.value.filter(item => item !== id)
    toast.error(e.message)
  }
}
function batchSceneImages() {
  const ids = scenes.value.filter(s => !(s.image_url || s.imageUrl)).map(s => s.id)
  if (!ids.length) { toast.info('所有场景图片已生成'); return }
  pendingSceneImageIds.value = [...new Set([...pendingSceneImageIds.value, ...ids])]
  ids.forEach(id => { sceneAPI.generateImage(id, epId.value, bareModelName(imageModel.value) || undefined, ownerConfigId(imageModelOptions.value, imageModel.value), chatModelOverride(), chatConfigId()).then(() => refresh()).catch(e => toast.error(e.message)) })
  toast.success('场景图片批量生成中')
  watchAsyncResult(() => ids.every(id => {
    const scene = scenes.value.find(s => s.id === id)
    const done = !!(scene?.image_url || scene?.imageUrl)
    if (done) pendingSceneImageIds.value = pendingSceneImageIds.value.filter(item => item !== id)
    return done
  }), 36)
}
function batchPropImages() {
  const ids = propItems.value.filter(p => !(p.image_url || p.imageUrl)).map(p => p.id)
  if (!ids.length) { toast.info('所有道具图片已生成'); return }
  pendingPropImageIds.value = [...new Set([...pendingPropImageIds.value, ...ids])]
  ids.forEach(id => { propAPI.generateImage(id, epId.value, bareModelName(imageModel.value) || undefined, ownerConfigId(imageModelOptions.value, imageModel.value), chatModelOverride(), chatConfigId()).then(() => refresh()).catch(e => toast.error(e.message)) })
  toast.success('道具图片批量生成中')
  watchAsyncResult(() => ids.every(id => {
    const prop = propItems.value.find(p => p.id === id)
    const done = !!(prop?.image_url || prop?.imageUrl)
    if (done) pendingPropImageIds.value = pendingPropImageIds.value.filter(item => item !== id)
    return done
  }), 36)
}
function getVideoUrl(s) { return s?.video_url || s?.videoUrl || s?.composed_video_url || s?.composedVideoUrl || null }
function hasVid(s) { return !!getVideoUrl(s) }

// ===== 分镜视频历史（一个分镜可能生成多个视频,sys_task 留存全部记录）=====
const sbVideoHistory = ref([])
const previewVideoUrl = ref('') // 正在预览的历史视频(相对路径);空 = 预览当前主视频
const sbVideoHistoryError = ref('')

// 注意:/tasks 返回原始行(camelCase),/episodes/:id/generation-tasks 返回 snake_case,两种命名都兼容
function taskVideoPath(t) { return t?.local_path || t?.localPath || t?.result_url || t?.resultUrl || '' }
function taskCreatedAt(t) { return t?.created_at || t?.createdAt || '' }
function isCurrentVideo(t) { const p = taskVideoPath(t); return !!p && p === getVideoUrl(selectedSb.value) }

async function loadSbVideoHistory() {
  previewVideoUrl.value = ''
  if (!selectedSb.value?.id) { sbVideoHistory.value = []; sbVideoHistoryError.value = ''; return }
  try {
    const rows = await taskAPI.list({ type: 'video', storyboard_id: selectedSb.value.id })
    sbVideoHistory.value = (Array.isArray(rows) ? rows : [])
      .filter(t => t.status === 'completed' && taskVideoPath(t))
      .sort((a, b) => taskCreatedAt(b).localeCompare(taskCreatedAt(a)))
    sbVideoHistoryError.value = ''
  } catch (e) {
    // 刷新失败保留上一份成功数据，仅提示可重试（不置空，避免误读为「没有历史」）
    sbVideoHistoryError.value = e.message || '历史记录加载失败'
  }
}

watch(() => [selectedSb.value?.id, getVideoUrl(selectedSb.value)], () => { loadSbVideoHistory() })

function previewHistoryVideo(t) {
  previewVideoUrl.value = isCurrentVideo(t) ? '' : taskVideoPath(t)
}

async function setAsMainVideo() {
  const sb = selectedSb.value
  if (!sb || !previewVideoUrl.value) return
  try {
    await storyboardAPI.update(sb.id, { video_url: previewVideoUrl.value })
    sb.video_url = previewVideoUrl.value
    sb.videoUrl = previewVideoUrl.value
    toast.success('已设为主视频')
  } catch (e) { toast.error(e.message || '设置失败') }
}

async function removeHistoryVideo(t) {
  try {
    await taskAPI.del(t.id)
    sbVideoHistory.value = sbVideoHistory.value.filter(x => x.id !== t.id)
    if (previewVideoUrl.value === taskVideoPath(t)) previewVideoUrl.value = ''
    toast.success('已删除该历史记录')
  } catch (e) { toast.error(e.message || '删除失败') }
}

function formatHistoryTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const p = n => String(n).padStart(2, '0')
  return `${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

function getShotReferenceImages(sb) {
  const refs = []
  const pushRef = (value) => {
    const normalized = normalizeMediaUrl(value)
    if (!normalized || refs.includes(normalized) || refs.length >= 9) return
    refs.push(normalized)
  }
  const scene = getStoryboardScene(sb)
  pushRef(scene?.image_url || scene?.imageUrl)
  for (const char of getStoryboardCharacters(sb)) {
    pushRef(char?.image_url || char?.imageUrl)
  }
  for (const prop of getStoryboardProps(sb)) {
    pushRef(prop?.image_url || prop?.imageUrl)
  }
  // 手动上传的参考图片追加到尾部（总计 ≤9）
  for (const url of videoRefImageUrls.value) pushRef(url)
  return refs
}

function getShotReferenceAssets(sb) {
  const assets = []
  const scene = getStoryboardScene(sb)
  if (scene) {
    const imageUrl = scene.image_url || scene.imageUrl || ''
    assets.push({
      key: `scene-${scene.id}`,
      type: '场景',
      name: scene.location || '未命名场景',
      meta: scene.time || '场景图',
      imageUrl,
      ready: !!imageUrl,
    })
  }
  for (const char of getStoryboardCharacters(sb)) {
    const imageUrl = char.image_url || char.imageUrl || ''
    assets.push({
      key: `character-${char.id}`,
      type: '角色',
      name: char.name || '未命名角色',
      meta: char.role || '角色形象',
      imageUrl,
      ready: !!imageUrl,
    })
  }
  for (const prop of getStoryboardProps(sb)) {
    const imageUrl = prop.image_url || prop.imageUrl || ''
    assets.push({
      key: `prop-${prop.id}`,
      type: '道具',
      name: prop.name || '未命名道具',
      meta: prop.type || '道具单品图',
      imageUrl,
      ready: !!imageUrl,
    })
  }
  return assets.slice(0, 6)
}

// 右侧参考素材面板：本集全部可绑定素材（场景单选、角色/道具多选），bound 标记是否已绑定
function shotBindableAssets(sb) {
  const out = []
  for (const char of visualChars.value) {
    const imageUrl = char.image_url || char.imageUrl || ''
    out.push({
      key: `character-${char.id}`,
      id: char.id,
      type: '角色',
      name: char.name || '未命名角色',
      meta: char.role || '角色形象',
      imageUrl,
      ready: !!imageUrl,
      bound: getStoryboardCharacterIds(sb).includes(char.id),
    })
  }
  for (const scene of scenes.value) {
    const imageUrl = scene.image_url || scene.imageUrl || ''
    out.push({
      key: `scene-${scene.id}`,
      id: scene.id,
      type: '场景',
      name: `${scene.location} · ${scene.time || '未设时间'}`,
      meta: scene.time || '场景图',
      imageUrl,
      ready: !!imageUrl,
      bound: (sb?.scene_id || sb?.sceneId) === scene.id,
    })
  }
  for (const prop of propItems.value) {
    const imageUrl = prop.image_url || prop.imageUrl || ''
    out.push({
      key: `prop-${prop.id}`,
      id: prop.id,
      type: '道具',
      name: prop.name || '未命名道具',
      meta: prop.type || '道具单品图',
      imageUrl,
      ready: !!imageUrl,
      bound: getStoryboardPropIds(sb).includes(prop.id),
    })
  }
  // 固定顺序（角色→场景→道具，按资产原顺序）：点击绑定/解绑不重排，避免跳动
  return out
}

// 右侧参考素材面板渲染用：当前分镜可绑定的全部素材
const refBindableAssets = computed(() => {
  const sb = selectedSb.value
  return sb ? shotBindableAssets(sb) : []
})

// 右侧面板切换绑定：场景单选（切换/解绑），角色/道具多选
function toggleShotBind(sb, asset) {
  if (asset.type === '场景') {
    const current = sb?.scene_id || sb?.sceneId
    updateField(sb, 'scene_id', current === asset.id ? null : asset.id)
    return
  }
  if (asset.type === '角色') {
    toggleStoryboardCharacter(sb, asset.id)
    return
  }
  toggleStoryboardProp(sb, asset.id)
}

// 已占用的参考图片数（只统计真实存在且已去重的图片）
const refImageUsedCount = computed(() => selectedSb.value ? getShotReferenceImages(selectedSb.value).length : 0)
// 是否已达 9 张上限（禁用继续上传）
const refImageFull = computed(() => refImageUsedCount.value >= 9)

// 视频提示词 @ 引用候选：仅当前分镜已绑定的角色与道具（按名字引用）、场景（按地点引用），展示顺序：角色 → 场景 → 道具
const mentionOptions = computed(() => {
  const sb = selectedSb.value
  if (!sb) return []
  const scene = getStoryboardScene(sb)
  return [
    ...getStoryboardCharacters(sb).map(c => ({
      label: c.name,
      value: c.name,
      group: '角色',
      image: thumbOf(assetImageSrc(c)),
    })),
    ...(scene ? [{
      label: `${scene.location} · ${scene.time || '未设时间'}`,
      value: scene.location,
      group: '场景',
      image: thumbOf(assetImageSrc(scene)),
    }] : []),
    ...getStoryboardProps(sb).map(p => ({
      label: p.name,
      value: p.name,
      group: '道具',
      image: thumbOf(assetImageSrc(p)),
    })),
  ]
})

// 按参考图顺序（场景图在前、角色图居中、道具图在后）为 @名字 建立索引映射，供视频提示词引用替换
function getShotReferenceIndexMap(sb) {
  const ordered = []
  const seen = new Set()
  const push = (name, url) => {
    if (!url || seen.has(url) || ordered.length >= 9) return
    seen.add(url)
    ordered.push({ name, imageUrl: url })
  }
  const scene = getStoryboardScene(sb)
  push(scene?.location || '', scene?.image_url || scene?.imageUrl)
  for (const char of getStoryboardCharacters(sb)) {
    push(char.name || '', char?.image_url || char?.imageUrl)
  }
  for (const prop of getStoryboardProps(sb)) {
    push(prop.name || '', prop?.image_url || prop?.imageUrl)
  }
  const nameToIndex = {}
  ordered.forEach((a, i) => { if (a.name && !(a.name in nameToIndex)) nameToIndex[a.name] = i + 1 })
  return nameToIndex
}

// 将视频提示词里的 @名字 替换为 @图片N名字（N 为参考图序号，1 起），生成时使用
function resolveVideoPromptRefs(sb) {
  const prompt = sb.video_prompt || sb.videoPrompt || ''
  const map = getShotReferenceIndexMap(sb)
  const names = Object.keys(map).sort((a, b) => b.length - a.length)
  if (!names.length) return prompt
  return prompt.replace(/@([^\s@]+)/g, (m, raw) => {
    for (const name of names) {
      if (raw.startsWith(name)) {
        return `@图片${map[name]}${name}${raw.slice(name.length)}`
      }
    }
    return m
  })
}

function rememberRefAssetOrigin(url, assetId) {
  if (!url || assetId == null) return
  refAssetOrigins.value = { ...refAssetOrigins.value, [url]: Number(assetId) }
}

function buildShotRefItems() {
  const withOrigin = (urls, mediaType) => urls.map((url, index) => ({
    media_type: mediaType,
    media_role: 'reference',
    url,
    sort_order: index,
    asset_id: refAssetOrigins.value[url] ?? null,
  }))
  return [
    ...withOrigin(videoRefImageUrls.value, 'image'),
    ...withOrigin(videoRefVideoUrls.value, 'video'),
    ...withOrigin(videoRefAudioUrls.value, 'audio'),
  ]
}

/** 参考素材内容签名：类型、顺序、URL 全部一致才算没有变化 */
function shotRefSignature(items) {
  return JSON.stringify(items.map(item => [item.media_type, item.url]))
}

/**
 * 保存分镜的参考素材选择。返回 Promise 便于调用方感知保存结果。
 * 内容捕获是同步的（关键：排队执行时状态可能已切换到别的分镜或继续更新过）；
 * 真正的 HTTP 请求按分镜串行执行，快速连续选择不会乱序覆盖。
 */
function saveShotRefSelection(storyboardId = selectedSb.value?.id) {
  if (!storyboardId || restoringShotRefSelection) return Promise.resolve()
  // 关键：同步捕获当前内容。排队执行时状态可能已经切换到别的分镜或继续更新过。
  const items = buildShotRefItems()
  const key = String(storyboardId)
  const signature = shotRefSignature(items)
  // 与上次成功写入的内容完全一致：无需重复提交。
  // 页面刷新、切换分镜恢复状态都会用同一份内容重复提交，
  // 无差别回写会让后端误判参考素材变化，刚生成的 H3 提示词立刻被标记过期。
  if (lastSavedShotRefSelections.value[key] === signature) return Promise.resolve()
  // 已有相同内容的保存在排队/执行中：不重复入队，但必须返回那条队列任务，
  // 让「生成 H3 / 提交视频」前的 flush 能等到它真正写完，而不是立即放行。
  if (shotRefPendingSignatures[key] === signature) {
    return shotRefSaveQueues[key] || Promise.resolve()
  }

  shotRefPendingSignatures[key] = signature
  storedShotRefSelections.value[key] = {
    image: [...videoRefImageUrls.value], video: [...videoRefVideoUrls.value], audio: [...videoRefAudioUrls.value],
  }
  try { localStorage.setItem(REF_SELECTION_STORE_KEY, JSON.stringify(storedShotRefSelections.value)) } catch { /* ignore */ }

  // 排队：同一分镜的请求永远按入队顺序依次执行，后面的保存排在前面的结果之后。
  // 队列本身不因单次失败中断（后面的保存可能带最新状态），
  // 但失败必须记录到 shotRefLastErrors，由 flushShotRefSaves 抛出并中止生成。
  const run = (shotRefSaveQueues[key] || Promise.resolve())
    .then(() => performShotRefSave(storyboardId, { items, signature }))
    .catch((error) => { shotRefLastErrors[key] = error })
  const settle = () => {
    if (shotRefSaveQueues[key] === run) shotRefSaveQueues[key] = null
    if (shotRefPendingSignatures[key] === signature) delete shotRefPendingSignatures[key]
  }
  run.then(settle)
  shotRefSaveQueues[key] = run
  return run
}

/**
 * 等待某分镜的参考素材保存队列完全清空。
 * 用于「生成 H3 提示词 / 提交视频」之前：最新素材可能还在排队写入 MySQL，
 * 不等队列就读取会拿到旧素材——H3 校验通过，但视频实际携带前端最新参考图。
 * 任一保存失败则抛出错误，调用方必须中止生成。
 */
async function flushShotRefSaves(storyboardId) {
  const key = String(storyboardId)
  while (shotRefSaveQueues[key]) {
    await shotRefSaveQueues[key]
  }
  if (shotRefLastErrors[key]) {
    const error = shotRefLastErrors[key]
    delete shotRefLastErrors[key]
    throw error
  }
}

/** 实际的参考素材保存请求，只由 saveShotRefSelection 排入的串行队列调用。 */
async function performShotRefSave(storyboardId, { items, signature }) {
  const key = String(storyboardId)
  // 执行到自己时内容可能已由队列中更靠后的保存写入，或已被更新的保存覆盖
  if (lastSavedShotRefSelections.value[key] === signature) return
  // MySQL 是正式状态，localStorage 只是请求失败时的回退。
  // 保存失败必须让调用方感知并中止生成：队列的 catch 会记录到 shotRefLastErrors，
  // 生成 H3 / 提交视频前的 flushShotRefSaves 读取后抛出，不能只弹提示后继续。
  try {
    await storyboardAPI.saveReferenceAssets(storyboardId, items)
    lastSavedShotRefSelections.value = { ...lastSavedShotRefSelections.value, [key]: signature }
  } catch (error) {
    toast.error(`参考素材保存失败：${error.message || '请重试'}`)
    throw new Error(`参考素材保存失败：${error.message || '请重试'}`)
  }
}

async function restoreShotRefSelection(sb) {
  const saved = storedShotRefSelections.value[String(sb?.id)] || {}
  const cachedSource = {
    image: Array.isArray(saved.image) ? saved.image : [],
    video: Array.isArray(saved.video) ? saved.video : [],
    audio: Array.isArray(saved.audio) ? saved.audio : [],
  }
  let source = cachedSource

  if (sb?.id) {
    try {
      const durable = await storyboardAPI.referenceAssets(sb.id) || []
      // 请求成功即代表正式状态：返回空数组就是「确实没有参考素材」，
      // 不能回退本地缓存，否则用户清空的素材会被旧缓存复活并写回数据库。
      source = {
        image: durable.filter(item => item.media_type === 'image').sort((a, b) => a.sort_order - b.sort_order).map(item => item.url),
        video: durable.filter(item => item.media_type === 'video').sort((a, b) => a.sort_order - b.sort_order).map(item => item.url),
        audio: durable.filter(item => item.media_type === 'audio').sort((a, b) => a.sort_order - b.sort_order).map(item => item.url),
      }
      const origins = { ...refAssetOrigins.value }
      for (const item of durable) if (item.asset_id) origins[item.url] = Number(item.asset_id)
      refAssetOrigins.value = origins
    } catch {
      // 只有请求失败才回退到浏览器缓存
      source = cachedSource
    }
  }

  restoringShotRefSelection = true
  videoRefVideoUrls.value = [...source.video]
  videoRefAudioUrls.value = [...source.audio]
  videoRefImageUrls.value = [...source.image]
  videoDuration.value = Number(sb?.duration || 10)
  // 恢复结果就是数据库当前状态：先记下签名，再让 deep watcher 在本帧内跑完，
  // 保证「恢复状态」本身不会触发一次回写。
  if (sb?.id) {
    lastSavedShotRefSelections.value = {
      ...lastSavedShotRefSelections.value,
      [String(sb.id)]: shotRefSignature(buildShotRefItems()),
    }
  }
  await nextTick()
  restoringShotRefSelection = false
}

// 每个分镜独立记住已绑定的参考素材，切换分镜或刷新页面后无需重复选择。
watch(selectedSb, async (sb, previousSb) => {
  if (previousSb?.id) saveShotRefSelection(previousSb.id)
  await restoreShotRefSelection(sb)
})

watch(
  [videoRefImageUrls, videoRefVideoUrls, videoRefAudioUrls],
  () => saveShotRefSelection(),
  { deep: true },
)

function pickFile(accept, cb) {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = accept
  input.onchange = () => { const f = input.files?.[0]; if (f) cb(f) }
  input.click()
}

// ===== 资产图片手动上传（角色形象 / 场景图 / 道具图）=====
const ASSET_UPLOAD_LABELS = { character: '角色形象', scene: '场景图', prop: '道具图' }
const uploadingAssetKeys = ref([])
function isUploadingAsset(kind, id) { return uploadingAssetKeys.value.includes(`${kind}:${id}`) }
function uploadAssetImage(kind, id) {
  pickFile('image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp', async (file) => {
    const key = `${kind}:${id}`
    if (!uploadingAssetKeys.value.includes(key)) uploadingAssetKeys.value.push(key)
    try {
      const res = await uploadAPI.image(file)
      // 与生图回写保持一致：存相对路径（static/...），前端展示时补前导斜杠
      const payload = { image_url: res.path, local_path: res.path }
      if (kind === 'character') await characterAPI.update(id, payload)
      else if (kind === 'scene') await sceneAPI.update(id, payload)
      else await propAPI.update(id, payload)
      toast.success(`${ASSET_UPLOAD_LABELS[kind]}已上传`)
      await refresh()
    } catch (e) {
      toast.error(e.message)
    } finally {
      uploadingAssetKeys.value = uploadingAssetKeys.value.filter(k => k !== key)
    }
  })
}

function uploadRefMedia(kind) {
  const libraryMeta = {
    save_to_library: 1,
    drama_id: dramaId,
    episode_id: epId.value,
    storyboard_id: selectedSb.value?.id,
    category: 'reference',
  }
  if (kind === 'image') {
    if (refImageFull.value) { toast.info('参考图片已达上限（含场景/角色素材）'); return }
    pickFile('image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp', async (file) => {
      uploadingRefMedia.value = true
      try {
        const res = await uploadAPI.image(file, libraryMeta)
        videoRefImageUrls.value = [...videoRefImageUrls.value, res.url]
        rememberRefAssetOrigin(res.url, res.asset_id)
        await loadRefAssetLibrary()
        toast.success('参考图片已上传')
      } catch (e) { toast.error(e.message) } finally { uploadingRefMedia.value = false }
    })
    return
  }
  const isVideo = kind === 'video'
  const list = isVideo ? videoRefVideoUrls : videoRefAudioUrls
  const label = isVideo ? '视频' : '音频'
  if (list.value.length >= 3) { toast.info(`参考${label}最多 3 个`); return }
  const accept = isVideo ? 'video/mp4,video/quicktime,video/webm,.m4v' : 'audio/mpeg,audio/wav,audio/mp4,audio/flac,.aac,.flac'
  pickFile(accept, async (file) => {
    uploadingRefMedia.value = true
    try {
      const res = isVideo ? await uploadAPI.video(file, libraryMeta) : await uploadAPI.audio(file, libraryMeta)
      list.value = [...list.value, res.url]
      rememberRefAssetOrigin(res.url, res.asset_id)
      await loadRefAssetLibrary()
      toast.success(`参考${label}已上传`)
    } catch (e) { toast.error(e.message) } finally { uploadingRefMedia.value = false }
  })
}

function removeRefMedia(kind, index) {
  const list = kind === 'image' ? videoRefImageUrls : kind === 'video' ? videoRefVideoUrls : videoRefAudioUrls
  list.value = list.value.filter((_, i) => i !== index)
}

async function genVid(sb) {
  const referenceImages = getShotReferenceImages(sb)
  const h3Prompt = String(sb.minimax_h3_prompt || sb.minimaxH3Prompt || '').trim()
  const h3SourceHash = String(sb.minimax_h3_source_hash || sb.minimaxH3SourceHash || '').trim()
  const h3Provider = ['autodl', 'minimax'].includes(selectedVideoProvider.value)
  // H3 已被标记过期（来源哈希被清空）时禁止直接用于生成：
  // 分镜内容或参考素材已变化，旧提示词不再代表当前投产输入。
  // 服务端提交时还会重算指纹兜底，前端拦截只为了尽早提示用户。
  if (h3Provider && h3Prompt && !h3SourceHash) {
    toast.error('H3 提示词可能已过期（分镜内容或参考素材已变化），请重新生成 H3 后再提交视频')
    return
  }
  try {
    // 最新参考素材可能还在排队写入 MySQL：必须先等保存队列清空，
    // 否则后端读到的仍是旧素材——H3 校验通过，但视频实际携带前端最新参考图。
    // 保存失败（flushShotRefSaves 抛出）同样中止生成。
    await flushShotRefSaves(sb.id)
  } catch (e) {
    toast.error(e.message)
    return
  }
  const useH3Prompt = h3Provider && !!h3Prompt
  const params = {
    storyboard_id: sb.id,
    drama_id: dramaId,
    prompt: useH3Prompt ? h3Prompt : resolveVideoPromptRefs(sb),
    duration: Number(videoDuration.value || sb.duration || 10),
    aspect_ratio: dramaAspectRatio.value,
    generate_audio: true,
    model: bareModelName(videoModel.value) || undefined,
    config_id: ownerConfigId(videoModelOptions.value, videoModel.value),
    reference_image_urls: referenceImages,
    reference_video_urls: videoRefVideoUrls.value,
    reference_audio_urls: videoRefAudioUrls.value,
    reference_snapshot: {
      images: [...referenceImages],
      videos: [...videoRefVideoUrls.value],
      audios: [...videoRefAudioUrls.value],
      // 额外参考图（手动选择/上传）单独列出，随快照落库供追溯。
      // 注意：H3 一致性校验不读取本字段——服务端会按分镜绑定与数据库
      // 额外素材重建完整参考列表，与实际的 reference_*_urls 逐项比较，
      // 客户端快照一律不被信任。
      extra_images: [...videoRefImageUrls.value],
      generated_at: new Date().toISOString(),
    },
  }
  if (params.reference_audio_urls.length && !referenceImages.length && !params.reference_video_urls.length) {
    toast.error('参考音频需要至少 1 个参考图片或视频')
    return
  }
  if (!params.prompt && !referenceImages.length && !params.reference_video_urls.length && !params.reference_audio_urls.length) {
    toast.error('需要至少一个参考素材或视频提示词')
    return
  }
  try {
    delete failedVideoMessages.value[sb.id]
    if (!isPendingVideo(sb.id)) pendingVideoIds.value.push(sb.id)
    const generation = await taskAPI.generate({ type: 'video', ...params })
    toast.success('视频生成中')
    await refresh()
    pollVideoGeneration(generation?.id, sb.id)
  } catch (e) {
    pendingVideoIds.value = pendingVideoIds.value.filter(item => item !== sb.id)
    failedVideoMessages.value = {
      ...failedVideoMessages.value,
      [sb.id]: e.message || '视频生成失败',
    }
    toast.error(e.message)
  }
}
async function pollVideoGeneration(generationId, storyboardId) {
  if (!generationId) {
    watchAsyncResult(() => {
      const target = sbs.value.find(s => s.id === storyboardId)
      const done = !!(target?.video_url || target?.videoUrl)
      if (done) pendingVideoIds.value = pendingVideoIds.value.filter(item => item !== storyboardId)
      return done
    }, 60, 4000)
    return
  }
  for (let i = 0; i < 120; i++) {
    await sleep(4000)
    try {
      const res = await taskAPI.get(generationId)
      await refresh()
      if (res?.status === 'completed') {
        pendingVideoIds.value = pendingVideoIds.value.filter(item => item !== storyboardId)
        delete failedVideoMessages.value[storyboardId]
        toast.success('视频生成完成')
        return
      }
      if (res?.status === 'failed') {
        pendingVideoIds.value = pendingVideoIds.value.filter(item => item !== storyboardId)
        failedVideoMessages.value = {
          ...failedVideoMessages.value,
          [storyboardId]: res?.error_msg || res?.errorMsg || '视频生成失败',
        }
        toast.error(failedVideoMessages.value[storyboardId])
        return
      }
    } catch {}
  }
  pendingVideoIds.value = pendingVideoIds.value.filter(item => item !== storyboardId)
  failedVideoMessages.value = {
    ...failedVideoMessages.value,
    [storyboardId]: '视频生成超时',
  }
  toast.error('视频生成超时')
}
function batchVideos() {
  const missing = sbs.value.filter(s => !hasVid(s) && !isPendingVideo(s.id))
  if (!missing.length) {
    toast.info('所有镜头视频已生成')
    return
  }
  const pendingIds = missing.map(s => s.id)
  pendingIds.forEach(id => {
    const sb = sbs.value.find(item => item.id === id)
    if (sb) genVid(sb)
  })
  if (pendingIds.length) {
    pendingVideoIds.value = [...new Set([...pendingVideoIds.value, ...pendingIds])]
    watchAsyncResult(() => pendingIds.every(id => {
      const target = sbs.value.find(s => s.id === id)
      const done = !!getVideoUrl(target)
      if (done) pendingVideoIds.value = pendingVideoIds.value.filter(item => item !== id)
      return done
    }), 80, 4000)
  }
}
async function doMerge(ids) {
  const storyboardIds = Array.isArray(ids) ? ids : undefined
  if (storyboardIds && !storyboardIds.length) {
    toast.error('请先勾选至少一个已生成视频的镜头')
    return
  }
  lastMergeIds.value = ids
  mergeError.value = ''
  try {
    await mergeAPI.merge(epId.value, storyboardIds)
    toast.success('拼接中...')
  } catch (e) {
    // 发起失败：toast 即时反馈 + 内联错误条可重试
    mergeError.value = e.message || '拼接失败'
    toast.error(e.message || '拼接失败')
    return
  }
  const poll = setInterval(async () => {
    try { mergeData.value = await mergeAPI.status(epId.value) } catch {}
    if (mergeData.value?.status === 'completed' || mergeData.value?.status === 'failed') {
      clearInterval(poll)
      if (mergeData.value.status === 'completed') {
        toast.success('拼接完成')
        mergeError.value = ''
        exportListRev.value++
      } else {
        // 后台拼接失败：内联错误 + 刷新列表同步失败状态到成片卡片
        mergeError.value = mergeData.value?.error_msg || mergeData.value?.errorMsg || '拼接失败'
        toast.error(mergeError.value)
        exportListRev.value++
      }
    }
  }, 3000)
}
async function loadConfigs() {
  configsLoading.value = true
  configsError.value = ''
  try {
    const [imgCfgs, vidCfgs, txtCfgs] = await Promise.all([
      aiConfigAPI.list('image'),
      aiConfigAPI.list('video'),
      aiConfigAPI.list('text'),
    ])
    imageConfigs.value = imgCfgs || []
    videoConfigs.value = vidCfgs || []
    textConfigs.value = txtCfgs || []
  } catch (e) {
    // 失败不再静默：顶栏内联提示 + 重试，避免模型下拉「无声消失」
    configsError.value = e.message || '模型配置加载失败'
    console.error('Failed to load AI configs', e)
  } finally {
    configsLoading.value = false
  }
}

onMounted(async () => { await refresh(true); loadConfigs(); syncExtractStatus() })
</script>

<style scoped>
/* ===== Studio Layout ===== */
.studio {
  display: flex;
  flex-direction: column;
  height: 100vh;
  overflow: hidden;
  padding: 8px;
  gap: 8px;
  background: var(--surface-base);
  /* 选中态:靛蓝色系,与进行中(蓝 --accent)/已完成(绿 --success)区分 */
  --sel: #5856d6;
  --sel-bg: rgba(88, 86, 214, 0.10);
  --sel-text: #4240b0;
  --sel-glow: rgba(88, 86, 214, 0.16);
}

.studio-topbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  flex-shrink: 0;
  min-height: 40px;
  padding: 4px 10px;
  border-radius: var(--radius-lg);
  background: var(--bar-glass);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-card);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
}

.studio-topbar-main,
.sidebar,
.main {
  background: var(--surface-raised);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-card);
}

.studio-topbar-main {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0;
  border: 0;
  box-shadow: none;
  backdrop-filter: none;
  background: transparent;
  min-width: 0;
}

/* 用更高特异性压过后面的 .back-btn{height:40px}，保持顶栏紧凑 */
.studio-topbar .topbar-back {
  width: auto;
  min-width: 72px;
  padding: 0 12px;
  height: 26px;
  border-radius: var(--radius-pill);
  white-space: nowrap;
  font-size: 11px;
}

.studio-identity {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}
.studio-overline {
  display: none;
  font-size: 8px;
  font-weight: 700;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--text-3);
}

.studio-title-row {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
}

.studio-title {
  font-size: 13px;
  line-height: 1;
  letter-spacing: -0.04em;
  white-space: nowrap;
}

.studio-episode-chip {
  display: inline-flex;
  align-items: center;
  height: 18px;
  padding: 0 8px;
  border-radius: var(--radius-pill);
  background: var(--accent-bg);
  color: var(--accent-text);
  font-size: 9px;
  font-weight: 700;
}

.studio-meta-row {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: nowrap;
  min-width: 0;
}

.studio-meta-pill {
  display: inline-flex;
  align-items: center;
  height: 18px;
  padding: 0 8px;
  border-radius: var(--radius-pill);
  background: var(--accent-bg);
  color: var(--accent-text);
  font-size: 8px;
  font-weight: 600;
  white-space: nowrap;
}

.studio-meta-pill.is-stage {
  background: var(--accent-bg);
  color: var(--accent-text);
}
.studio-meta-pill.is-progress {
  background: var(--success-bg);
  color: var(--success);
}
.studio-meta-inline {
  font-size: 9px;
  color: var(--text-3);
  font-weight: 600;
  white-space: nowrap;
}

.studio-topbar-side {
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
}

.studio-actions {
  display: flex;
  gap: 6px;
}
.studio-topbar .btn {
  height: 26px;
  padding: 0 9px;
  font-size: 10.5px;
  white-space: nowrap;
}

.studio-body {
  display: grid;
  grid-template-columns: var(--studio-sidebar-width, 208px) 8px minmax(0, 1fr);
  gap: 0;
  min-height: 0;
  flex: 1;
}

/* 工作台拖拽分隔线：细线保持安静，悬停时再明确提示可操作。 */
.panel-resizer {
  position: relative;
  z-index: 8;
  flex: 0 0 auto;
  border: 0;
  border-radius: 6px;
  background: transparent;
  touch-action: none;
  outline: none;
}
.panel-resizer::after {
  content: '';
  position: absolute;
  border-radius: 999px;
  background: var(--surface-outline-strong);
  opacity: 0.5;
  transition: background var(--dur-fast) var(--ease-out), opacity var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out);
}
.panel-resizer:hover::after,
.panel-resizer:focus-visible::after {
  background: var(--accent);
  opacity: 1;
  box-shadow: 0 0 0 3px var(--accent-glow);
}
.panel-resizer-vertical {
  width: 8px;
  min-width: 8px;
  cursor: col-resize;
}
.panel-resizer-vertical::after {
  top: 10px;
  bottom: 10px;
  left: 3px;
  width: 2px;
}
.panel-resizer-horizontal {
  width: 100%;
  height: 8px;
  min-height: 8px;
  cursor: row-resize;
}
.panel-resizer-horizontal::after {
  top: 3px;
  right: 12px;
  left: 12px;
  height: 2px;
}
.studio-sidebar-resizer {
  height: 100%;
}

/* ===== Sidebar ===== */
.sidebar {
  position: relative;
  width: auto;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
  border-radius: var(--radius);
}
.sidebar.has-custom-height {
  min-height: 260px;
}
.panel-resizer-sidebar-height {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  border-radius: 0 0 var(--radius) var(--radius);
}
.back-btn {
  min-width: 40px; width: auto; height: 40px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  gap: 6px;
  padding: 0 12px;
  border: none; border-radius: var(--radius-pill);
  background: var(--fill-subtle); color: var(--text-1);
  cursor: pointer; transition: all var(--dur-base) var(--ease-out);
  font-size: 12px;
  font-weight: 650;
  line-height: 1;
}
.back-btn:hover {
  background: rgba(0,0,0,0.09);
  color: var(--text-0);
}
.back-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3.5px var(--button-focus);
}

/* Pipeline Nav */
.pipeline { flex: 1; overflow-y: auto; padding: 12px 10px 8px; display: flex; flex-direction: column; gap: 8px; }
.pipe-section { display: flex; flex-direction: column; gap: 2px; }
.pipe-section-label {
  display: flex; align-items: center; gap: 5px;
  font-size: 9px; font-weight: 700; color: var(--text-3);
  text-transform: uppercase; letter-spacing: 0.06em;
  padding: 0 7px 2px;
}
.pipe-section.is-done .pipe-section-label { color: var(--success); }
.pipe-section.is-active .pipe-section-label { color: var(--accent); }
.pipe-section-state {
  width: 13px; height: 13px; border-radius: 999px; flex-shrink: 0;
  display: inline-flex; align-items: center; justify-content: center;
}
.pipe-section.is-done .pipe-section-state {
  background: var(--success-bg); color: var(--success);
  border: 1px solid var(--success-border);
}
.pipe-section-dot {
  width: 5px; height: 5px; border-radius: 999px;
  background: var(--text-3); opacity: 0.55;
}
.pipe-section-pulse {
  width: 6px; height: 6px; border-radius: 999px;
  background: var(--accent);
  animation: pipeSectionPulse 1.6s var(--ease-out) infinite;
}
@keyframes pipeSectionPulse {
  0% { box-shadow: 0 0 0 0 var(--accent-glow); }
  70% { box-shadow: 0 0 0 5px transparent; }
  100% { box-shadow: 0 0 0 0 transparent; }
}
.pipe-section-tag {
  font-size: 8.5px; font-weight: 700; letter-spacing: 0.03em;
  color: var(--accent); background: var(--accent-bg);
  border-radius: 999px; padding: 1px 5px;
  text-transform: none;
}
/* 子步骤进行中:与大环节同步的脉冲点 */
.pipe-item.doing { color: var(--text-1); }
.pipe-item.doing .pipe-icon {
  background: var(--accent-bg);
  border-color: rgba(0,113,227,0.25);
}
.pipe-item-pulse {
  width: 6px; height: 6px; border-radius: 999px;
  background: var(--accent);
  animation: pipeSectionPulse 1.6s var(--ease-out) infinite;
}
.pipe-item {
  display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 10px;
  padding: 7px 10px;
  border-radius: var(--radius);
  font-size: 12px; font-weight: 600;
  background: transparent; border: 1px solid transparent; color: var(--text-2); cursor: pointer;
  transition: all var(--dur-base) var(--ease-out); width: 100%; text-align: left;
}
.pipe-item:hover {
  background: var(--button-bg);
  border-color: var(--button-border);
  color: var(--text-0);
  box-shadow: var(--button-shadow);
}
.pipe-item.active {
  background: var(--sel-bg);
  color: var(--sel-text);
  border-color: transparent;
  box-shadow: none;
}
.pipe-item:focus-visible {
  outline: none;
  border-color: var(--action-primary);
  box-shadow: 0 0 0 3px var(--button-focus), var(--button-shadow);
}
.pipe-item.done { color: var(--text-2); }
.pipe-item-sub {
  grid-template-columns: auto minmax(0, 1fr);
  align-items: center;
  padding: 5px 8px;
  position: relative;
  min-height: 34px;
}

.pipe-item-sub:not(:last-child)::after {
  content: '';
  position: absolute;
  left: 15px;
  top: 23px;
  bottom: -6px;
  width: 1px;
  background: var(--border);
}

.pipe-icon {
  width: 16px; height: 16px; border-radius: 50%;
  display: flex; align-items: center; justify-content: center;
  background: var(--bg-2); border: 1px solid var(--border);
  color: var(--text-3); flex-shrink: 0; transition: all var(--dur-fast) var(--ease-out);
  position: relative;
  z-index: 1;
}
.pipe-item.active .pipe-icon { background: var(--sel); border-color: var(--sel); color: var(--text-invert); }
.pipe-item.done .pipe-icon { background: var(--success-bg); border-color: var(--success-border); color: var(--success); }
.pipe-item.active.done .pipe-icon { background: var(--sel); border-color: var(--sel); color: var(--text-invert); }
.icon-active { background: var(--sel) !important; border-color: var(--sel) !important; color: var(--text-invert) !important; }
.icon-done { background: var(--success-bg) !important; border-color: var(--success-border) !important; color: var(--success) !important; }
.pipe-item.active.done .icon-done { background: var(--sel) !important; border-color: var(--sel) !important; color: var(--text-invert) !important; }

.pipe-label { flex: 1; font-size: 11px; }
.pipe-copy { min-width: 0; display: flex; flex-direction: column; gap: 1px; }
.pipe-sub {
  display: none;
  font-size: 8.5px;
  line-height: 1.35;
  color: var(--text-3);
  font-weight: 500;
}
.pipe-badge {
  font-size: 9px; font-weight: 700; padding: 1px 5px;
  border-radius: 99px; background: var(--bg-3); color: var(--text-3);
  font-family: var(--font-mono);
}
.pipe-badge.badge-done { background: var(--success-bg); color: var(--success); }
.pipe-spinner { width: 10px; height: 10px; border: 1.5px solid var(--accent-bg); border-top-color: var(--accent); border-radius: 50%; animation: spin 0.8s linear infinite; }

/* Sidebar Bottom */
.sidebar-bottom {
  padding: 9px 10px 10px;
  border-top: 1px solid var(--border);
  display: flex; flex-direction: column; gap: 7px;
  flex-shrink: 0;
  background: var(--surface-soft);
}
.sidebar-jumper {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 2px 0 1px;
}
.sidebar-jump-dot {
  width: 7px;
  height: 7px;
  border-radius: 999px;
  border: none;
  padding: 0;
  background: rgba(0,0,0,0.14);
  cursor: pointer;
  transition: all var(--dur-med) var(--ease-out);
}
.sidebar-jump-dot:hover {
  transform: scale(1.08);
}
.sidebar-jump-dot.active {
  width: 20px;
  background: var(--sel);
}
.sidebar-jump-dot.done {
  background: var(--success);
}
.sidebar-jump-dot.active.done {
  width: 20px;
  background: var(--sel);
}
.sidebar-jump-dot:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--button-focus);
}
.refresh-btn {
  width: 100%; display: flex; align-items: center; justify-content: center; gap: 6px;
  min-height: 28px;
  padding: 0 10px; font-size: 11.5px; font-weight: 650; color: var(--button-text);
  background: var(--button-bg); border: 1px solid var(--button-border); border-radius: var(--button-radius);
  cursor: pointer; transition: all var(--dur-base) var(--ease-out);
  box-shadow: var(--button-shadow);
}
.refresh-btn:hover {
  background: var(--button-bg-hover);
  border-color: var(--button-border-hover);
  color: var(--button-text-hover);
  box-shadow: var(--button-shadow-hover);
}
.refresh-btn:focus-visible {
  outline: none;
  border-color: var(--action-primary);
  box-shadow: 0 0 0 3px var(--button-focus), var(--button-shadow-hover);
}

/* ===== Main Content ===== */
.main { flex: 1; display: flex; flex-direction: column; overflow: hidden; min-width: 0; min-height: 0; border-radius: var(--radius); }
.content-panel { flex: 1; display: flex; flex-direction: column; overflow: hidden; position: relative; min-height: 0; }
.stage-subnav {
  align-self: flex-start;
  margin: 4px 12px 0;
  max-width: calc(100% - 24px);
  overflow-x: auto;
  flex-shrink: 0;
}
.stage-subnav-item {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  white-space: nowrap;
  /* 压过全局 .seg-item{padding:7px 16px}，收紧子导航高度 */
  padding: 4px 13px;
  font-size: 12px;
}
.stage-subnav-item.active {
  background: var(--surface-raised);
  color: var(--text-0);
  box-shadow: var(--shadow-float);
}
.stage-subnav-item.done {
  color: var(--text-1);
}
.stage-subnav-item.active.done {
  color: var(--text-0);
}
.stage-subnav-dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: var(--success);
}

/* Toolbar */
.step-toolbar {
  display: flex; align-items: center; gap: 10px;
  min-height: 44px;
  padding: 8px 12px; border-bottom: 1px solid var(--border);
  background: var(--surface-raised); flex-shrink: 0;
}
.prod-toolbar { background: var(--surface-raised); }
.toolbar-left { display: flex; align-items: center; gap: 8px; flex: 1; }
.toolbar-right { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.step-indicator { display: flex; align-items: center; gap: 8px; }
.step-num {
  width: 26px; height: 26px; border-radius: 10px;
  display: inline-flex; align-items: center; justify-content: center;
  background: var(--accent-bg);
  font-family: var(--font-mono); font-size: 10px; font-weight: 800; color: var(--accent-text); letter-spacing: 0.05em;
}
.step-name { font-size: 12.5px; font-weight: 700; color: var(--text-1); font-family: var(--font-display); }
.char-count { font-size: 11px; color: var(--text-3); font-family: var(--font-mono); }

/* Editor Area */
.step-editor { flex: 1; display: flex; flex-direction: column; min-height: 0; }
.fill-textarea {
  flex: 1; border: none; border-radius: 0; padding: 26px 28px;
  font-size: 13.5px; line-height: 1.9; resize: none; outline: none;
  font-family: var(--font-body); background: var(--bg-input); color: var(--text-0);
}
.fill-textarea:focus { box-shadow: none; }

/* Step Empty State */
.step-empty {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  flex: 1; min-height: 300px; gap: 10px; padding: 46px;
  animation: fadeIn var(--dur-slow) var(--ease-out);
}
.empty-visual {
  width: 72px; height: 72px; border-radius: 22px;
  background: var(--bg-1); color: var(--accent);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-sm);
  display: flex; align-items: center; justify-content: center;
  margin-bottom: 8px;
}
.empty-title { font-size: 22px; font-weight: 700; font-family: var(--font-display); color: var(--text-0); }
.empty-desc { font-size: 13px; color: var(--text-2); max-width: 420px; text-align: center; line-height: 1.8; }
.step-empty-actions { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; justify-content: center; }

/* Step Loading */
.step-loading {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  flex: 1; gap: 12px;
}
.loading-text { font-size: 13px; color: var(--text-2); }

/* Step Navigator Bubble */
.step-bubble {
  position: absolute;
  bottom: 16px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 40;
  display: flex; align-items: center; gap: 12px;
  padding: 6px 8px;
  border-radius: var(--radius-pill);
  background: var(--surface-glass);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
  border: 1px solid var(--border);
  box-shadow: var(--shadow-lift);
}
.bubble-btn {
  display: flex; align-items: center; gap: 6px;
  min-height: var(--button-height-sm);
  padding: 0 12px; border-radius: var(--radius-pill); font-size: 11.5px; font-weight: 650;
  border: none; background: var(--button-bg); color: var(--button-text); cursor: pointer;
  transition: all var(--dur-base) var(--ease-out); white-space: nowrap;
  line-height: 1;
}
.bubble-btn:hover:not(:disabled) {
  background: var(--button-bg-hover);
  color: var(--button-text-hover);
}
.bubble-btn:disabled { opacity: 0.44; cursor: not-allowed; }
.bubble-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--button-focus);
}
.bubble-btn.primary {
  margin-left: auto;
  background: var(--action-primary);
  color: var(--action-primary-text);
}
.bubble-btn.primary:hover:not(:disabled) { background: var(--action-primary-hover); }
.bubble-btn.primary:disabled { opacity: 0.5; }
.bubble-dots { display: flex; gap: 7px; padding: 0 4px; }
.bubble-dot {
  width: 8px; height: 8px; border-radius: 50%;
  background: rgba(0,0,0,0.14); cursor: pointer; transition: all var(--dur-fast) var(--ease-out);
  border: none;
  padding: 0;
}
.bubble-dot.done { background: var(--success); }
.bubble-dot.current { background: var(--sel); transform: scale(1.2); }
.bubble-dot:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3px var(--button-focus);
}

/* Split layout (storyboard) */
.storyboard-workbench {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns:
    var(--storyboard-list-width, clamp(180px, 24%, 232px))
    8px
    minmax(280px, 1fr)
    8px
    var(--storyboard-reference-width, clamp(200px, 27%, 280px));
  gap: 0;
  padding: 12px 14px 16px;
  overflow: hidden;
}
.storyboard-workbench.has-custom-height {
  min-height: 360px;
}
.storyboard-column-resizer {
  height: 100%;
}
.storyboard-shot-list {
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface-raised);
  box-shadow: var(--shadow-card);
}
.storyboard-shot-card {
  width: 100%;
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 9px 10px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface-raised);
  color: var(--text-1);
  cursor: pointer;
  text-align: left;
  transition: background var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out);
}
.storyboard-shot-card + .storyboard-shot-card { margin-top: 7px; }
.storyboard-shot-card:hover {
  border-color: var(--border-strong);
  box-shadow: var(--shadow-card);
}
.storyboard-shot-card.active {
  background: var(--surface-raised);
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-glow);
}
/* 多选模式：选中的卡片高亮描边 */
.storyboard-shot-card.is-selected {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-glow);
  background: var(--accent-soft);
}
.storyboard-shot-head { display: flex; align-items: center; gap: 6px; min-width: 0; }
.storyboard-shot-chip {
  display: inline-flex;
  align-items: center;
  min-width: 0;
  height: 18px;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--bg-2);
  color: var(--text-2);
  font-size: 10px;
  font-weight: 650;
  white-space: nowrap;
}
.storyboard-editor-main {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface-raised);
}
.sb-header-top {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--border);
  background: var(--surface-raised);
}
.sb-header-top .detail-head-copy { flex-direction: row; align-items: baseline; gap: 4px; min-width: 0; }
.sb-header-total { font-size: 11px; white-space: nowrap; }
.sb-header-fields {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
  padding: 8px 14px;
  border-bottom: 1px solid var(--border);
  background: var(--surface-soft);
}
.sb-field-label { font-size: 12px; color: var(--text-3); flex-shrink: 0; }
.sb-duration-input { display: inline-flex; align-items: center; gap: 4px; flex-shrink: 0; }
.sb-duration-input .input { width: 56px; height: 30px; padding: 4px 8px; font-size: 12.5px; }
.sb-duration-unit { font-size: 11px; color: var(--text-3); }
.storyboard-editor-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}
/* 编辑器内：取消卡片式分块，改为整白面板 + 发丝分隔线 */
.storyboard-editor-scroll .detail-section {
  border: none;
  border-radius: 0;
  background: transparent;
  padding: 18px 20px;
  border-bottom: 1px solid var(--border);
}
.storyboard-editor-scroll .detail-section:last-child {
  border-bottom: none;
}
/* 描述 / 视频提示词 左右双栏分割 */
.storyboard-editor-scroll .sb-split {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns:
    var(--storyboard-description-width, minmax(120px, 0.9fr))
    8px
    minmax(140px, 1.1fr);
  align-items: stretch;
}
.storyboard-editor-scroll .sb-split .detail-section {
  border-bottom: none;
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.storyboard-editor-scroll .sb-split > .sb-description-panel {
  border-right: none;
}
.storyboard-editor-scroll .sb-split .detail-section-copy {
  margin-top: -4px;
}
/* 双栏内字段撑满面板高度 */
.storyboard-editor-scroll .sb-split .field { flex: 1; min-height: 0; }
.storyboard-editor-scroll .sb-split .field .textarea { flex: 1; min-height: 64px; resize: vertical; }
.storyboard-editor-scroll .sb-split .field-grid-2 { flex: 1; }
.storyboard-editor-scroll .sb-split .mention-textarea {
  flex: 1;
  min-height: 0;
}
.sb-content-resizer,
.sb-prompt-height-resizer {
  align-self: stretch;
}
.sb-prompt-stack {
  min-width: 0;
  min-height: 0;
  display: grid;
  grid-template-rows:
    var(--storyboard-video-prompt-height, minmax(210px, 1fr))
    8px
    minmax(190px, 1fr);
  overflow: hidden;
}
.storyboard-editor-scroll .sb-prompt-stack > .detail-section {
  min-height: 0;
  overflow-y: auto;
}
.workbench-height-resizer {
  flex: 0 0 8px;
  margin-top: -6px;
}
@media (max-width: 900px) {
  .storyboard-workbench {
    grid-template-columns: 1fr;
    overflow-y: auto;
  }
  .storyboard-column-resizer { display: none; }
  .storyboard-shot-list,
  .storyboard-editor-main,
  .storyboard-reference-panel { min-height: 280px; }
  .storyboard-editor-scroll .sb-split { display: flex; flex-direction: column; overflow-y: auto; }
  .storyboard-editor-scroll .sb-split > .sb-description-panel { border-bottom: 1px solid var(--border); }
  .sb-prompt-stack { display: flex; flex-direction: column; overflow: visible; }
  .sb-content-resizer,
  .sb-prompt-height-resizer { display: none; }
}
/* 上一条 / 下一条导航 */
.sb-nav-group {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}
.sb-nav-btn {
  flex-shrink: 0;
}
.storyboard-reference-panel {
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  background: var(--surface-muted);
}
.storyboard-ref-head {
  flex-shrink: 0;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  padding: 12px;
  border-bottom: 1px solid var(--border);
}
.storyboard-ref-title { font-size: 13px; font-weight: 800; color: var(--text-0); }
.storyboard-ref-copy { margin-top: 3px; font-size: 11px; color: var(--text-3); }
.storyboard-ref-list {
  min-height: 0;
  overflow-y: auto;
  padding: 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.storyboard-ref-group {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.storyboard-ref-group + .storyboard-ref-group {
  margin-top: 6px;
}
.storyboard-ref-group-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-3);
  letter-spacing: 0.02em;
  padding: 0 2px;
}
.storyboard-ref-goto {
  align-self: flex-start;
  border: none;
  background: transparent;
  padding: 2px 6px;
  margin-left: -6px;
  border-radius: var(--radius-sm);
  font-size: 11px;
  font-weight: 600;
  color: var(--accent);
  cursor: pointer;
}
.storyboard-ref-goto:hover {
  background: var(--accent-bg);
}
.storyboard-ref-item {
  display: grid;
  grid-template-columns: 48px minmax(0, 1fr);
  gap: 9px;
  align-items: center;
  padding: 7px;
  border-radius: var(--radius);
  border: 1px solid var(--border);
  background: var(--surface-raised);
  cursor: pointer;
  transition: border-color var(--dur-fast) var(--ease-out), opacity var(--dur-fast) var(--ease-out);
}
.storyboard-ref-item:hover { border-color: var(--accent); }
.storyboard-ref-item:not(.bound) {
  background: transparent;
  border-color: var(--border);
  opacity: 0.72;
}
.storyboard-ref-item:not(.bound):hover { opacity: 1; border-color: var(--accent); }
.storyboard-ref-item:not(.bound) .storyboard-ref-main .storyboard-ref-name { color: var(--text-2); }
.storyboard-ref-item.bound {
  border-color: var(--accent);
  background: var(--accent-bg);
}
.storyboard-ref-item.bound:hover { border-color: var(--accent); }
.storyboard-ref-thumb {
  width: 48px;
  aspect-ratio: 1;
  border-radius: var(--radius);
  border: 1px solid var(--surface-outline);
  overflow: hidden;
  background: var(--bg-2);
  color: var(--text-3);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 800;
}
.storyboard-ref-thumb:disabled { cursor: default; }
.storyboard-ref-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.storyboard-ref-main { min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.storyboard-ref-line { display: flex; align-items: center; gap: 6px; min-width: 0; }
.storyboard-ref-name {
  min-width: 0;
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 12px;
  font-weight: 750;
  color: var(--text-0);
}
.storyboard-ref-state {
  flex-shrink: 0;
  font-size: 10px;
  color: var(--text-3);
}
.storyboard-ref-state.is-ready { color: var(--success); }
.storyboard-ref-meta {
  font-size: 11px;
  color: var(--text-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.storyboard-ref-empty {
  padding: 14px 10px;
  color: var(--text-3);
  font-size: 12px;
  line-height: 1.5;
  border: 1px dashed var(--surface-outline);
  border-radius: var(--radius);
}
.split-layout { flex: 1; display: flex; min-height: 0; overflow: hidden; }
.shot-list { width: 296px; flex-shrink: 0; overflow-y: auto; border-right: 1px solid var(--border); background: var(--bg-0); }
.shot-list-head {
  position: sticky;
  top: 0;
  z-index: 1;
  display: flex;
  flex-direction: column;
  padding: 11px 12px 10px;
  border-bottom: 1px solid var(--surface-outline);
  background: var(--surface-raised);
  backdrop-filter: blur(10px);
}
.shot-list-head-main { display: flex; align-items: flex-start; justify-content: space-between; gap: 8px; }
.shot-list-head-copy { flex: 1; min-width: 0; }
.shot-list-title { font-size: 13px; font-weight: 700; color: var(--text-0); }
.shot-list-sub { margin-top: 3px; font-size: 11px; color: var(--text-3); line-height: 1.45; }
.shot-list-body { flex: 1; min-height: 0; overflow-y: auto; padding: 6px; }
.shot-num {
  font-size: 11px; font-family: var(--font-mono); font-weight: 700;
  color: var(--accent); background: var(--accent-bg);
  padding: 2px 6px; border-radius: 4px; flex-shrink: 0;
  letter-spacing: 0.03em;
}
.shot-body { }
.shot-desc { font-size: 12px; line-height: 1.4; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; color: var(--text-1); }
.shot-desc.is-empty { color: var(--text-3); font-style: italic; }
.shot-meta { display: flex; align-items: center; justify-content: space-between; gap: 6px; min-width: 0; }
.shot-location {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  min-width: 0;
  font-size: 10px;
  color: var(--text-3);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.shot-location svg { flex-shrink: 0; }
.shot-chip-video {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  margin-left: auto;
  flex-shrink: 0;
  height: 16px;
  padding: 0 6px;
  border-radius: 999px;
  background: var(--info-bg);
  color: var(--info);
  font-size: 10px;
  font-weight: 650;
  white-space: nowrap;
}
.shot-avatars { display: flex; align-items: center; min-width: 0; }
.shot-avatar {
  width: 16px;
  height: 16px;
  border-radius: 50%;
  border: 1px solid var(--surface-raised);
  background: var(--bg-2);
  color: var(--text-2);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  font-size: 9px;
  font-weight: 700;
  overflow: hidden;
  flex-shrink: 0;
}
.shot-avatar + .shot-avatar { margin-left: -4px; }
.shot-avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
.shot-avatar-more { font-size: 8px; color: var(--text-3); }
.shot-avatars-empty { font-size: 10px; color: var(--text-3); }
.shot-flags { display: flex; align-items: center; gap: 6px; flex-shrink: 0; }
.shot-flag {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  font-size: 10px;
  color: var(--text-3);
  white-space: nowrap;
}
.shot-flag .dot { width: 6px; height: 6px; border-radius: 50%; background: var(--bg-3); flex-shrink: 0; }
.shot-flag.on { color: var(--text-2); }
.shot-flag.flag-video.on .dot { background: var(--info); }

.detail-panel { flex: 1; display: flex; flex-direction: column; overflow-y: auto; min-width: 0; }
.detail-head { display: flex; align-items: center; gap: 8px; padding: 9px 14px; border-bottom: 1px solid var(--border); flex-shrink: 0; }
.detail-head-copy { display: flex; flex-direction: column; gap: 2px; }
.detail-head-title { font-size: 14px; font-weight: 700; color: var(--text-0); }
.detail-body { padding: 14px 16px; display: flex; flex-direction: column; gap: 12px; }
.detail-hero {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(220px, 0.9fr);
  gap: 12px;
  padding: 12px;
  border-radius: var(--radius-lg);
  background: var(--surface-raised);
  border: 1px solid var(--border);
}
.detail-hero-copy { display: flex; flex-direction: column; gap: 8px; min-width: 0; }
.detail-hero-label {
  font-size: 10px; font-weight: 700; letter-spacing: 0.12em;
  text-transform: uppercase; color: var(--text-3);
}
.detail-hero-text { font-size: 13px; color: var(--text-1); line-height: 1.7; }
.detail-status-row { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
.detail-section {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 14px;
  border-radius: var(--radius-lg);
  background: var(--surface-raised);
  border: 1px solid var(--border);
}
.detail-section-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  flex-wrap: wrap;
}
.detail-section-title { font-size: 12px; font-weight: 700; color: var(--text-0); }
.detail-section-copy { font-size: 11px; color: var(--text-3); }

/* Field */
.field { display: flex; flex-direction: column; gap: 5px; }
.field-label { font-size: 12px; font-weight: 500; color: var(--text-1); }
.field-row { display: flex; gap: 12px; }
.field-grid { display: grid; gap: 12px; }
.field-grid-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
.field-grid-4 { grid-template-columns: repeat(4, minmax(0, 1fr)); }
.locked-config {
  display: inline-flex;
  align-items: center;
  height: 30px;
  padding: 0 12px;
  border-radius: 999px;
  background: var(--surface-muted);
  border: 1px solid var(--surface-outline);
  color: var(--text-1);
  font-size: 11px;
  font-weight: 600;
}
.locked-config-banner {
  margin-bottom: 8px;
  font-size: 12px;
  color: var(--text-2);
}

/* Production tabs */
.prod-tabs { display: flex; gap: 4px; background: var(--bg-2); border-radius: var(--radius); padding: 2px; }
.prod-tab {
  display: flex; align-items: center; gap: 4px; min-height: 26px; padding: 0 10px; font-size: 11px;
  border: 1px solid transparent; background: transparent; color: var(--text-2); cursor: pointer;
  border-radius: calc(var(--radius) - 2px); transition: all var(--dur-base) var(--ease-out); font-weight: 650;
  line-height: 1;
}
.prod-tab:hover { color: var(--text-0); background: var(--button-bg); border-color: var(--button-border); }
.prod-tab.active { background: var(--accent-bg); color: var(--accent-text); font-weight: 650; border-color: var(--accent-glow); box-shadow: none; }
.prod-tab:focus-visible {
  outline: none;
  border-color: var(--action-primary);
  box-shadow: 0 0 0 3px var(--button-focus), var(--button-shadow);
}
.prod-tab-badge { font-size: 10px; font-family: var(--font-mono); padding: 0 4px; background: var(--bg-3); border-radius: 99px; }
.prod-tab.active .prod-tab-badge { background: var(--accent-bg); color: var(--accent-text); }

/* Production content */
.prod-content { flex: 1; overflow-y: auto; padding: 10px 12px 64px; display: flex; flex-direction: column; gap: 10px; }
.prod-section-bar { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }

/* 资产栏动作：提取（虚线中性）与批量生成（强调色）视觉分组 */
.asset-bar-actions { align-items: center; }
.asset-bar-divider { width: 1px; height: 16px; margin: 0 4px; background: var(--surface-outline-strong); }
.asset-btn-extract {
  background: transparent;
  color: var(--text-2);
  box-shadow: none;
  border: 1px dashed var(--surface-outline-strong);
}
.asset-btn-extract:hover { background: var(--surface-muted); color: var(--text-1); }
.asset-btn-batch {
  background: var(--accent-bg);
  color: var(--accent-text);
  box-shadow: none;
}
.asset-btn-batch:hover { background: var(--accent); color: var(--text-invert); }

/* 资产分区标题：新增入口 + 卡片删除按钮 */
.asset-section-title { display: flex; align-items: center; gap: 8px; }
.asset-add-btn {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px dashed var(--surface-outline-strong);
  background: transparent;
  color: var(--text-3);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: color var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out);
}
.asset-add-btn:hover { color: var(--accent-text); border-color: var(--accent-text); }
.character-asset-card, .asset-click-card { position: relative; }
.asset-del-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  z-index: 3;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: var(--media-scrim);
  color: var(--text-invert);
  cursor: pointer;
  opacity: 0;
  transition: opacity var(--dur-fast) var(--ease-out), background var(--dur-fast) var(--ease-out);
}
.asset-del-btn:hover { background: var(--action-danger); }
.character-asset-card:hover .asset-del-btn,
.asset-click-card:hover .asset-del-btn { opacity: 1; }

/* 分镜勾选：选择后批量生成视频提示词 */
.shot-check {
  flex: none;
  width: 14px;
  height: 14px;
  border-radius: 4px;
  border: 1.5px solid var(--surface-outline-strong);
  background: transparent;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--text-invert);
  cursor: pointer;
  transition: background var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out);
}
.shot-check:hover { border-color: var(--accent); }
.shot-check.on { background: var(--accent); border-color: var(--accent); }
.shot-quick-btn {
  border: none;
  background: transparent;
  color: var(--accent-text);
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
  white-space: nowrap;
}
.shot-quick-btn:hover { text-decoration: underline; }
/* 多选模式：头部快捷操作独立一行，分段芯片样式 */
.shot-quick-actions {
  display: flex;
  gap: 6px;
  margin-top: 10px;
  padding-top: 10px;
  border-top: 1px dashed var(--surface-outline);
}
.shot-quick-actions .shot-quick-btn {
  flex: 1;
  padding: 5px 0;
  border-radius: 6px;
  background: var(--bg-2);
  color: var(--text-2);
  text-align: center;
  transition: background var(--dur-fast) var(--ease-out), color var(--dur-fast) var(--ease-out);
}
.shot-quick-actions .shot-quick-btn:hover {
  background: var(--accent-soft);
  color: var(--accent-text);
  text-decoration: none;
}

/* 多选模式底部操作条：信息行 + 全宽主按钮 */
.shot-select-bar {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  border-top: 1px solid var(--border);
  background: var(--bg-1);
}
.shot-select-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.shot-select-count {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-2);
  white-space: nowrap;
}
.shot-select-go { width: 100%; justify-content: center; }

/* 新增资产弹窗 */
.asset-create-body { display: flex; flex-direction: column; gap: 10px; }

/* Asset grid */
.asset-section-title {
  margin-top: 2px;
  font-size: 12px;
  font-weight: 800;
  color: var(--text-1);
  letter-spacing: 0.04em;
}
.prop-name-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.prop-name-row .asset-name {
  min-width: 0;
}
.asset-props-empty {
  padding: 14px;
  border: 1px dashed var(--surface-outline);
  border-radius: var(--radius);
  color: var(--text-3);
  font-size: 12px;
  text-align: center;
}
.asset-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 12px; align-items: stretch; }
.character-asset-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 260px));
  justify-content: start;
  gap: 10px;
}
.asset-card {
  display: flex; flex-direction: column; overflow: hidden;
  transition: transform var(--dur-base) var(--ease-out), box-shadow var(--dur-base) var(--ease-out), border-color var(--dur-base) var(--ease-out);
}
.asset-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-lift); }
.asset-click-card,
.character-asset-card {
  cursor: pointer;
}
.asset-click-card:focus-visible,
.character-asset-card:focus-visible {
  outline: none;
  border-color: var(--accent-glow);
  box-shadow: 0 0 0 3px var(--button-focus), var(--shadow-panel);
}
.character-asset-card {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
  transition: transform var(--dur-base) var(--ease-out), box-shadow var(--dur-base) var(--ease-out), border-color var(--dur-base) var(--ease-out);
}
.character-asset-card:hover {
  transform: translateY(-2px);
  box-shadow: var(--shadow-lift);
  border-color: var(--border-strong);
}
.character-portrait {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  align-self: start;
  margin: 0;
  border: 1px solid var(--surface-outline);
  border-radius: var(--radius);
  background: var(--bg-2);
  overflow: hidden;
}
.character-portrait img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.character-portrait-empty {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-3);
}
.character-asset-main {
  min-width: 0;
  width: 100%;
  padding: 8px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.character-asset-overview {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.character-asset-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
}
.character-title-block {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.character-name-row {
  display: flex;
  align-items: center;
  gap: 5px;
  min-width: 0;
  flex-wrap: wrap;
}
.character-name {
  font-size: 13px;
  line-height: 1.25;
  color: var(--text-0);
}
.character-gen-btn { flex-shrink: 0; align-self: center; }
.studio-model-picks {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-right: 12px;
  padding-right: 12px;
  border-right: 1px solid var(--border);
}
.model-config-hint {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--text-3);
  white-space: nowrap;
}
.model-config-hint .btn { padding: 3px 10px; font-size: 12px; }
.model-config-hint.is-error .tag { margin: 0; }
.asset-final-prompt {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding-top: 7px;
  border-top: 1px solid var(--border);
  font-size: 10.5px;
  line-height: 1.5;
}
.afp-label {
  font-size: 9.5px;
  font-weight: 700;
  letter-spacing: 0.05em;
  color: var(--text-3);
}
.afp-text {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  word-break: break-word;
  color: var(--text-2);
}
.afp-text.dim { color: var(--text-3); }
.asset-final {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  word-break: break-word;
  color: var(--text-2);
}
.asset-final .afp-label { margin-right: 4px; }
.character-visual-summary {
  max-width: 100%;
  display: flex;
  gap: 8px;
  overflow: hidden;
  color: var(--text-3);
  font-size: 10.5px;
  line-height: 1.45;
  white-space: nowrap;
}
.character-visual-summary span {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
}
.asset-cover { position: relative; aspect-ratio: 1; background: var(--bg-2); overflow: hidden; }
.asset-cover.wide { aspect-ratio: 16/9; }
.asset-cover img { width: 100%; height: 100%; object-fit: cover; }
.previewable-image { cursor: zoom-in; transition: transform var(--dur-base) var(--ease-out), filter var(--dur-base) var(--ease-out); }
.previewable-image:hover { transform: scale(1.015); filter: saturate(1.04); }
.asset-cover-empty { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: var(--text-3); }
.asset-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding: 9px 11px 8px;
  min-width: 0;
}
.asset-name {
  font-size: 13px;
  font-weight: 650;
  color: var(--text-0);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.asset-meta { font-size: 11px; line-height: 1.5; }
.asset-desc {
  display: -webkit-box;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  overflow: hidden;
  word-break: break-word;
}
.asset-light {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.asset-foot { display: flex; align-items: center; gap: 4px; padding: 7px 11px; border-top: 1px solid var(--border); }

/* Frame grid */
.frame-grid { display: flex; flex-direction: column; gap: 8px; }
.frame-row {
  display: flex; align-items: center; gap: 14px;
  padding: 12px 14px; cursor: pointer;
  border-radius: var(--radius-lg);
  transition: all var(--dur-fast) var(--ease-out);
  border: 1.5px solid transparent;
}
.frame-row:hover { background: var(--bg-0); border-color: var(--border); }
.frame-row.active {
  background: var(--bg-0);
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-glow);
}
.frame-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
.frame-top { display: flex; align-items: center; gap: 8px; }
.frame-num {
  font-size: 13px; font-family: var(--font-mono); font-weight: 800;
  color: var(--accent);
}
.frame-badge {
  font-size: 11px; font-weight: 600; padding: 2px 8px;
  border-radius: 20px;
  background: var(--accent-bg); color: var(--accent);
  border: 1px solid var(--accent-glow);
  white-space: nowrap;
}
.frame-desc {
  font-size: 12px; line-height: 1.5; color: var(--text-1);
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
  overflow: hidden;
}
.frame-meta { display: flex; align-items: center; gap: 6px; }
.frame-thumbs { display: flex; gap: 8px; flex-shrink: 0; }
.frame-thumb-wrap { display: flex; flex-direction: column; gap: 3px; align-items: center; }
.frame-thumb-label { font-size: 10px; font-weight: 600; color: var(--text-3); }
.frame-thumb {
  position: relative; width: 130px; aspect-ratio: 16/9;
  border-radius: 6px; overflow: hidden;
  background: var(--bg-2); cursor: pointer;
  transition: all var(--dur-fast) var(--ease-out); border: 1.5px solid var(--border);
}
.frame-thumb:hover { border-color: var(--accent); box-shadow: 0 2px 8px rgba(0,0,0,0.2); }
.frame-thumb img { width: 100%; height: 100%; object-fit: cover; }
.frame-thumb-empty { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: var(--text-3); }
.frame-re {
  position: absolute; top: 3px; right: 3px; width: 18px; height: 18px;
  border-radius: 50%; background: var(--media-scrim); color: var(--text-invert);
  display: none; align-items: center; justify-content: center;
}
.frame-thumb:hover .frame-re { display: flex; }
.frame-scroll { flex: 1; overflow-y: auto; padding: 10px 12px; }
.dot { width: 7px; height: 7px; border-radius: 50%; background: var(--bg-3); flex-shrink: 0; }
.dot.ok { background: var(--success); }
.dot.pending {
  background: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-glow);
}

/* Video tasks */
.video-task-workbench {
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: minmax(0, 1fr);
  overflow: hidden;
  border: 1px solid var(--surface-outline);
  border-radius: var(--radius-lg);
  background: var(--surface-raised);
}
.video-task-workbench.has-player {
  grid-template-columns:
    var(--video-task-list-width, minmax(0, 1fr))
    8px
    minmax(320px, 52%);
}
.video-task-workbench.has-custom-height {
  min-height: 360px;
}
.video-column-resizer {
  height: 100%;
}
.video-task-side {
  min-width: 0;
  min-height: 0;
  display: grid;
  grid-template-rows:
    var(--video-preview-height, minmax(230px, 42%))
    8px
    minmax(180px, 1fr);
  border-left: 0;
  background: var(--surface-muted);
}
.video-task-preview-stack {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  background: var(--surface-raised);
}
.video-task-preview-stack .video-task-player {
  flex: 1;
}
.video-row-resizer {
  align-self: stretch;
}
.video-task-side .video-task-inspector {
  border-left: 0;
}
.video-player-history {
  min-height: 0;
  padding: 8px 12px 10px;
  border-bottom: 1px solid var(--border);
  background: var(--surface-raised);
}
.video-history-error-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 2px 0;
}
.video-history-error-row .tag { margin: 0; flex-shrink: 0; }
.video-player-history-head {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 7px;
  font-size: 11px;
  font-weight: 700;
  color: var(--text-2);
}
.video-player-history-count {
  padding: 0 6px;
  border-radius: 999px;
  background: var(--fill-subtle);
  color: var(--text-3);
  font-size: 10px;
  font-weight: 750;
}
.video-player-history-list {
  display: flex;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 2px;
}
.video-history-item {
  position: relative;
  flex: 0 0 auto;
  width: 96px;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  border: 1.5px solid var(--surface-outline);
  border-radius: var(--radius);
  background: var(--media-stage-bg);
  cursor: pointer;
  transition: border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out);
}
.video-history-item:hover { border-color: var(--border-strong); }
.video-history-item video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.video-history-item.current {
  border-color: var(--accent);
}
.video-history-item.viewing {
  border-color: var(--accent);
  box-shadow: 0 0 0 3px var(--accent-glow);
}
.video-history-time {
  position: absolute;
  left: 4px;
  bottom: 4px;
  padding: 1px 4px;
  border-radius: 3px;
  background: var(--media-scrim-strong);
  color: var(--text-invert);
  font-family: var(--font-mono);
  font-size: 9px;
}
.video-history-badge {
  position: absolute;
  right: 4px;
  top: 4px;
  padding: 1px 5px;
  border-radius: 999px;
  background: var(--accent);
  color: var(--text-invert);
  font-size: 9px;
  font-weight: 700;
}
.video-history-del {
  position: absolute;
  right: 3px;
  top: 3px;
  width: 16px;
  height: 16px;
  display: none;
  align-items: center;
  justify-content: center;
  border: 0;
  border-radius: 50%;
  background: var(--media-scrim-strong);
  color: var(--text-invert);
  font-size: 11px;
  line-height: 1;
  cursor: pointer;
}
.video-history-item:hover .video-history-del { display: flex; }
.video-task-player {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  border-bottom: 1px solid var(--border);
  background: var(--surface-raised);
}
.video-player-head {
  min-height: 44px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 14px;
  border-bottom: 1px solid var(--surface-outline);
}
.video-player-head-info {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}
.video-player-title { color: var(--text-0); font-size: 13px; font-weight: 700; white-space: nowrap; }
.video-player-sub { color: var(--text-3); font-size: 11px; white-space: nowrap; }
.video-player-stage {
  flex: 1;
  min-height: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--media-stage-bg);
}
.video-player-video {
  width: 100%;
  height: 100%;
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  display: block;
}
.video-player-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 24px;
  text-align: center;
  color: var(--media-text-dim);
}
.video-player-empty-title { color: var(--media-text); font-size: 13px; font-weight: 700; }
.video-player-empty-desc { font-size: 11px; line-height: 1.5; }
.video-task-list {
  min-height: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
  border: 0;
  border-radius: 0;
  background: var(--surface-raised);
}
.video-task-head {
  min-height: 48px;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 10px 12px;
  border-bottom: 1px solid var(--surface-outline);
}
.video-task-title {
  font-size: 13px;
  line-height: 1.2;
  font-weight: 850;
  color: var(--text-0);
}
.video-task-meta {
  margin-top: 3px;
  font-size: 11px;
  line-height: 1.35;
  color: var(--text-3);
}
.video-task-metrics {
  margin-left: auto;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
  flex-wrap: wrap;
}
.video-task-metric,
.video-task-status {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  min-height: 22px;
  padding: 0 8px;
  border: 1px solid var(--surface-outline);
  border-radius: 999px;
  background: var(--fill-subtle);
  color: var(--text-2);
  font-size: 11px;
  font-weight: 750;
  white-space: nowrap;
}
.video-task-metric.is-done,
.video-task-status.is-done {
  color: var(--success);
  border-color: var(--success-border-strong);
  background: var(--success-bg);
}
.video-task-metric.is-pending,
.video-task-status.is-pending,
.video-task-status.is-ready {
  color: var(--accent-text);
  border-color: var(--accent-glow);
  background: var(--accent-bg);
}
.video-task-metric.is-failed,
.video-task-status.is-failed,
.video-task-status.is-blocked {
  color: var(--warning);
  border-color: var(--warning-border-strong);
  background: var(--warning-bg);
}
.video-task-table {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
}
.video-task-row {
  display: grid;
  grid-template-columns: 84px minmax(0, 1fr) auto auto;
  align-items: center;
  gap: 10px;
  padding: 9px 12px;
  border-top: 1px solid var(--surface-outline);
  transition: background var(--dur-fast) var(--ease-out), border-color var(--dur-fast) var(--ease-out);
  cursor: pointer;
}
.video-task-row:first-child {
  border-top: 0;
}
.video-task-row:hover,
.video-task-row.is-pending {
  background: var(--bg-hover);
}
.video-task-row.is-failed {
  background: var(--error-bg);
}
.video-task-row.active {
  background: var(--sel-bg);
  box-shadow: inset 0 0 0 1.5px var(--sel), 0 0 0 3px var(--sel-glow);
}
.video-task-row:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: -2px;
}
.video-task-preview {
  position: relative;
  width: 84px;
  aspect-ratio: 16 / 9;
  overflow: hidden;
  border: 1px solid var(--surface-outline);
  border-radius: var(--radius);
  background: var(--bg-2);
}
.video-task-preview video,
.video-task-preview img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}
.video-task-empty {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-3);
}
.video-task-index {
  position: absolute;
  left: 5px;
  top: 5px;
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--media-scrim);
  color: var(--text-invert);
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 800;
}
.video-task-main {
  min-width: 0;
}
.video-task-line {
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}
.video-task-name {
  min-width: 0;
  font-size: 13px;
  line-height: 1.35;
  color: var(--text-0);
}
.video-task-meta-line {
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 4px;
  font-size: 11px;
  color: var(--text-3);
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
}
.video-task-loc {
  color: var(--text-2);
}
.video-task-sep { color: var(--text-3); opacity: 0.5; }
.video-task-error {
  margin-top: 5px;
  font-size: 11px;
  line-height: 1.45;
  color: var(--error);
}
.video-task-status {
  justify-self: end;
  align-self: center;
}
.video-task-action {
  justify-self: end;
  align-self: center;
  min-width: 76px;
  justify-content: center;
}
.video-task-inspector {
  min-width: 0;
  overflow-y: auto;
  border-left: 1px solid var(--border);
  background: var(--surface-muted);
}
.video-inspector-head {
  min-height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid var(--surface-outline);
}
.video-inspector-title { color: var(--text-0); font-size: 14px; font-weight: 700; }
.video-inspector-sub { margin-top: 2px; color: var(--text-3); font-size: 11px; }
.video-inspector-body { display: flex; flex-direction: column; gap: 16px; padding: 16px 18px 18px; }
.video-inspector-section { display: flex; flex-direction: column; gap: 7px; }
.video-inspector-label { color: var(--text-0); font-size: 12px; font-weight: 700; }
.video-inspector-label-hero {
  color: var(--accent);
  font-size: 13px;
  display: flex;
  align-items: center;
  gap: 6px;
}
.video-inspector-label-hero::before {
  content: '';
  width: 3px;
  height: 13px;
  border-radius: 2px;
  background: var(--accent);
}
.video-inspector-prompt-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.video-inspector-h3-section {
  padding-top: 14px;
  border-top: 1px solid var(--surface-outline);
}
.video-inspector-hint { margin-top: 4px; color: var(--text-3); font-size: 10px; }
.video-inspector-h3-prompt {
  min-height: 230px;
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.55;
}
.video-inspector-h3-active {
  padding: 7px 9px;
  border: 1px solid color-mix(in srgb, var(--success) 32%, transparent);
  border-radius: var(--radius);
  background: color-mix(in srgb, var(--success) 8%, transparent);
  color: var(--success);
  font-size: 11px;
}
/* MentionTextarea 内部元素需 :deep 穿透（scoped 样式默认到不了子组件内部） */
:deep(.video-inspector-prompt) {
  min-height: 176px;
  font-size: 13px;
  line-height: 1.6;
  border-color: var(--accent-bg);
  background: var(--accent-bg);
}
.video-inspector-assets { display: grid; grid-template-columns: repeat(auto-fill, minmax(128px, 1fr)); gap: 8px; }
.video-inspector-asset {
  position: relative;
  min-height: 86px;
  overflow: hidden;
  border: 1px solid var(--surface-outline);
  border-radius: var(--radius);
  background: var(--bg-2);
  color: var(--text-3);
  cursor: pointer;
}
.video-inspector-asset:disabled { cursor: default; }
.video-inspector-asset img { width: 100%; height: 86px; display: block; object-fit: cover; }
.video-inspector-asset > span { min-height: 86px; display: flex; align-items: center; justify-content: center; font-size: 11px; }
.video-inspector-asset small {
  position: absolute;
  right: 0;
  bottom: 0;
  left: 0;
  padding: 4px 6px;
  overflow: hidden;
  background: var(--media-scrim);
  color: var(--text-invert);
  font-size: 10px;
  text-align: left;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.video-inspector-empty { padding: 12px; border: 1px dashed var(--surface-outline); border-radius: var(--radius); color: var(--text-3); font-size: 11px; }
.video-inspector-params { display: grid; gap: 8px; }
.video-inspector-params div { display: flex; justify-content: space-between; gap: 12px; font-size: 12px; }
.video-inspector-params dt { color: var(--text-3); }
.video-inspector-params dd { margin: 0; color: var(--text-1); text-align: right; }
.video-inspector-action { width: 100%; }
.video-ref-media-list { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 8px; }
.video-ref-media-chip {
  display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px;
  border: 1px solid var(--surface-outline); border-radius: 980px;
  font-size: 11px; color: var(--text-1); background: var(--surface-muted);
}
.video-ref-media-remove {
  border: none; background: none; padding: 0; cursor: pointer;
  color: var(--text-3); font-size: 13px; line-height: 1;
}
.video-ref-media-remove:hover { color: var(--text-0); }
.video-ref-media-actions { display: grid; gap: 7px; }
.video-ref-action-group {
  display: grid;
  grid-template-columns: minmax(70px, 1fr) auto auto;
  align-items: center;
  gap: 6px;
  padding: 7px 8px;
  border: 1px solid var(--surface-outline);
  border-radius: var(--radius);
  background: var(--bg-2);
}
.video-ref-action-group > span { color: var(--text-2); font-size: 11px; font-weight: 600; }
.video-ref-media-hint { margin-top: 6px; font-size: 11px; color: var(--warning); }
.video-param-row { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 4px 0; font-size: 12px; }
.video-param-name { color: var(--text-3); flex-shrink: 0; }
.video-param-value { color: var(--text-1); text-align: right; font-size: 11px; }
.video-param-control { display: inline-flex; align-items: center; gap: 6px; }
.video-param-unit { font-size: 11px; color: var(--text-3); }
.video-duration-input { width: 64px; padding: 4px 8px; font-size: 12px; }

.ref-asset-picker-overlay { z-index: 120; }
.ref-asset-picker-sub { margin: 4px 0 0; color: var(--text-3); font-size: 11px; }
.ref-asset-picker-body { min-height: 260px; overflow-y: auto; }
.ref-asset-picker-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; }
.ref-asset-card {
  position: relative;
  display: flex;
  min-width: 0;
  flex-direction: column;
  gap: 4px;
  padding: 7px;
  overflow: hidden;
  border: 1px solid var(--surface-outline);
  border-radius: var(--radius-lg);
  background: var(--surface-raised);
  color: var(--text-1);
  text-align: left;
  cursor: pointer;
}
.ref-asset-card:hover { border-color: var(--accent); }
.ref-asset-card.selected { border-color: var(--accent); box-shadow: inset 0 0 0 1px var(--accent); background: var(--accent-bg); }
.ref-asset-card.locked { border-color: var(--success); }
.ref-asset-card img,
.ref-asset-card video { width: 100%; height: 112px; display: block; border-radius: calc(var(--radius) - 2px); object-fit: cover; background: var(--media-stage-bg); }
.ref-asset-audio-preview { height: 112px; display: grid; place-items: center; border-radius: calc(var(--radius) - 2px); background: linear-gradient(145deg, var(--accent-bg), var(--bg-2)); color: var(--accent); font-size: 36px; }
.ref-asset-card strong { overflow: hidden; font-size: 12px; text-overflow: ellipsis; white-space: nowrap; }
.ref-asset-card small { color: var(--text-3); font-size: 10px; }
.ref-asset-card-check { position: absolute; top: 13px; right: 13px; z-index: 1; padding: 3px 6px; border-radius: 999px; background: rgba(20,20,24,.72); color: var(--text-invert); font-size: 9px; }
.ref-asset-picker-empty { min-height: 220px; display: flex; align-items: center; justify-content: center; gap: 8px; color: var(--text-3); font-size: 12px; }

/* Prod grid */
.prod-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 12px; }
.prod-card {
  display: flex; flex-direction: column; overflow: hidden;
  transition: transform var(--dur-base) var(--ease-out), box-shadow var(--dur-base) var(--ease-out), border-color var(--dur-base) var(--ease-out);
  border-radius: 20px;
  background: var(--surface-raised);
  border: 1px solid var(--surface-outline);
}
.prod-card:hover { transform: translateY(-2px); box-shadow: var(--shadow-lift); }
.prod-cover { position: relative; aspect-ratio: 16/9; background: var(--bg-2); overflow: hidden; }
.prod-cover img { width: 100%; height: 100%; object-fit: cover; }
.prod-video { width: 100%; height: 100%; object-fit: cover; background: var(--media-stage-bg); display: block; }
.prod-cover-empty { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: var(--text-3); }
.prod-idx {
  position: absolute; top: 5px; left: 5px; font-size: 10px; font-weight: 700;
  font-family: var(--font-mono); background: var(--media-scrim); color: var(--text-invert); padding: 1px 5px; border-radius: 3px;
}
.prod-overlay-badge {
  position: absolute; bottom: 5px; right: 5px; font-size: 10px; font-weight: 600;
  background: var(--success); color: var(--text-invert); padding: 1px 5px; border-radius: 3px;
}
.prod-info { padding: 10px 12px 8px; }
.prod-desc { font-size: 12px; line-height: 1.4; }
.prod-meta-line { margin-top: 5px; font-size: 10px; color: var(--text-3); }
.prod-dots { display: flex; align-items: center; gap: 4px; margin-top: 5px; color: var(--text-3); }
.prod-error {
  margin-top: 6px;
  font-size: 11px;
  line-height: 1.45;
  color: var(--error);
}
.prod-actions { display: flex; gap: 6px; padding: 8px 10px 10px; border-top: 1px solid var(--surface-outline); }
.prod-actions .btn { flex: 1; justify-content: center; }

/* Asset detail dialog */
.asset-detail-overlay {
  z-index: 118;
  padding: 28px;
}
.asset-detail-dialog {
  width: min(1040px, calc(100vw - 56px));
  max-height: calc(100vh - 56px);
}
.asset-detail-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--surface-outline);
}
.asset-detail-title-block {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.asset-detail-kicker {
  color: var(--text-3);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
.asset-detail-title {
  margin: 0;
  color: var(--text-0);
  font-size: 18px;
  line-height: 1.2;
  font-family: var(--font-display);
}
.asset-detail-head-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.asset-detail-body {
  min-height: 0;
  overflow: auto;
  padding: 16px;
}
.asset-detail-shell {
  display: grid;
  grid-template-columns: minmax(280px, 380px) minmax(0, 1fr);
  gap: 14px;
  align-items: start;
}
.asset-detail-preview-panel,
.asset-detail-editor-panel {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.asset-detail-preview-panel {
  position: sticky;
  top: 0;
}
.asset-detail-section-title {
  min-height: 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  color: var(--text-1);
  font-size: 12px;
  font-weight: 820;
  letter-spacing: 0.02em;
}
.asset-detail-section-title .dim {
  font-size: 11px;
  font-weight: 560;
  letter-spacing: 0;
  text-align: right;
}
.asset-detail-media-frame {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;
  display: block;
  padding: 0;
  border: 1px solid var(--surface-outline);
  border-radius: var(--radius);
  background: var(--bg-2);
  color: var(--text-3);
  overflow: hidden;
  cursor: zoom-in;
}
.asset-detail-media-frame:disabled {
  cursor: default;
  opacity: 1;
}
.asset-detail-media-frame:focus-visible {
  outline: none;
  border-color: var(--action-primary);
  box-shadow: 0 0 0 3px var(--button-focus);
}
.asset-detail-media-frame img {
  width: 100%;
  height: 100%;
  display: block;
  object-fit: cover;
}
.asset-detail-media-empty {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-3);
}
.asset-detail-desc {
  margin: 0;
  color: var(--text-1);
  font-size: 13px;
  line-height: 1.7;
}
.asset-detail-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
}
.asset-detail-field {
  min-width: 0;
  padding: 9px 10px;
  border: 1px solid var(--surface-outline);
  border-radius: var(--radius);
  background: var(--surface-muted);
}
.asset-detail-field span,
.asset-detail-edit-field span,
.asset-detail-text-block span,
.asset-detail-shot-head {
  display: block;
  color: var(--text-3);
  font-size: 10px;
  font-weight: 780;
  letter-spacing: 0.04em;
}
.asset-detail-field strong {
  display: block;
  margin-top: 5px;
  min-width: 0;
  overflow: hidden;
  color: var(--text-0);
  font-size: 12px;
  line-height: 1.35;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.asset-detail-text-block {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
.asset-detail-edit-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 10px;
}
.asset-detail-edit-grid--character,
.asset-detail-edit-grid--scene {
  grid-template-columns: 1fr;
}
.asset-detail-edit-field {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 7px;
}
.asset-detail-textarea {
  min-height: 138px;
  resize: vertical;
}
.asset-detail-edit-grid--character .asset-detail-textarea,
.asset-detail-edit-grid--scene .asset-detail-textarea {
  min-height: 164px;
}
.asset-detail-meta-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
.asset-detail-meta-item {
  min-width: 0;
  padding: 9px 10px;
  border: 1px solid var(--surface-outline);
  border-radius: var(--radius);
  background: var(--surface-muted);
}
.asset-detail-meta-item span {
  display: block;
  color: var(--text-3);
  font-size: 10px;
  font-weight: 780;
  letter-spacing: 0.04em;
}
.asset-detail-meta-item strong {
  display: block;
  margin-top: 4px;
  min-width: 0;
  color: var(--text-0);
  font-size: 12px;
  line-height: 1.35;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.asset-detail-text-block > div,
.asset-detail-shot-list {
  padding: 10px;
  border: 1px solid var(--surface-outline);
  border-radius: var(--radius);
  background: var(--surface-muted);
}
.asset-detail-text-block p {
  margin: 5px 0 0;
  color: var(--text-2);
  font-size: 12px;
  line-height: 1.55;
}
.asset-detail-shot-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.asset-detail-shot-items {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.asset-detail-shot-row {
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr) auto;
  align-items: center;
  gap: 8px;
  color: var(--text-2);
  font-size: 11px;
}
.asset-detail-shot-row strong {
  min-width: 0;
  overflow: hidden;
  color: var(--text-1);
  font-weight: 650;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.asset-detail-shot-row small,
.asset-detail-empty {
  color: var(--text-3);
  font-size: 11px;
}
.asset-detail-foot {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid var(--surface-outline);
}
.asset-detail-secondary-actions,
.asset-detail-primary-actions {
  display: flex;
  align-items: center;
  gap: 8px;
}
.asset-detail-prompt-panel {
  min-width: 0;
  margin-top: 14px;
  padding-top: 14px;
  border-top: 1px solid var(--surface-outline);
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.asset-detail-prompt-head-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}
.asset-detail-copy-btn {
  gap: 5px;
}
.asset-detail-prompt-textarea {
  min-height: 96px;
  max-height: 260px;
  overflow: auto;
  padding: 12px 14px;
  border: 1px solid var(--surface-outline);
  border-radius: var(--radius);
  background: var(--surface-muted);
  color: var(--text-1);
  font-size: 12px;
  line-height: 1.65;
  white-space: pre-wrap;
  word-break: break-word;
  resize: vertical;
  width: 100%;
}
.asset-detail-prompt-hint {
  margin: 0;
  color: var(--text-3);
  font-size: 11px;
  line-height: 1.5;
}
.asset-detail-readonly-grid {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.asset-detail-readonly {
  min-width: 0;
  padding: 10px 12px;
  border: 1px solid var(--surface-outline);
  border-radius: var(--radius);
  background: var(--surface-muted);
}
.asset-detail-readonly span {
  display: block;
  color: var(--text-3);
  font-size: 10px;
  font-weight: 780;
  letter-spacing: 0.04em;
}
.asset-detail-readonly p {
  margin: 6px 0 0;
  color: var(--text-1);
  font-size: 12px;
  line-height: 1.65;
  white-space: pre-wrap;
  word-break: break-word;
  user-select: text;
}
.asset-detail-readonly p.dim {
  color: var(--text-3);
}

/* Image viewer */
.image-viewer-overlay {
  z-index: 120;
  padding: 28px;
}
.image-viewer-dialog {
  width: min(1100px, calc(100vw - 56px));
  max-height: calc(100vh - 56px);
  background: var(--surface-glass);
  backdrop-filter: blur(20px) saturate(180%);
  -webkit-backdrop-filter: blur(20px) saturate(180%);
}
.image-viewer-head {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px 18px;
  border-bottom: 1px solid var(--surface-outline);
}
.image-viewer-title {
  font-size: 14px;
  font-weight: 700;
  color: var(--text-1);
  font-family: var(--font-display);
}
.image-viewer-body {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 20px;
  overflow: auto;
  min-height: 0;
}
.image-viewer-img {
  display: block;
  max-width: 100%;
  max-height: calc(100vh - 140px);
  border-radius: 18px;
  box-shadow: 0 18px 48px rgba(0,0,0,0.18);
  background: var(--surface-muted);
}

/* Export（P2-B2：拼接导出面板样式已下沉 components/EpisodeExportPanel.vue；
      仅保留成片大预览弹窗 merge-viewer-*，供主壳 activeMerge 弹窗使用） */
.merge-viewer-dialog { width: min(1080px, calc(100vw - 56px)); }
.merge-viewer-body {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 18px;
  min-height: 0;
}
.merge-viewer-video {
  width: 100%;
  max-height: calc(100vh - 220px);
  border-radius: var(--radius);
  background: var(--media-stage-bg);
  display: block;
}

/* Shared */
.dim { color: var(--text-3); }

@media (max-width: 1080px) {
  .split-layout {
    flex-direction: column;
  }

  .sb-scene-select { max-width: none; flex: 1; }

  .shot-list {
    width: 100%;
  }

  .detail-panel {
    min-height: 420px;
  }

  .field-grid-4 {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .character-asset-grid {
    grid-template-columns: repeat(auto-fill, minmax(420px, 1fr));
  }

  .video-task-head {
    align-items: flex-start;
    flex-direction: column;
  }

  .video-task-metrics {
    width: 100%;
    margin-left: 0;
    justify-content: flex-start;
  }

  .video-task-row {
    grid-template-columns: 84px minmax(0, 1fr);
  }

  .video-task-preview {
    width: 84px;
  }

  .video-task-status,
  .video-task-action {
    justify-self: start;
  }

  .image-viewer-overlay {
    padding: 16px;
  }

  .image-viewer-dialog {
    width: calc(100vw - 32px);
    max-height: calc(100vh - 32px);
  }

  .asset-detail-overlay {
    padding: 16px;
  }

  .asset-detail-dialog {
    width: calc(100vw - 32px);
    max-height: calc(100vh - 32px);
  }

  .asset-detail-shell {
    grid-template-columns: 1fr;
  }

  .asset-detail-preview-panel {
    position: static;
  }

  .asset-detail-grid,
  .asset-detail-edit-grid,
  .asset-detail-text-block {
    grid-template-columns: 1fr;
  }

}

/* ===== 任务列表面板 ===== */
.gen-task-row {
  grid-template-columns: 84px minmax(0, 1fr) auto;
  cursor: default;
}
.gen-task-row .video-task-preview img {
  cursor: zoom-in;
}

/* 任务触发按钮(顶栏) */
.task-drawer-trigger {
  position: relative;
}
.task-drawer-badge {
  min-width: 16px;
  height: 16px;
  padding: 0 4px;
  border-radius: 999px;
  background: var(--accent);
  color: var(--action-primary-text);
  font-size: 10px;
  font-weight: 700;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
}

/* 右侧抽屉内容布局（骨架已收敛至 AppDrawer；此处仅剩插槽内页面级布局类） */
.task-drawer-head-actions {
  display: flex;
  align-items: center;
  gap: 6px;
}
.task-drawer-metrics {
  padding: 10px 16px;
  border-bottom: 1px solid var(--surface-outline);
}
.task-drawer-body {
  flex: 1;
  overflow-y: auto;
}
.task-drawer-empty {
  flex: 1;
  justify-content: center;
}

@media (max-width: 860px) {
  .studio {
    padding: 8px;
    gap: 8px;
  }

  .studio-topbar-main {
    align-items: flex-start;
  }

  .studio-topbar {
    flex-direction: column;
    align-items: stretch;
  }

  .studio-topbar-side {
    justify-content: space-between;
  }

  .studio-body {
    grid-template-columns: 1fr;
  }

  .studio-sidebar-resizer {
    display: none;
  }

  .sidebar {
    max-height: 340px;
    height: auto !important;
  }

  .studio-topbar-side,
  .studio-actions {
    flex-wrap: wrap;
  }

  .toolbar-right,
  .step-bubble,
  .export-bar {
    flex-wrap: wrap;
  }

  .asset-grid,
  .character-asset-grid,
  .prod-grid {
    grid-template-columns: 1fr;
  }

  .character-asset-card {
    min-height: 0;
  }

  .character-asset-overview {
    grid-template-columns: 1fr;
  }

  .character-portrait {
    width: auto;
  }

  .character-asset-main {
    padding: 10px;
  }

  .character-asset-head {
    align-items: stretch;
    flex-direction: column;
  }

  .video-task-workbench {
    grid-template-columns: 1fr;
    overflow-y: auto;
    height: auto !important;
    flex: 1 1 auto !important;
  }

  .video-column-resizer,
  .video-row-resizer,
  .workbench-height-resizer,
  .panel-resizer-sidebar-height {
    display: none;
  }

  .storyboard-workbench {
    height: auto !important;
    flex: 1 1 auto !important;
  }

  .video-task-inspector {
    border-top: 1px solid var(--surface-outline);
    border-left: 0;
  }

  .video-task-side {
    display: flex;
    flex-direction: column;
    border-top: 1px solid var(--surface-outline);
    border-left: 0;
  }

  .video-task-side .video-task-inspector {
    flex: none; /* 窄屏下由外层 workbench 整体滚动，检查器按内容撑开，不参与 flex 收缩 */
    border-top: 0;
  }

  .video-task-player {
    flex: none; /* 禁止收缩：否则 stage 的 min-height 会使其溢出播放器并遮挡下方检查器 */
  }

  .video-player-stage {
    flex: none;
    min-height: 240px;
  }

  .frame-row {
    flex-direction: column;
    align-items: stretch;
  }

  .detail-hero {
    grid-template-columns: 1fr;
  }

  .field-grid-2,
  .field-grid-4 {
    grid-template-columns: 1fr;
  }

  .frame-thumbs {
    width: 100%;
  }

  .frame-thumb {
    width: 100%;
  }

}
</style>
