<template>
  <div class="page" v-if="drama">
    <!-- Header -->
    <div class="page-head card">
      <button class="back-btn" title="返回" @click="navigateTo('/')">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
          <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
        </svg>
      </button>
      <div class="head-info">
        <div class="head-title-row">
          <h1 class="page-title">{{ drama.title }}</h1>
          <span v-if="drama.style" class="tag tag-accent">{{ styleLabel(drama.style) }}</span>
        </div>
        <div class="page-meta">
          <span class="meta-item">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            {{ drama.characters?.length || 0 }} 角色
          </span>
          <span class="meta-item">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/></svg>
            {{ drama.scenes?.length || 0 }} 场景
          </span>
          <span class="meta-item">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.5"/><line x1="7" y1="8" x2="7" y2="16"/><line x1="10" y1="8" x2="10" y2="16"/><line x1="13" y1="8" x2="13" y2="16"/><line x1="16" y1="8" x2="16" y2="16"/></svg>
            {{ drama.episodes?.length || 0 }} 集
          </span>
        </div>
      </div>
      <button class="btn btn-primary head-action" @click="openAddEpisode">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round">
          <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
        </svg>
        添加集
      </button>
    </div>

    <!-- 主 Tab：剧集列表 / 素材库 -->
    <nav class="page-tabs">
      <button type="button" :class="['tab-btn', { on: activeTab === 'source' }]" @click="activeTab = 'source'">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="14" y2="17"/></svg>
        全文内容
        <span v-if="projectDraft.content" class="tab-count">{{ projectDraft.content.length.toLocaleString() }}字</span>
      </button>
      <button type="button" :class="['tab-btn', { on: activeTab === 'episodes' }]" @click="activeTab = 'episodes'">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="2" width="20" height="20" rx="2.5"/><line x1="7" y1="8" x2="7" y2="16"/><line x1="10" y1="8" x2="10" y2="16"/><line x1="13" y1="8" x2="13" y2="16"/><line x1="16" y1="8" x2="16" y2="16"/></svg>
        剧集列表
        <span class="tab-count">{{ drama.episodes?.length || 0 }}</span>
      </button>
      <button type="button" :class="['tab-btn', { on: activeTab === 'assets' }]" @click="switchToAssets">
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
        素材库
        <span v-if="assetTotal > 0" class="tab-count">{{ assetTotal }}</span>
      </button>
    </nav>

    <!-- 全文内容与项目级设置 -->
    <div v-if="activeTab === 'source'" class="source-workspace">
      <div class="source-editor-layout">
        <section class="card source-manuscript-card">
          <div class="source-card-head">
            <div>
              <span class="source-eyebrow">MASTER TEXT</span>
              <h2>全文内容</h2>
              <p>这是项目的原始事实源。修改后可重新匹配风格、推荐集数并生成分集草稿。</p>
            </div>
            <span class="source-char-count">{{ projectDraft.content.length.toLocaleString() }} 字</span>
          </div>
          <textarea
            v-model="projectDraft.content"
            class="textarea source-manuscript"
            maxlength="200000"
            placeholder="粘贴或修改小说、短文、故事梗概……"
          ></textarea>
        </section>

        <aside class="card project-settings-card">
          <div class="source-card-head compact">
            <div>
              <span class="source-eyebrow">PROJECT SETTINGS</span>
              <h2>项目设置</h2>
            </div>
          </div>
          <div class="project-setting-fields">
            <label class="field">
              <span class="field-label">项目标题</span>
              <input v-model.trim="projectDraft.title" class="input" placeholder="项目标题" />
            </label>
            <label class="field">
              <span class="field-label">画面比例</span>
              <BaseSelect v-model="projectDraft.aspect_ratio" :options="projectAspectRatioOptions" placeholder="选择画面比例" />
            </label>
            <label class="field">
              <span class="field-label">默认视频分辨率</span>
              <BaseSelect v-model="projectDraft.resolution" :options="resolutionOptions" placeholder="选择分辨率" />
              <span class="field-hint">用于随后批量生成的分集草稿，之后仍可逐集修改。</span>
            </label>
          </div>

          <div class="project-style-panel">
            <div class="project-style-head">
              <div>
                <span class="field-label">视觉风格</span>
                <small>已有、自定义或全文 AI 匹配</small>
              </div>
              <button type="button" class="btn btn-sm" :disabled="projectStyleAnalyzing || projectDraft.content.trim().length < 20" @click="analyzeProjectStyles">
                <span v-if="projectStyleAnalyzing" class="ring-spinner sm"></span>
                <svg v-else width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M12 3v3m0 12v3m9-9h-3M6 12H3m13.5-6.5L14 8m-4 8-2.5 2.5m11 0L16 16M8 8 5.5 5.5"/><circle cx="12" cy="12" r="3"/></svg>
                {{ projectStyleAnalyzing ? '匹配中…' : 'AI 匹配 3 个' }}
              </button>
            </div>
            <div v-if="projectStyleCandidates.length" class="project-style-candidates">
              <button
                v-for="item in projectStyleCandidates"
                :key="`${item.source}-${item.value}`"
                type="button"
                :class="['project-style-choice', { on: !projectCustomStyleActive && projectDraft.style === item.value }]"
                @click="selectProjectStyle(item)"
              >
                <span>{{ item.source === 'new' ? '新风格' : '已有' }}</span>
                <strong>{{ item.name }}</strong>
                <small>{{ item.reason || item.description }}</small>
              </button>
            </div>
            <div class="project-style-select-row">
              <BaseSelect v-model="projectExistingStyleValue" :options="projectStyleOptions" placeholder="选择已有风格" searchable />
              <button type="button" :class="['btn', 'btn-sm', { on: projectCustomStyleActive }]" @click="toggleProjectCustomStyle">自定义</button>
            </div>
            <div v-if="projectCustomStyleActive" class="project-custom-style">
              <input v-model.trim="projectCustomStyle.name" class="input" placeholder="自定义风格名称" />
              <textarea v-model.trim="projectCustomStyle.prompt" class="textarea" rows="3" placeholder="描述色彩、光线、材质、镜头和时代感，可直接作为风格提示词"></textarea>
            </div>
            <label v-else-if="selectedProjectStyle?.source === 'new'" class="project-new-style-confirm">
              <input v-model="confirmProjectNewStyle" type="checkbox" />
              确认创建“{{ selectedProjectStyle.name }}”并加入已有风格库
            </label>
          </div>

          <button class="btn btn-primary project-save-btn" :disabled="sourceSaving || !canSaveProjectSettings" @click="saveProjectSettings">
            {{ sourceSaving ? '保存中…' : '保存全文与项目设置' }}
          </button>
        </aside>
      </div>

      <section class="card episode-planner-card">
        <div class="episode-planner-head">
          <div>
            <span class="source-eyebrow">EPISODE PLANNER</span>
            <h2>AI 集数建议与分集草稿</h2>
            <p>AI 负责判断节奏、给出标题和每集重点；每集正文由系统按原文顺序拆分，不会擅自改写全文。</p>
          </div>
          <button type="button" class="btn btn-primary" :disabled="episodeAnalyzing || projectDraft.content.trim().length < 20" @click="analyzeEpisodePlan(false)">
            <span v-if="episodeAnalyzing" class="ring-spinner sm"></span>
            {{ episodeAnalyzing ? '正在分析全文…' : 'AI 推荐集数' }}
          </button>
        </div>

        <div v-if="episodePlan" class="episode-plan-result">
          <div class="episode-count-control">
            <div class="recommended-count">
              <span>建议集数</span>
              <strong>{{ episodePlan.recommended_count }}</strong>
              <p>{{ episodePlan.reason }}</p>
            </div>
            <label>
              <span>调整集数</span>
              <input v-model.number="episodeCount" class="input" type="number" min="1" max="30" />
            </label>
            <button type="button" class="btn" :disabled="episodeAnalyzing" @click="analyzeEpisodePlan(true)">按此集数重新拆分</button>
          </div>

          <div v-if="episodePlanStale" class="episode-plan-stale">
            <strong>全文已发生变化</strong>
            <span>原分集建议仍为你保留，但需要重新点击“AI 推荐集数”后才能确认生成。</span>
          </div>
          <div v-if="episodePlanConflict" class="episode-plan-conflict" role="alert">
            <div>
              <strong>服务器草稿已有新版本</strong>
              <span>可能是另一个浏览器窗口刚刚保存了修改。当前页面不会覆盖它，请重新加载服务器版本后继续。</span>
            </div>
            <button type="button" class="btn btn-sm" @click="reloadServerEpisodePlan">重新加载服务器版本</button>
          </div>

          <div class="episode-review-toolbar">
            <div class="review-progress-copy">
              <span>审阅进度</span>
              <strong>{{ reviewedEpisodeCount }} / {{ episodePlan.episodes.length }} 集已确认</strong>
              <small v-if="episodePlanSaving">正在保存服务器草稿…</small>
              <small v-else>服务器版本 V{{ episodePlanVersion }}<template v-if="episodePlanRevisionCount"> · 已保留 {{ episodePlanRevisionCount }} 次修订</template></small>
            </div>
            <div class="review-progress-track" aria-hidden="true">
              <i :style="{ width: `${reviewProgressPercent}%` }"></i>
            </div>
            <button type="button" class="btn btn-sm" :disabled="allEpisodesReviewed || episodePlanStale" @click="confirmAllEpisodes">
              {{ allEpisodesReviewed ? '已全部确认' : '一键审阅确认' }}
            </button>
          </div>

          <div class="episode-draft-grid">
            <article
              v-for="episode in episodePlan.episodes"
              :key="episode.episode_number"
              :class="['episode-draft-card', { reviewed: episode.reviewed }]"
              role="button"
              tabindex="0"
              @click="selectEpisodeReview(episode)"
              @keydown.enter.prevent="selectEpisodeReview(episode)"
            >
              <div class="episode-draft-topline">
                <div class="episode-draft-number">EP {{ String(episode.episode_number).padStart(2, '0') }}</div>
                <span :class="['episode-review-state', { reviewed: episode.reviewed }]">{{ episode.reviewed ? '已确认' : '待审阅' }}</span>
              </div>
              <input v-model.trim="episode.title" class="episode-draft-title" @click.stop @input="invalidateEpisodeReview(episode)" />
              <textarea v-model.trim="episode.summary" class="episode-draft-summary" rows="2" placeholder="本集摘要" @click.stop @input="invalidateEpisodeReview(episode)"></textarea>
              <p>{{ episode.content }}</p>
              <div class="episode-draft-footline">
                <span>{{ episode.character_count.toLocaleString() }} 字</span>
                <button type="button" class="episode-review-open" @click.stop="selectEpisodeReview(episode)">查看详情</button>
              </div>
            </article>
          </div>

          <section ref="episodeReviewSection" class="episode-inline-review">
            <div class="episode-inline-review-head">
              <div>
                <span class="source-eyebrow">EPISODE DETAIL</span>
                <h3>逐集详情、二次编辑与批注</h3>
                <p>点击集数 Tab 切换内容；修改标题、摘要或批注后，需要重新确认本集。</p>
              </div>
              <span v-if="activeReviewEpisode" :class="['episode-review-state', 'large', { reviewed: activeReviewEpisode.reviewed }]">{{ activeReviewEpisode.reviewed ? '已确认' : '待确认' }}</span>
            </div>

            <div class="episode-detail-tabs" role="tablist" aria-label="分集详情切换" :style="{ '--episode-tab-count': episodePlan.episodes.length }">
              <button
                v-for="episode in episodePlan.episodes"
                :key="`detail-tab-${episode.episode_number}`"
                type="button"
                role="tab"
                :aria-selected="selectedEpisodeNumber === episode.episode_number"
                :class="['episode-detail-tab', { on: selectedEpisodeNumber === episode.episode_number, reviewed: episode.reviewed }]"
                @click="selectEpisodeReview(episode, false)"
              >
                <span>EP {{ String(episode.episode_number).padStart(2, '0') }}</span>
                <i></i>
              </button>
            </div>

            <div v-if="activeReviewEpisode" class="episode-inline-review-panel" role="tabpanel">
              <div class="episode-review-fields">
                <label class="field">
                  <span class="field-label">本集标题</span>
                  <input v-model.trim="activeReviewEpisode.title" class="input episode-review-title-input" @input="invalidateEpisodeReview(activeReviewEpisode)" />
                </label>
                <label class="field">
                  <span class="field-label">本集摘要</span>
                  <textarea v-model.trim="activeReviewEpisode.summary" class="textarea" rows="4" placeholder="本集摘要" @input="invalidateEpisodeReview(activeReviewEpisode)"></textarea>
                </label>
                <label class="field episode-review-note-field">
                  <span class="field-label">本集批注</span>
                  <textarea v-model.trim="activeReviewEpisode.review_note" class="textarea episode-review-note" rows="5" maxlength="2000" placeholder="例如：本集冲突进入太慢；结尾需要更强钩子；建议把这一段移到下一集……" @input="invalidateEpisodeReview(activeReviewEpisode)"></textarea>
                  <span class="field-hint">批注会被“汇总批注并重新拆分”统一交给 AI，当前版本不会自动改变。</span>
                </label>
              </div>
              <section class="episode-review-manuscript">
                <div class="episode-review-manuscript-head">
                  <div>
                    <span class="field-label">本集原文</span>
                    <small>可在确认前二次调整；修改后需要重新确认本集</small>
                  </div>
                  <span>{{ Number(activeReviewEpisode.character_count || activeReviewEpisode.content?.length || 0).toLocaleString() }} 字</span>
                </div>
                <textarea
                  v-model="activeReviewEpisode.content"
                  class="episode-review-content episode-review-content-editable"
                  maxlength="250000"
                  aria-label="本集原文"
                  @input="onEpisodeContentInput(activeReviewEpisode)"
                ></textarea>
              </section>
              <div class="episode-inline-review-actions">
                <div class="episode-review-nav">
                  <button type="button" class="btn" :disabled="reviewEpisodeIndex <= 0" @click="moveEpisodeReview(-1)">上一集</button>
                  <span>{{ reviewEpisodeIndex + 1 }} / {{ episodePlan.episodes.length }}</span>
                  <button type="button" class="btn" :disabled="reviewEpisodeIndex >= episodePlan.episodes.length - 1" @click="moveEpisodeReview(1)">下一集</button>
                </div>
                <button v-if="activeReviewEpisode.reviewed" type="button" class="btn" @click="setEpisodeReviewed(activeReviewEpisode, false)">取消确认</button>
                <button v-else type="button" class="btn btn-primary" :disabled="episodePlanStale" @click="confirmEpisodeAndContinue">
                  {{ reviewEpisodeIndex < episodePlan.episodes.length - 1 ? '确认本集并切换下一集' : '确认本集并完成' }}
                </button>
              </div>
            </div>
          </section>

          <div class="episode-plan-foot">
            <span v-if="planAlreadyGenerated">当前审阅版本已生成到剧集列表；修改任一集后可重新确认并同步。</span>
            <span v-else-if="drama.episodes?.length && !planGeneratedByWorkflow" class="plan-warning">现有剧集不是由全文分集流程创建，系统不会自动覆盖。</span>
            <span v-else-if="episodePlanStale" class="plan-warning">请先按当前全文重新生成分集建议。</span>
            <span v-else-if="!allEpisodesReviewed">还需确认 {{ episodePlan.episodes.length - reviewedEpisodeCount }} 集，全部确认后才能生成到剧集列表。</span>
            <span v-else>全部分集已确认，可以生成到“剧集列表”。</span>
            <div class="episode-plan-actions">
              <button type="button" class="btn" :disabled="episodeAnalyzing || !hasReviewNotes || episodePlanStale || episodePlanConflict" @click="reanalyzeFromReviewNotes">
                {{ episodeAnalyzing ? '正在汇总批注…' : `汇总 ${reviewNoteCount} 条批注并重新拆分` }}
              </button>
              <button type="button" class="btn btn-primary" :disabled="committingEpisodes || episodePlanSaving || episodePlanConflict || planAlreadyGenerated || !allEpisodesReviewed || episodePlanStale || (!!drama.episodes?.length && !planGeneratedByWorkflow)" @click="commitEpisodePlan">
                {{ committingEpisodes ? '正在生成剧集…' : planAlreadyGenerated ? '已生成到剧集列表' : allEpisodesReviewed ? `生成 ${episodePlan.episodes.length} 集到剧集列表` : `待确认 ${episodePlan.episodes.length - reviewedEpisodeCount} 集` }}
              </button>
            </div>
          </div>
        </div>
      </section>
    </div>

    <div v-else-if="activeTab === 'episodes'" class="ep-grid">
      <div
        v-for="(ep, i) in drama.episodes"
        :key="ep.id"
        :class="['card', 'ep-card', `ep-card-${epStatus(ep)}`]"
        :style="{ animationDelay: `${i * 0.05}s` }"
        @click="navigateTo(`/drama/${drama.id}/episode/${ep.episode_number || ep.episodeNumber}`)"
      >
        <!-- 卡片顶部：编号 + 状态 + 操作 -->
        <div class="ep-header">
          <div :class="['ep-number', `ep-num-${epStatus(ep)}`]">
            <span class="ep-num-label">EP</span>
            <b>{{ String(ep.episode_number || ep.episodeNumber).padStart(2, '0') }}</b>
          </div>
          <div class="ep-badges" @click.stop>
            <button type="button" :class="['tag', 'ep-status-btn', `ep-status-${epStatus(ep)}`]" title="点击标记本集状态" @click="epStatusMenuId = epStatusMenuId === ep.id ? null : ep.id">
              <span :class="['status-dot', epStatusDotClass(ep)]"></span>
              {{ epStatusLabel(ep) }}
            </button>
            <div v-if="epStatusMenuId === ep.id" class="status-menu">
              <button
                v-for="s in epStatusOptions"
                :key="s.value"
                type="button"
                class="status-menu-item"
                :class="{ on: epStatus(ep) === s.value }"
                @click="setEpisodeStatus(ep, s.value)"
              >{{ s.label }}</button>
            </div>
          </div>
          <div class="ep-actions" @click.stop>
            <button type="button" :class="['tag', 'ep-res-btn']" title="点击修改本集视频分辨率" @click="epResMenuId = epResMenuId === ep.id ? null : ep.id">
              {{ epResolution(ep) }}
            </button>
            <div v-if="epResMenuId === ep.id" class="status-menu">
              <button
                v-for="r in resolutionOptions"
                :key="r.value"
                type="button"
                class="status-menu-item"
                :class="{ on: epResolution(ep) === r.value }"
                @click="setEpisodeResolution(ep, r.value)"
              >{{ r.label }}</button>
            </div>
            <button
              class="btn btn-icon btn-sm ep-delete"
              type="button"
              title="删除本集"
              @click="episodeToDelete = ep"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- 标题 -->
        <h3 class="ep-title">{{ ep.title }}</h3>

        <div v-if="ep.content" class="ep-source-preview">
          <span>全文拆分草稿 · 待复核</span>
          <p>{{ ep.content }}</p>
        </div>

        <!-- 元数据行 -->
        <div class="ep-meta-row">
          <span v-if="ep.duration" class="ep-meta">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            {{ ep.duration }}s
          </span>
          <span v-if="ep.scriptContent || ep.script_content" class="ep-meta ep-meta-ok">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
            剧本已录入
          </span>
          <span v-if="ep.videoUrl || ep.video_url" class="ep-meta ep-meta-ok">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2"/></svg>
            已合成
          </span>
        </div>

        <!-- 底部：更新时间 + 进入箭头 -->
        <div class="ep-footer">
          <span v-if="ep.updatedAt || ep.updated_at" class="ep-time">{{ formatEpTime(ep.updatedAt || ep.updated_at) }}</span>
          <svg class="ep-arrow" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="9 18 15 12 9 6"/>
          </svg>
        </div>
      </div>

      <!-- Empty episode state（点击也可直接添加第一集） -->
      <div v-if="!drama.episodes?.length" class="card ep-empty" role="button" tabindex="0" title="点击创建第一集" @click="openAddEpisode" @keydown.enter="openAddEpisode">
        <div class="ep-empty-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="16"/>
            <line x1="8" y1="12" x2="16" y2="12"/>
          </svg>
        </div>
        <p>点击创建第一集</p>
      </div>

      <!-- 已有剧集时，列表末尾常驻「添加下一集」卡片 -->
      <div v-else class="card ep-empty ep-add" role="button" tabindex="0" :title="`添加第 ${(drama.episodes?.length || 0) + 1} 集`" @click="openAddEpisode" @keydown.enter="openAddEpisode">
        <div class="ep-empty-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round">
            <circle cx="12" cy="12" r="10"/>
            <line x1="12" y1="8" x2="12" y2="16"/>
            <line x1="8" y1="12" x2="16" y2="12"/>
          </svg>
        </div>
        <p>添加第 {{ (drama.episodes?.length || 0) + 1 }} 集</p>
      </div>
    </div>

    <!-- 素材库 -->
    <div v-else-if="activeTab === 'assets'" class="assets-wrap">
      <div class="seg asset-filter">
        <button
          v-for="t in assetTabs"
          :key="t.value"
          type="button"
          class="seg-item"
          :class="{ on: assetTab === t.value }"
          @click="assetTab = t.value"
        >{{ t.label }}</button>
      </div>

      <!-- 全部素材为空 -->
      <div v-if="!materials.length" class="empty-state">
        <div class="empty-icon">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
          </svg>
        </div>
        <p class="empty-title">还没有任何素材</p>
        <p class="empty-desc">在剧情工作台中通过「提取资产」生成角色、场景与道具后，会自动收录到这里，并可直接生成素材图。</p>
      </div>

      <div v-else-if="materials.length" class="asset-groups">
        <template v-for="g in assetGroups" :key="g.kindKey">
          <template v-if="g.items.length">
            <div v-if="assetTab === 'all'" class="asset-group-head" :class="tagClass(g.kindKey)">
              <span class="group-icon">
                <svg v-if="g.kindKey === 'character'" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                <svg v-else-if="g.kindKey === 'scene'" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 12-9 12s-9-5-9-12a9 9 0 0 1 18 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                <svg v-else width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="M3.27 6.96 12 12l8.73-5.04M12 22.08V12"/></svg>
              </span>
              <span class="group-label">{{ g.label }}</span>
              <span class="group-count">{{ g.items.length }}</span>
            </div>

            <!-- 角色：横向布局卡片（头像 + 样貌/妆造 + 三视图提示词） -->
            <div v-if="g.kindKey === 'character'" class="character-asset-grid">
              <article
                v-for="m in g.items"
                :key="'character-' + m.id"
                class="card character-asset-card"
                tabindex="0"
                role="button"
                @click="openEdit(m)"
                @keydown.enter.prevent="openEdit(m)"
                @keydown.space.prevent="openEdit(m)"
              >
                <div class="character-asset-main">
                  <div class="character-asset-overview">
                    <div class="character-portrait">
                      <img v-if="matHasImage(m)" :src="thumbOf(assetSrc(m))" class="previewable-image" loading="lazy" @error="thumbFallback($event, assetSrc(m))" @click.stop="openAssetViewer(m)" />
                      <div v-else class="character-portrait-empty">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                      </div>
                      <span class="asset-cover-badge" :class="matHasImage(m) ? 'is-ready' : (isPending(m) ? 'is-pending' : '')">
                        {{ matHasImage(m) ? '形象已生成' : (isPending(m) ? '形象生成中' : '形象待生成') }}
                      </span>
                    </div>
                    <div class="character-asset-head">
                      <div class="character-title-block">
                        <div class="character-name-row">
                          <strong class="character-name">{{ m.name }}</strong>
                          <span class="tag">{{ m.role || '角色' }}</span>
                        </div>
                        <div class="character-visual-summary" :title="matDesc(m)">
                          <span>样貌：{{ m.appearance || '待补充' }}</span>
                          <span>妆造：{{ m.styling || '待补充' }}</span>
                        </div>
                      </div>
                      <button class="btn btn-sm character-gen-btn" type="button" :disabled="isPending(m)" @click.stop="generateMaterial(m)">
                        <span v-if="isPending(m)" class="ring-spinner sm"></span>
                        {{ matHasImage(m) ? '重绘' : (isPending(m) ? '生成中' : '生成') }}
                      </button>
                      <button class="btn btn-sm" type="button" title="上传角色形象图" :disabled="isUploading(m)" @click.stop="uploadMaterial(m)">
                        <span v-if="isUploading(m)" class="ring-spinner sm"></span>
                        <svg v-else width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                        上传
                      </button>
                    </div>
                  </div>
                  <div class="asset-final-prompt" :title="m.finalPrompt || ''">
                    <span class="afp-label">最终提示词 · 三视图</span>
                    <span :class="['afp-text', !m.finalPrompt && 'dim']">{{ m.finalPrompt || '首次生成形象时由提示词 Agent 自动生成' }}</span>
                  </div>
                </div>
              </article>
            </div>

            <!-- 场景 / 道具：竖向布局卡片（封面 + 描述/光影/类型 + 最终提示词 + 底部状态） -->
            <div v-else class="asset-grid">
              <div
                v-for="m in g.items"
                :key="g.kindKey + '-' + m.id"
                :class="['card', 'asset-card', 'asset-click-card', g.kindKey === 'prop' ? 'prop-card' : '']"
                tabindex="0"
                role="button"
                @click="openEdit(m)"
                @keydown.enter.prevent="openEdit(m)"
                @keydown.space.prevent="openEdit(m)"
              >
                <div class="asset-cover wide">
                  <img v-if="matHasImage(m)" :src="thumbOf(assetSrc(m))" class="previewable-image" loading="lazy" @error="thumbFallback($event, assetSrc(m))" @click.stop="openAssetViewer(m)" />
                  <div v-else class="asset-cover-empty">
                    <svg v-if="g.kindKey === 'scene'" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                    <svg v-else width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
                  </div>
                  <span class="asset-cover-badge" :class="matHasImage(m) ? 'is-ready' : (isPending(m) ? 'is-pending' : '')">
                    {{ matHasImage(m) ? '已生成' : (isPending(m) ? '生成中' : '待生成') }}
                  </span>
                </div>
                <div class="asset-body">
                  <template v-if="g.kindKey === 'scene'">
                    <div class="asset-name" :title="m.location">{{ m.location }}</div>
                    <div class="asset-meta asset-desc dim" :title="matDesc(m)">{{ matDesc(m) || '场景描述待补充' }}</div>
                    <div v-if="m.lighting" class="asset-meta asset-light dim" :title="m.lighting">光照 · {{ m.lighting }}</div>
                  </template>
                  <template v-else>
                    <div class="prop-name-row">
                      <span class="asset-name" :title="m.name">{{ m.name }}</span>
                      <span class="tag">{{ m.type || '道具' }}</span>
                    </div>
                    <div class="asset-meta asset-desc dim" :title="m.description || ''">{{ m.description || '暂无描述' }}</div>
                  </template>
                  <div class="asset-meta asset-final" :class="{ dim: !m.finalPrompt }" :title="m.finalPrompt || ''">
                    <span class="afp-label">{{ g.kindKey === 'scene' ? '最终提示词 · 固定视角' : '最终提示词 · 白底单品' }}</span>
                    {{ m.finalPrompt || (g.kindKey === 'scene' ? '首次生成图片时由提示词 Agent 自动生成（前景/中景/后景）' : '首次生成图片时由提示词 Agent 自动生成（白底单品）') }}
                  </div>
                </div>
                <div class="asset-foot">
                  <span :class="['dot', matHasImage(m) && 'ok', isPending(m) && 'pending']" />
                  <button class="btn btn-sm ml-auto" type="button" title="上传图片" :disabled="isUploading(m)" @click.stop="uploadMaterial(m)">
                    <span v-if="isUploading(m)" class="ring-spinner sm"></span>
                    <svg v-else width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                    上传
                  </button>
                  <button class="btn btn-sm" type="button" :disabled="isPending(m)" @click.stop="generateMaterial(m)">
                    <span v-if="isPending(m)" class="ring-spinner sm"></span>
                    {{ matHasImage(m) ? '重绘' : (isPending(m) ? '生成中' : '生成') }}
                  </button>
                </div>
              </div>
            </div>
          </template>
        </template>

        <!-- 筛选某一类但该类暂无素材 -->
        <div v-if="assetTab !== 'all' && !visibleAssets.length" class="empty-state">
          <div class="empty-icon">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round">
              <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>
            </svg>
          </div>
          <p class="empty-title">暂无{{ tabLabel(assetTab) }}素材</p>
          <p class="empty-desc">在剧情工作台中提取并生成{{ tabLabel(assetTab) }}后，会显示在这里。</p>
        </div>
      </div>

      <!-- 素材详情 / 编辑对话框（与工作台资产卡片同款布局） -->
      <div v-if="editDialog && editTarget" class="overlay mat-detail-overlay" @click.self="closeEdit">
        <section class="dialog mat-detail-dialog" aria-label="素材详情">
          <header class="dialog-head mat-detail-head">
            <div class="mat-detail-title-block">
              <span class="mat-detail-kicker">{{ editTarget.kind === '角色' ? '角色资产' : editTarget.kind === '场景' ? '场景资产' : '道具资产' }}</span>
              <h2 class="mat-detail-title">{{ editTarget.name || '未命名' }}</h2>
            </div>
            <div class="mat-detail-head-actions">
              <span v-if="editTarget.kindKey === 'character'" class="tag">{{ editTarget.role || '角色' }}</span>
              <span v-else-if="editTarget.kindKey === 'prop'" class="tag">{{ editTarget.type || '道具' }}</span>
              <span v-else class="tag">{{ editTarget.time || '未设时间' }}</span>
              <button class="btn btn-ghost btn-icon" @click="closeEdit">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
          </header>

          <div class="dialog-body mat-detail-body">
            <div class="mat-detail-shell">
              <!-- 左侧：视觉预览 -->
              <aside class="mat-detail-preview-panel">
                <div class="mat-detail-section-title">
                  <span>视觉预览</span>
                  <span :class="['mat-detail-state', matHasImage(editTarget) ? 'is-ready' : '']">
                    {{ matHasImage(editTarget) ? '已生成' : '待生成' }}
                  </span>
                </div>

                <button
                  type="button"
                  class="mat-detail-media-frame"
                  :disabled="!matHasImage(editTarget)"
                  @click.stop="openAssetViewer(editTarget)"
                >
                  <img v-if="matHasImage(editTarget)" :src="thumbOf(assetSrc(editTarget))" @error="thumbFallback($event, assetSrc(editTarget))" />
                  <span v-else class="mat-detail-media-empty">
                    <svg v-if="editTarget.kindKey === 'character'" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                    <svg v-else-if="editTarget.kindKey === 'prop'" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
                    <svg v-else width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                  </span>
                </button>

                <div class="mat-detail-meta-row">
                  <div class="mat-detail-meta-item">
                    <span>类型</span>
                    <strong>{{ editTarget.kind === '角色' ? '角色形象' : editTarget.kind === '道具' ? '道具' : '场景图片' }}</strong>
                  </div>
                  <div class="mat-detail-meta-item">
                    <span>{{ editTarget.kindKey === 'character' ? '定位' : editTarget.kindKey === 'prop' ? '道具类型' : '时间' }}</span>
                    <strong>{{ editTarget.kindKey === 'character' ? (editTarget.role || '角色') : editTarget.kindKey === 'prop' ? (editTarget.type || '道具') : (editTarget.time || '未设时间') }}</strong>
                  </div>
                </div>
              </aside>

              <!-- 右侧：编辑信息 -->
              <section class="mat-detail-editor-panel">
                <div class="mat-detail-section-title">
                  <span>编辑信息</span>
                  <span class="dim">{{ editTarget.kindKey === 'character' ? '样貌与妆造会影响角色形象' : editTarget.kindKey === 'prop' ? '物品外貌会影响道具图' : '空间与光影会影响场景图' }}</span>
                </div>

                <!-- 道具：单列物品外貌 -->
                <div v-if="editTarget.kindKey === 'prop'" class="mat-detail-edit-grid mat-detail-edit-grid--prop">
                  <label class="mat-detail-edit-field">
                    <span>名称</span>
                    <input v-model="editDraft.name" class="input" placeholder="道具名称" />
                  </label>
                  <label class="mat-detail-edit-field">
                    <span>类型</span>
                    <input v-model="editDraft.type" class="input" placeholder="如：武器 / 信物" />
                  </label>
                  <label class="mat-detail-edit-field">
                    <span>物品外貌</span>
                    <textarea v-model="editDraft.description" class="textarea mat-detail-textarea" rows="6" placeholder="材质、颜色、形状、大小、新旧程度、磨损痕迹等" />
                  </label>
                </div>

                <!-- 角色：样貌 + 妆造 -->
                <div v-else-if="editTarget.kindKey === 'character'" class="mat-detail-edit-grid mat-detail-edit-grid--character">
                  <label class="mat-detail-edit-field">
                    <span>名称</span>
                    <input v-model="editDraft.name" class="input" placeholder="角色名" />
                  </label>
                  <label class="mat-detail-edit-field">
                    <span>定位</span>
                    <input v-model="editDraft.role" class="input" placeholder="主角 / 反派 / 配角…" />
                  </label>
                  <label class="mat-detail-edit-field">
                    <span>样貌</span>
                    <textarea v-model="editDraft.appearance" class="textarea mat-detail-textarea" rows="5" placeholder="年龄感、五官、体态、气质等" />
                  </label>
                  <label class="mat-detail-edit-field">
                    <span>妆造</span>
                    <textarea v-model="editDraft.styling" class="textarea mat-detail-textarea" rows="5" placeholder="发型、服装、妆面、配饰等" />
                  </label>
                  <label class="mat-detail-edit-field">
                    <span>人物设定</span>
                    <textarea v-model="editDraft.description" class="textarea mat-detail-textarea" rows="4" placeholder="性格、背景、动机…" />
                  </label>
                </div>

                <!-- 场景：描述 + 光影 -->
                <div v-else class="mat-detail-edit-grid mat-detail-edit-grid--scene">
                  <label class="mat-detail-edit-field">
                    <span>地点</span>
                    <input v-model="editDraft.location" class="input" placeholder="如：故宫太和殿" />
                  </label>
                  <label class="mat-detail-edit-field">
                    <span>时间</span>
                    <input v-model="editDraft.time" class="input" placeholder="如：黄昏 / 深夜" />
                  </label>
                  <label class="mat-detail-edit-field">
                    <span>场景描述</span>
                    <textarea v-model="editDraft.prompt" class="textarea mat-detail-textarea" rows="5" placeholder="空间、陈设、年代质感、关键视觉元素等" />
                  </label>
                  <label class="mat-detail-edit-field">
                    <span>场景光影</span>
                    <textarea v-model="editDraft.lighting" class="textarea mat-detail-textarea" rows="5" placeholder="光源、色调、明暗、氛围等" />
                  </label>
                </div>
              </section>
            </div>

            <!-- 最终提示词：可生成 / 重新生成 / 手动编辑 -->
            <section class="mat-detail-prompt-panel">
              <div class="mat-detail-section-title">
                <span>最终提示词</span>
                <span class="dim">由 AI 根据信息生成，可手动修改后保存</span>
                <button
                  class="btn btn-sm mat-detail-prompt-gen"
                  :disabled="finalPromptGen || !firstEpisodeId"
                  :title="firstEpisodeId ? '由 AI 生成最终提示词' : '请先在「剧集列表」创建至少一集'"
                  @click="generateFinalPrompt(editTarget)"
                >
                  <svg v-if="!finalPromptGen" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v3m0 12v3m9-9h-3M6 12H3m13.5-6.5L14 8m-4 8-2.5 2.5m11 0L16 16M8 8 5.5 5.5"/><circle cx="12" cy="12" r="3"/></svg>
                  {{ finalPromptGen ? '生成中…' : (editDraft.finalPrompt ? '重新生成' : '生成提示词') }}
                </button>
              </div>
              <textarea
                v-model="editDraft.finalPrompt"
                class="textarea mat-detail-prompt-text"
                rows="5"
                placeholder="点击「生成提示词」由 AI 根据信息生成，或在此手动填写。手动修改并保存后，下次生成图片将使用此提示词。"
              ></textarea>
            </section>
          </div>

          <footer class="dialog-foot mat-detail-foot">
            <div class="mat-detail-secondary-actions">
              <button class="btn" @click="closeEdit">关闭</button>
            </div>
            <div class="mat-detail-primary-actions">
              <button
                class="btn"
                :disabled="isUploading(editTarget)"
                @click="uploadMaterial(editTarget)"
              >
                <span v-if="isUploading(editTarget)" class="ring-spinner sm"></span>
                <svg v-else width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                上传图片
              </button>
              <button
                class="btn"
                :disabled="isPending(editTarget)"
                @click="generateMaterial(editTarget)"
              >
                {{ matHasImage(editTarget) ? '重新生成' : (isPending(editTarget) ? '生成中…' : '生成图片') }}
              </button>
              <button class="btn btn-primary" :disabled="editSaving" @click="saveEdit">
                {{ editSaving ? '保存中…' : '保存修改' }}
              </button>
            </div>
          </footer>
        </section>
      </div>

      <!-- 图片查看器 -->
      <div v-if="assetViewer.open" class="overlay viewer-overlay" @click.self="closeAssetViewer">
        <div class="dialog viewer-dialog">
          <div class="viewer-head">
            <span class="viewer-title">{{ assetViewer.title }}</span>
            <button class="btn btn-icon btn-sm btn-ghost" @click="closeAssetViewer">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
            </button>
          </div>
          <img :src="assetViewer.src" :alt="assetViewer.title" class="viewer-img" />
        </div>
      </div>
    </div>

    <div v-if="addDialog" class="overlay" @click.self="addDialog = false">
      <div class="dialog ep-dialog">
        <div class="dialog-head">
          <div class="dialog-title">创建新集</div>
          <button class="btn btn-icon btn-sm btn-ghost ml-auto dialog-close" @click="addDialog = false">
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>
        <div class="dialog-body">
          <label class="field">
            <span class="field-label">标题</span>
            <input v-model="newEpisodeTitle" class="input" placeholder="默认按集数自动命名" />
            <span class="field-hint">留空时会自动按集数命名，例如“第 3 集”。</span>
          </label>
          <label class="field">
            <span class="field-label">视频分辨率</span>
            <BaseSelect v-model="newEpisodeResolution" :options="resolutionOptions" placeholder="选择分辨率" />
            <span class="field-hint">创建后本集视频按此分辨率生成，之后仍可在集卡片上修改。</span>
          </label>
        </div>
        <div class="dialog-foot">
          <span class="dialog-foot-copy">创建后自动锁定当前启用的图片与视频生成能力。</span>
          <button class="btn" @click="addDialog = false">取消</button>
          <button class="btn btn-primary" :disabled="creatingEpisode" @click="addEpisode">
            {{ creatingEpisode ? '创建中...' : '创建' }}
          </button>
        </div>
      </div>
    </div>
    <ConfirmDialog
      :open="!!episodeToDelete"
      title="删除本集"
      :message="`确定删除「${episodeToDelete?.title || `第 ${episodeToDelete?.episode_number || episodeToDelete?.episodeNumber} 集`}」？删除后不可在列表中查看，其分镜与生成记录将不再可访问。`"
      :loading="deletingEpisode"
      @confirm="confirmDelEpisode"
      @cancel="episodeToDelete = null"
    />
  </div>
</template>

<script setup>
import { toast } from 'vue-sonner'
import { dramaAPI, episodeAPI, characterAPI, sceneAPI, propAPI, uploadAPI, stylePresetAPI } from '~/composables/useApi'
import BaseSelect from '~/components/BaseSelect.vue'
import { isServerPlanGenerated } from '~/utils/episode-plan-state.mjs'

const route = useRoute()
const drama = ref(null)
const dramaId = Number(route.params.id)
const addDialog = ref(false)
const creatingEpisode = ref(false)
const newEpisodeTitle = ref('')
const episodeToDelete = ref(null)
const deletingEpisode = ref(false)
const stylePresets = ref([])
const projectDraft = reactive({ title: '', content: '', style: '', aspect_ratio: '16:9', resolution: '720p' })
const sourceSaving = ref(false)
const projectStyleAnalyzing = ref(false)
const projectStyleCandidates = ref([])
const projectCustomStyleActive = ref(false)
const projectCustomStyle = reactive({ name: '', prompt: '' })
const confirmProjectNewStyle = ref(false)
const episodeAnalyzing = ref(false)
const episodeCount = ref(1)
const episodePlan = ref(null)
const episodePlanSourceHash = ref('')
const generatedPlanHash = ref('')
const serverPlanHash = ref('')
const episodePlanVersion = ref(0)
const episodePlanRevisionCount = ref(0)
const episodePlanSaving = ref(false)
const episodePlanDirty = ref(false)
const episodePlanConflict = ref(false)
const selectedEpisodeNumber = ref(null)
const episodeReviewSection = ref(null)
const committingEpisodes = ref(false)
const episodePlanStorageKey = `huobao:episode-plan:${dramaId}`
let episodePlanSaveTimer = null
let episodePlanEditSequence = 0
let episodePlanSavePromise = null
let applyingServerPlan = false

const projectAspectRatioOptions = [
  { label: '9:16 · 竖屏', value: '9:16' },
  { label: '16:9 · 横屏', value: '16:9' },
  { label: '1:1 · 方形', value: '1:1' },
]

// 视频分辨率：创建集时固定（持久化到 episodes.resolution），集卡片上可修改
const resolutionOptions = [
  { label: '720p · 高清', value: '720p' },
  { label: '480p · 流畅', value: '480p' },
]
const projectStyleOptions = computed(() => stylePresets.value.map(style => ({ label: style.name, value: style.value })))
const selectedProjectStyle = computed(() => {
  if (projectCustomStyleActive.value) {
    return { source: 'custom', name: projectCustomStyle.name, prompt: projectCustomStyle.prompt, value: '__custom__' }
  }
  const candidate = projectStyleCandidates.value.find(item => item.value === projectDraft.style)
  if (candidate) return candidate
  const preset = stylePresets.value.find(item => item.value === projectDraft.style)
  return preset ? { ...preset, source: 'existing' } : null
})
const projectExistingStyleValue = computed({
  get: () => selectedProjectStyle.value?.source === 'existing' ? projectDraft.style : '',
  set: (value) => {
    if (!value) return
    projectCustomStyleActive.value = false
    confirmProjectNewStyle.value = false
    projectDraft.style = value
  },
})
const canSaveProjectSettings = computed(() => {
  if (!projectDraft.title.trim() || projectDraft.content.trim().length < 20 || !projectDraft.style || !projectDraft.aspect_ratio) return false
  if (selectedProjectStyle.value?.source === 'custom') return !!projectCustomStyle.name.trim() && !!projectCustomStyle.prompt.trim()
  return selectedProjectStyle.value?.source !== 'new' || confirmProjectNewStyle.value
})
const reviewedEpisodeCount = computed(() => episodePlan.value?.episodes?.filter(episode => episode.reviewed).length || 0)
const allEpisodesReviewed = computed(() => !!episodePlan.value?.episodes?.length && reviewedEpisodeCount.value === episodePlan.value.episodes.length)
const reviewProgressPercent = computed(() => episodePlan.value?.episodes?.length
  ? Math.round((reviewedEpisodeCount.value / episodePlan.value.episodes.length) * 100)
  : 0)
const episodePlanStale = computed(() => !!episodePlan.value && episodePlanSourceHash.value !== sourceFingerprint(projectDraft.content))
const planGeneratedByWorkflow = computed(() => !!generatedPlanHash.value)
const planAlreadyGenerated = computed(() => !!episodePlan.value && isServerPlanGenerated({
  dirty: episodePlanDirty.value,
  currentFingerprint: serverPlanHash.value,
  generatedFingerprint: generatedPlanHash.value,
  actualEpisodeCount: drama.value?.episodes?.length,
  plannedEpisodeCount: episodePlan.value.episodes.length,
}))
const activeReviewEpisode = computed(() => episodePlan.value?.episodes?.find(episode => episode.episode_number === selectedEpisodeNumber.value)
  || episodePlan.value?.episodes?.[0]
  || null)
const reviewEpisodeIndex = computed(() => {
  if (!activeReviewEpisode.value || !episodePlan.value?.episodes) return -1
  return episodePlan.value.episodes.findIndex(episode => episode.episode_number === activeReviewEpisode.value.episode_number)
})
const reviewNoteCount = computed(() => episodePlan.value?.episodes?.filter(episode => String(episode.review_note || '').trim()).length || 0)
const hasReviewNotes = computed(() => reviewNoteCount.value > 0)
const newEpisodeResolution = ref('720p')
const epResMenuId = ref(null)

function epResolution(ep) { return ep.resolution === '480p' ? '480p' : '720p' }

async function setEpisodeResolution(ep, resolution) {
  epResMenuId.value = null
  if (epResolution(ep) === resolution) return
  const prev = ep.resolution
  ep.resolution = resolution
  try {
    await episodeAPI.update(ep.id, { resolution })
    toast.success(`本集视频分辨率已切换为 ${resolution}`)
  } catch (e) {
    ep.resolution = prev
    toast.error(e.message)
  }
}

// 集状态由用户手动标记（持久化到 episodes.status），不再按剧本内容自动推算
const epStatusOptions = [
  { label: '待开始', value: 'draft' },
  { label: '进行中', value: 'active' },
  { label: '已完成', value: 'completed' },
]
const epStatusMenuId = ref(null)

function epStatus(ep) { return ep.status || 'draft' }
function epStatusLabel(ep) { return epStatusOptions.find(s => s.value === epStatus(ep))?.label || '待开始' }
function epStatusDotClass(ep) { return epStatus(ep) === 'active' ? 'dot-active' : epStatus(ep) === 'completed' ? 'dot-done' : 'dot-pending' }

function formatEpTime(ts) {
  if (!ts) return ''
  const d = new Date(ts)
  const now = new Date()
  const diff = now - d
  if (diff < 60_000) return '刚刚'
  if (diff < 3600_000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 86400_000) return `${Math.floor(diff / 3600000)} 小时前`
  return `${d.getMonth() + 1}/${d.getDate()}`
}

async function setEpisodeStatus(ep, status) {
  epStatusMenuId.value = null
  if (epStatus(ep) === status) return
  const prev = ep.status
  ep.status = status
  try {
    await episodeAPI.update(ep.id, { status })
  } catch (e) {
    ep.status = prev
    toast.error(e.message)
  }
}

function parseDramaMetadata(raw) {
  if (!raw) return {}
  if (typeof raw === 'object') return raw
  try { return JSON.parse(raw) } catch { return {} }
}

function styleLabel(value) {
  return stylePresets.value.find(style => style.value === value)?.name || value || ''
}

function selectProjectStyle(item) {
  projectCustomStyleActive.value = false
  confirmProjectNewStyle.value = false
  projectDraft.style = item.value
}

function toggleProjectCustomStyle() {
  projectCustomStyleActive.value = !projectCustomStyleActive.value
  confirmProjectNewStyle.value = false
  if (projectCustomStyleActive.value) projectDraft.style = '__custom__'
  else projectDraft.style = projectStyleCandidates.value[0]?.value || stylePresets.value[0]?.value || ''
}

async function analyzeProjectStyles() {
  if (projectStyleAnalyzing.value || projectDraft.content.trim().length < 20) return
  try {
    projectStyleAnalyzing.value = true
    const result = await dramaAPI.analyzeSource(projectDraft.content.trim())
    projectStyleCandidates.value = result.style_candidates || []
    if (projectStyleCandidates.value[0]) selectProjectStyle(projectStyleCandidates.value[0])
    toast.success('已根据全文匹配 3 个视觉风格')
  } catch (e) {
    toast.error(e.message)
  } finally {
    projectStyleAnalyzing.value = false
  }
}

async function persistProjectSettings(showSuccess = true) {
  if (!canSaveProjectSettings.value) throw new Error('请完整填写标题、全文和视觉风格')
  const selected = selectedProjectStyle.value
  if (selected?.source === 'new' && !confirmProjectNewStyle.value) throw new Error('请先确认是否创建新的视觉风格')

  let styleValue = projectDraft.style
  if (selected?.source === 'new' || selected?.source === 'custom') {
    const created = await stylePresetAPI.create({
      name: selected.name,
      value: selected.source === 'custom' ? `custom-${Date.now().toString(36)}` : selected.value,
      prompt: selected.prompt,
      description: selected.description || selected.reason || selected.prompt,
      sort_order: stylePresets.value.length + 1,
    })
    stylePresets.value.push(created)
    styleValue = created.value
    projectDraft.style = created.value
    projectCustomStyleActive.value = false
    if (selected.source === 'new') selected.source = 'existing'
    confirmProjectNewStyle.value = false
  }

  const metadata = {
    ...parseDramaMetadata(drama.value?.metadata),
    default_resolution: projectDraft.resolution,
  }
  await dramaAPI.update(dramaId, {
    title: projectDraft.title.trim(),
    description: projectDraft.content.trim(),
    style: styleValue,
    aspect_ratio: projectDraft.aspect_ratio,
    metadata: JSON.stringify(metadata),
  })
  Object.assign(drama.value, {
    title: projectDraft.title.trim(),
    description: projectDraft.content.trim(),
    style: styleValue,
    aspect_ratio: projectDraft.aspect_ratio,
    metadata: JSON.stringify(metadata),
  })
  if (showSuccess) toast.success('全文与项目设置已保存')
}

async function saveProjectSettings() {
  if (sourceSaving.value) return
  try {
    sourceSaving.value = true
    await persistProjectSettings(true)
  } catch (e) {
    toast.error(e.message)
  } finally {
    sourceSaving.value = false
  }
}

function sourceFingerprint(value) {
  const text = String(value || '').trim()
  let hash = 2166136261
  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return `${text.length}:${(hash >>> 0).toString(16)}`
}

function persistEpisodePlanLocalBackup() {
  if (!import.meta.client || !episodePlan.value) return
  try {
    localStorage.setItem(episodePlanStorageKey, JSON.stringify({
      version: 2,
      updated_at: new Date().toISOString(),
      source_hash: episodePlanSourceHash.value,
      episode_count: episodeCount.value,
      selected_episode_number: selectedEpisodeNumber.value,
      plan: episodePlan.value,
    }))
  } catch (error) {
    console.warn('[episode-plan] 无法保存本地审阅草稿', error)
  }
}

function applyServerEpisodePlan(saved) {
  if (!saved?.plan?.episodes?.length) return
  applyingServerPlan = true
  episodePlan.value = {
    ...saved.plan,
    episodes: saved.plan.episodes.map(episode => ({
      ...episode,
      reviewed: episode.reviewed === true,
      review_note: String(episode.review_note || ''),
    })),
  }
  episodeCount.value = saved.plan.recommended_count
  episodePlanSourceHash.value = sourceFingerprint(projectDraft.content)
  generatedPlanHash.value = String(saved.generated_fingerprint || '')
  serverPlanHash.value = String(saved.current_content_fingerprint || '')
  episodePlanVersion.value = Number(saved.version || 0)
  episodePlanRevisionCount.value = Number(saved.revision_count || 0)
  projectDraft.resolution = saved.resolution === '480p' ? '480p' : '720p'
  const restoredNumber = Number(saved.selected_episode_number)
  selectedEpisodeNumber.value = episodePlan.value.episodes.some(episode => episode.episode_number === restoredNumber)
    ? restoredNumber
    : episodePlan.value.episodes[0].episode_number
  episodePlanDirty.value = false
  episodePlanConflict.value = false
  persistEpisodePlanLocalBackup()
  nextTick(() => { applyingServerPlan = false })
}

async function saveEpisodePlanDraftNow() {
  if (!episodePlan.value || episodePlanConflict.value) return null
  if (episodePlanSavePromise) {
    await episodePlanSavePromise
    if (!episodePlanDirty.value || episodePlanConflict.value) return null
  }
  if (episodePlanSaveTimer) {
    clearTimeout(episodePlanSaveTimer)
    episodePlanSaveTimer = null
  }
  const capturedSequence = episodePlanEditSequence
  episodePlanSavePromise = (async () => {
    try {
    episodePlanSaving.value = true
    const saved = await dramaAPI.saveEpisodePlan(dramaId, {
      source_content: projectDraft.content.trim(),
      plan: episodePlan.value,
      resolution: projectDraft.resolution,
      selected_episode_number: selectedEpisodeNumber.value,
      expected_version: episodePlanVersion.value,
    })
    if (capturedSequence === episodePlanEditSequence) {
      applyServerEpisodePlan(saved)
    } else {
      episodePlanVersion.value = Number(saved.version || episodePlanVersion.value)
      generatedPlanHash.value = String(saved.generated_fingerprint || '')
      serverPlanHash.value = String(saved.current_content_fingerprint || '')
      episodePlanRevisionCount.value = Number(saved.revision_count || 0)
      episodePlanDirty.value = true
    }
    return saved
    } catch (error) {
    if (error.status === 409 || String(error.message).includes('VERSION_CONFLICT')) episodePlanConflict.value = true
    throw error
    } finally {
    episodePlanSaving.value = false
    }
  })()
  try {
    const saved = await episodePlanSavePromise
    if (capturedSequence !== episodePlanEditSequence && episodePlanDirty.value && !episodePlanConflict.value) {
      episodePlanSavePromise = null
      return saveEpisodePlanDraftNow()
    }
    return saved
  } finally {
    episodePlanSavePromise = null
  }
}

function scheduleEpisodePlanSave(markContentDirty = true) {
  if (!episodePlan.value) return
  episodePlanEditSequence += 1
  if (markContentDirty) episodePlanDirty.value = true
  persistEpisodePlanLocalBackup()
  if (episodePlanConflict.value) return
  if (episodePlanSaveTimer) clearTimeout(episodePlanSaveTimer)
  episodePlanSaveTimer = setTimeout(() => {
    saveEpisodePlanDraftNow().catch(error => {
      if (!episodePlanConflict.value) toast.error(`分集草稿自动保存失败：${error.message}`)
    })
  }, 650)
}

function restoreEpisodePlanLocalBackup() {
  if (!import.meta.client || episodePlan.value) return
  try {
    const saved = JSON.parse(localStorage.getItem(episodePlanStorageKey) || 'null')
    if (!saved?.plan?.episodes?.length) return
    episodePlan.value = {
      ...saved.plan,
      episodes: saved.plan.episodes.map(episode => ({
        ...episode,
        reviewed: episode.reviewed === true,
        review_note: String(episode.review_note || ''),
      })),
    }
    episodeCount.value = Math.max(1, Math.min(30, Number(saved.episode_count || saved.plan.recommended_count) || 1))
    episodePlanSourceHash.value = String(saved.source_hash || '')
    // 旧浏览器缓存不能声明“已生成”，生成状态只接受服务器记录。
    generatedPlanHash.value = ''
    serverPlanHash.value = ''
    episodePlanVersion.value = 0
    episodePlanDirty.value = true
    const restoredNumber = Number(saved.selected_episode_number)
    selectedEpisodeNumber.value = episodePlan.value.episodes.some(episode => episode.episode_number === restoredNumber)
      ? restoredNumber
      : episodePlan.value.episodes[0].episode_number
  } catch (error) {
    console.warn('[episode-plan] 无法恢复本地审阅草稿', error)
  }
}

async function reloadServerEpisodePlan() {
  const saved = await dramaAPI.getEpisodePlan(dramaId)
  if (saved) applyServerEpisodePlan(saved)
  else {
    episodePlanConflict.value = false
    restoreEpisodePlanLocalBackup()
    if (episodePlan.value) await saveEpisodePlanDraftNow()
  }
}

function selectEpisodeReview(episode, scrollToDetail = true) {
  selectedEpisodeNumber.value = episode.episode_number
  scheduleEpisodePlanSave(false)
  if (scrollToDetail) {
    nextTick(() => episodeReviewSection.value?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
  }
}

function moveEpisodeReview(offset) {
  const target = episodePlan.value?.episodes?.[reviewEpisodeIndex.value + offset]
  if (target) selectEpisodeReview(target, false)
}

function setEpisodeReviewed(episode, reviewed) {
  episode.reviewed = reviewed
  scheduleEpisodePlanSave(false)
}

function invalidateEpisodeReview(episode) {
  if (episode.reviewed) episode.reviewed = false
  scheduleEpisodePlanSave(true)
}

function onEpisodeContentInput(episode) {
  episode.character_count = String(episode.content || '').trim().length
  invalidateEpisodeReview(episode)
}

function confirmEpisodeAndContinue() {
  if (!activeReviewEpisode.value || episodePlanStale.value) return
  const currentIndex = reviewEpisodeIndex.value
  setEpisodeReviewed(activeReviewEpisode.value, true)
  const next = episodePlan.value?.episodes?.[currentIndex + 1]
  if (next) selectEpisodeReview(next, false)
  else {
    toast.success('所有分集均已审阅确认，可以生成到剧集列表')
  }
}

function confirmAllEpisodes() {
  if (!episodePlan.value?.episodes?.length || episodePlanStale.value) return
  episodePlan.value.episodes.forEach(episode => { episode.reviewed = true })
  scheduleEpisodePlanSave(false)
  toast.success(`已一键确认 ${episodePlan.value.episodes.length} 集`)
}

async function analyzeEpisodePlan(useAdjustedCount = false) {
  if (episodeAnalyzing.value || projectDraft.content.trim().length < 20) return
  try {
    episodeAnalyzing.value = true
    await persistProjectSettings(false)
    const result = await dramaAPI.analyzeEpisodes(dramaId, {
      content: projectDraft.content.trim(),
      episode_count: useAdjustedCount ? Math.max(1, Math.min(30, Number(episodeCount.value) || 1)) : undefined,
      resolution: projectDraft.resolution,
      expected_version: episodePlanVersion.value,
    })
    applyServerEpisodePlan(result)
    toast.success(`已生成 ${result.plan.recommended_count} 集拆分草稿`)
  } catch (e) {
    if (e.status === 409) episodePlanConflict.value = true
    toast.error(e.message)
  } finally {
    episodeAnalyzing.value = false
  }
}

async function reanalyzeFromReviewNotes() {
  if (episodeAnalyzing.value || !hasReviewNotes.value || episodePlanStale.value) return
  const reviewNotes = episodePlan.value.episodes
    .filter(episode => String(episode.review_note || '').trim())
    .map(episode => ({
      episode_number: episode.episode_number,
      title: episode.title,
      summary: episode.summary,
      note: String(episode.review_note).trim(),
    }))
  try {
    episodeAnalyzing.value = true
    await persistProjectSettings(false)
    const result = await dramaAPI.analyzeEpisodes(dramaId, {
      content: projectDraft.content.trim(),
      resolution: projectDraft.resolution,
      expected_version: episodePlanVersion.value,
      review_notes: reviewNotes,
    })
    applyServerEpisodePlan(result)
    toast.success(`已综合 ${reviewNotes.length} 条批注，重新拆分为 ${result.plan.recommended_count} 集；上一版已归档`)
  } catch (e) {
    if (e.status === 409) episodePlanConflict.value = true
    toast.error(e.message)
  } finally {
    episodeAnalyzing.value = false
  }
}

async function commitEpisodePlan() {
  if (!episodePlan.value?.episodes?.length || committingEpisodes.value || planAlreadyGenerated.value) return
  if (drama.value?.episodes?.length && !planGeneratedByWorkflow.value) {
    toast.error('现有剧集不是由全文分集流程创建，不能自动覆盖')
    return
  }
  if (episodePlanStale.value) {
    toast.error('全文已变化，请重新生成分集建议后再提交')
    return
  }
  if (!allEpisodesReviewed.value) {
    toast.error('请先逐集审阅确认，或使用一键审阅确认')
    return
  }
  try {
    committingEpisodes.value = true
    await persistProjectSettings(false)
    const savedDraft = episodePlanDirty.value ? await saveEpisodePlanDraftNow() : null
    const result = await dramaAPI.createEpisodesFromPlan(dramaId, {
      expected_version: savedDraft?.version || episodePlanVersion.value,
    })
    applyServerEpisodePlan(result.plan_draft)
    toast.success(drama.value?.episodes?.length ? '修改内容已同步到剧集列表' : `已生成 ${episodePlan.value.episodes.length} 集到剧集列表`)
    await load()
  } catch (e) {
    toast.error(e.message)
  } finally {
    committingEpisodes.value = false
  }
}

async function load() {
  try {
    const [result, presets] = await Promise.all([dramaAPI.get(dramaId), stylePresetAPI.list()])
    drama.value = result
    stylePresets.value = presets || []
    const metadata = parseDramaMetadata(result.metadata)
    Object.assign(projectDraft, {
      title: result.title || '',
      content: result.description || '',
      style: result.style || stylePresets.value[0]?.value || '',
      aspect_ratio: result.aspect_ratio || result.aspectRatio || '16:9',
      resolution: metadata.default_resolution === '480p' ? '480p' : '720p',
    })
    await reloadServerEpisodePlan()
  } catch (e) {
    toast.error(e.message)
  }
}

function openAddEpisode() {
  newEpisodeTitle.value = ''
  newEpisodeResolution.value = '720p'
  addDialog.value = true
}

async function addEpisode() {
  try {
    creatingEpisode.value = true
    // 图片/视频生成配置由后端自动锁定为当前启用的最高优先级配置；分辨率随集固定
    await episodeAPI.create({
      drama_id: dramaId,
      title: newEpisodeTitle.value || undefined,
      resolution: newEpisodeResolution.value,
    })
    toast.success('已添加新集')
    addDialog.value = false
    load()
  } catch (e) {
    toast.error(e.message)
  } finally {
    creatingEpisode.value = false
  }
}

async function confirmDelEpisode() {
  const ep = episodeToDelete.value
  if (!ep) return
  try {
    deletingEpisode.value = true
    await episodeAPI.del(ep.id)
    toast.success('已删除')
    episodeToDelete.value = null
    load()
  } catch (e) {
    toast.error(e.message)
  } finally {
    deletingEpisode.value = false
  }
}

/* ===== 素材库 Tab ===== */
const activeTab = ref('source')
const assetTab = ref('all')
const assetViewer = ref({ open: false, src: '', title: '' })
const pendingMaterials = ref(new Set())
const assetTabs = [
  { label: '全部', value: 'all' },
  { label: '角色', value: 'character' },
  { label: '场景', value: 'scene' },
  { label: '道具', value: 'prop' },
]
const KIND_ORDER = { character: 0, scene: 1, prop: 2 }

// 素材库以 characters / scenes / props 三张资产表为源（后端生图会写回其 imageUrl）
function matImage(m) { return m.image_url || m.imageUrl || m.localPath || m.local_path || '' }
function matHasImage(m) { return !!matImage(m) }
function assetSrc(m) {
  const raw = matImage(m)
  if (!raw) return ''
  return /^https?:\/\//i.test(raw) || raw.startsWith('/') ? raw : `/${raw}`
}
function matCreatedAt(m) { return m.created_at || m.updated_at || m.createdAt || m.updatedAt }
function matDesc(m) {
  if (m.kindKey === 'character') return m.appearance || m.description || ''
  if (m.kindKey === 'scene') return m.prompt || m.description || ''
  return m.description || ''
}
function tagClass(kindKey) {
  return kindKey === 'character' ? 'is-character' : kindKey === 'scene' ? 'is-scene' : 'is-prop'
}
function tabLabel(v) { return assetTabs.find(t => t.value === v)?.label || '' }

const materials = computed(() => {
  const d = drama.value
  if (!d) return []
  const list = []
  for (const c of d.characters || []) list.push({ ...c, kind: '角色', kindKey: 'character' })
  for (const s of d.scenes || []) list.push({ ...s, kind: '场景', kindKey: 'scene' })
  for (const p of d.props || []) list.push({ ...p, kind: '道具', kindKey: 'prop' })
  return list.sort((a, b) => (KIND_ORDER[a.kindKey] - KIND_ORDER[b.kindKey]) || (a.id - b.id))
})
const visibleAssets = computed(() =>
  assetTab.value === 'all' ? materials.value : materials.value.filter(m => m.kindKey === assetTab.value),
)
const assetTotal = computed(() => materials.value.length)
// 按类型分组：全部模式下分成 角色 / 场景 / 道具 三个分区；筛选单类时只保留该类
const assetGroups = computed(() => {
  const groups = [
    { kindKey: 'character', label: '角色', items: materials.value.filter(m => m.kindKey === 'character') },
    { kindKey: 'scene', label: '场景', items: materials.value.filter(m => m.kindKey === 'scene') },
    { kindKey: 'prop', label: '道具', items: materials.value.filter(m => m.kindKey === 'prop') },
  ]
  return assetTab.value === 'all'
    ? groups
    : groups.filter(g => g.kindKey === assetTab.value)
})

function pendingKey(m) { return `${m.kindKey}:${m.id}` }
function isPending(m) { return pendingMaterials.value.has(pendingKey(m)) }

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

async function generateMaterial(m) {
  const epId = drama.value?.episodes?.[0]?.id
  if (!epId) { toast.error('请先在「剧集列表」创建至少一集，才能生成素材图'); return }
  const key = pendingKey(m)
  if (pendingMaterials.value.has(key)) return
  pendingMaterials.value = new Set(pendingMaterials.value).add(key)
  try {
    if (m.kindKey === 'character') await characterAPI.generateImage(m.id, epId)
    else if (m.kindKey === 'scene') await sceneAPI.generateImage(m.id, epId)
    else await propAPI.generateImage(m.id, epId)
    toast.success(`${m.kind}「${m.name}」图片生成中`)
    pollMaterial(m)
  } catch (e) {
    pendingMaterials.value = new Set([...pendingMaterials.value].filter(k => k !== key))
    toast.error(e.message)
  }
}

// 生图为异步任务：轮询重新加载 drama，直到该素材 imageUrl 出现
async function pollMaterial(m) {
  const key = pendingKey(m)
  for (let i = 0; i < 40; i++) {
    await sleep(2500)
    await load()
    const d = drama.value
    const list = m.kindKey === 'character' ? d?.characters : m.kindKey === 'scene' ? d?.scenes : d?.props
    const rec = list?.find(x => x.id === m.id)
    if (rec && matImage(rec)) {
      pendingMaterials.value = new Set([...pendingMaterials.value].filter(k => k !== key))
      return
    }
  }
  pendingMaterials.value = new Set([...pendingMaterials.value].filter(k => k !== key))
  toast.info(`${m.kind}「${m.name}」生成超时，可稍后刷新查看`)
}

function switchToAssets() {
  activeTab.value = 'assets'
}

/* ===== 素材图片手动上传（角色形象 / 场景图 / 道具图） ===== */
const uploadingMaterials = ref(new Set())
function isUploading(m) { return uploadingMaterials.value.has(pendingKey(m)) }

function uploadMaterial(m) {
  const key = pendingKey(m)
  if (uploadingMaterials.value.has(key)) return
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = 'image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp'
  input.onchange = async () => {
    const file = input.files?.[0]
    if (!file) return
    uploadingMaterials.value = new Set(uploadingMaterials.value).add(key)
    try {
      const res = await uploadAPI.image(file)
      // 与生图回写保持一致：存相对路径（static/...），展示时补前导斜杠
      const payload = { image_url: res.path, local_path: res.path }
      if (m.kindKey === 'character') await characterAPI.update(m.id, payload)
      else if (m.kindKey === 'scene') await sceneAPI.update(m.id, payload)
      else await propAPI.update(m.id, payload)
      toast.success(`${m.kind}「${m.name}」图片已上传`)
      await load()
      // 详情弹窗打开时同步刷新预览
      if (editTarget.value && editTarget.value.kindKey === m.kindKey && editTarget.value.id === m.id) {
        editTarget.value = { ...editTarget.value, image_url: res.path, local_path: res.path }
      }
    } catch (e) {
      toast.error(e.message)
    } finally {
      uploadingMaterials.value = new Set([...uploadingMaterials.value].filter(k => k !== key))
    }
  }
  input.click()
}

function openAssetViewer(m) {
  assetViewer.value = { open: true, src: assetSrc(m), title: `${m.kind} · ${m.name}` }
}
function closeAssetViewer() {
  assetViewer.value = { open: false, src: '', title: '' }
}

function fmtDate(s) {
  if (!s) return ''
  const d = new Date(s)
  if (isNaN(d.getTime())) return ''
  return d.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })
}

/* ===== 素材信息编辑 ===== */
const editDialog = ref(false)
const editSaving = ref(false)
const editTarget = ref(null)
const editDraft = reactive({})

function openEdit(m) {
  editTarget.value = m
  // 按类型初始化 draft
  Object.keys(editDraft).forEach(k => delete editDraft[k])
  if (m.kindKey === 'character') {
    Object.assign(editDraft, { name: m.name || '', role: m.role || '', appearance: m.appearance || '', description: m.description || '', styling: m.styling || '' })
  } else if (m.kindKey === 'scene') {
    Object.assign(editDraft, { location: m.location || '', time: m.time || '', prompt: m.prompt || '', lighting: m.lighting || '' })
  } else {
    Object.assign(editDraft, { name: m.name || '', type: m.type || '', description: m.description || '' })
  }
  editDraft.finalPrompt = m.finalPrompt || m.final_prompt || ''
  editDialog.value = true
}

// 生成/重新生成最终提示词（不生图）：调用各类型 generate-prompt 接口，结果写回 draft
const finalPromptGen = ref(false)
const firstEpisodeId = computed(() => drama.value?.episodes?.[0]?.id || null)
async function generateFinalPrompt(m) {
  const epId = firstEpisodeId.value
  if (!epId) { toast.error('请先在「剧集列表」创建至少一集，才能生成最终提示词'); return }
  finalPromptGen.value = true
  try {
    let res
    if (m.kindKey === 'character') res = await characterAPI.generatePrompt(m.id, epId, true)
    else if (m.kindKey === 'scene') res = await sceneAPI.generatePrompt(m.id, epId, true)
    else res = await propAPI.generatePrompt(m.id, epId, true)
    const fp = res?.final_prompt || res?.finalPrompt
    if (!fp) throw new Error('最终提示词生成失败，请重试')
    editTarget.value = { ...m, finalPrompt: fp }
    editDraft.finalPrompt = fp
    toast.success('最终提示词已生成')
  } catch (e) {
    toast.error(e.message)
  } finally {
    finalPromptGen.value = false
  }
}

function closeEdit() {
  editDialog.value = false
  editTarget.value = null
}

async function saveEdit() {
  const t = editTarget.value
  if (!t) return
  // 必填校验
  if (t.kindKey === 'character' && !String(editDraft.name ?? '').trim()) { toast.error('请填写名称'); return }
  if (t.kindKey === 'scene' && !String(editDraft.location ?? '').trim()) { toast.error('请填写地点'); return }
  if (t.kindKey === 'prop' && !String(editDraft.name ?? '').trim()) { toast.error('请填写名称'); return }
  editSaving.value = true
  try {
    const fp = editDraft.finalPrompt || null
    if (t.kindKey === 'character') await characterAPI.update(t.id, { name: editDraft.name, role: editDraft.role, appearance: editDraft.appearance, description: editDraft.description, styling: editDraft.styling, finalPrompt: fp })
    else if (t.kindKey === 'scene') await sceneAPI.update(t.id, { location: editDraft.location, time: editDraft.time, prompt: editDraft.prompt, lighting: editDraft.lighting, finalPrompt: fp })
    else await propAPI.update(t.id, { name: editDraft.name, type: editDraft.type, description: editDraft.description, finalPrompt: fp })
    toast.success('已保存')
    closeEdit()
    load()
  } catch (e) {
    toast.error(e.message)
  } finally {
    editSaving.value = false
  }
}

watch(episodeCount, persistEpisodePlanLocalBackup)
watch(() => projectDraft.resolution, (next, previous) => {
  if (episodePlan.value && next !== previous && !applyingServerPlan) scheduleEpisodePlanSave(true)
})

onMounted(load)
onBeforeUnmount(() => {
  if (episodePlanSaveTimer) clearTimeout(episodePlanSaveTimer)
})
</script>

<style scoped>
.page {
  padding: 28px 48px 40px;
  overflow-y: auto;
  height: 100%;
  animation: fadeUp 0.35s var(--ease-out) both;
}

/* Header card */
.page-head {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 20px 24px;
  border-radius: var(--radius-xl);
  margin-bottom: 24px;
}
.head-info { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 6px; }
.head-title-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.head-action { flex-shrink: 0; }

.back-btn {
  width: 36px; height: 36px; flex-shrink: 0;
  display: flex; align-items: center; justify-content: center;
  border: none; border-radius: 50%;
  background: rgba(0,0,0,0.05); color: var(--text-1);
  cursor: pointer;
  transition: background 0.16s var(--ease-out), color 0.16s var(--ease-out), box-shadow 0.16s var(--ease-out);
}
.back-btn:hover { background: rgba(0,0,0,0.09); color: var(--text-0); }
.back-btn:focus-visible {
  outline: none;
  box-shadow: 0 0 0 3.5px var(--button-focus);
}

.page-title {
  font-size: 22px; font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1.2;
}

.page-meta { display: flex; align-items: center; gap: 16px; flex-wrap: wrap; }
.meta-item {
  display: flex; align-items: center; gap: 5px;
  font-size: 12.5px; color: var(--text-2);
}

/* 主 Tab 导航 */
.page-tabs {
  display: flex;
  align-items: center;
  gap: 4px;
  border-bottom: 1px solid var(--border);
  margin-bottom: 20px;
}
.tab-btn {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  border: none;
  background: transparent;
  padding: 10px 4px 12px;
  margin-right: 20px;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-2);
  cursor: pointer;
  transition: color 0.16s var(--ease-out);
}
.tab-btn svg { opacity: 0.75; }
.tab-btn::after {
  content: '';
  position: absolute;
  left: 0; right: 0; bottom: -1px;
  height: 2px;
  border-radius: 2px;
  background: transparent;
  transition: background 0.16s var(--ease-out);
}
.tab-btn:hover { color: var(--text-0); }
.tab-btn.on { color: var(--text-0); font-weight: 700; }
.tab-btn.on::after { background: var(--accent); }
.tab-count {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 18px;
  height: 18px;
  padding: 0 5px;
  border-radius: 9px;
  font-size: 11px;
  font-weight: 700;
  font-family: var(--font-mono);
  background: var(--bg-2);
  color: var(--text-2);
}
.tab-btn.on .tab-count { background: var(--accent-bg); color: var(--accent-text); }

/* 全文内容工作区 */
.source-workspace { display: flex; flex-direction: column; gap: 18px; }
.source-editor-layout {
  display: grid;
  grid-template-columns: minmax(0, 1.65fr) minmax(320px, 0.75fr);
  gap: 18px;
  align-items: start;
}
.source-manuscript-card, .project-settings-card, .episode-planner-card { padding: 20px; }
.project-settings-card { position: sticky; top: 14px; }
.source-card-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 14px; }
.source-card-head.compact { margin-bottom: 16px; }
.source-card-head h2, .episode-planner-head h2 { margin: 2px 0 4px; color: var(--text-0); font-size: 17px; letter-spacing: -0.02em; }
.source-card-head p, .episode-planner-head p { margin: 0; color: var(--text-3); font-size: 11.5px; line-height: 1.55; }
.source-eyebrow { color: var(--accent); font-family: var(--font-mono); font-size: 9px; font-weight: 800; letter-spacing: 0.14em; }
.source-char-count { flex-shrink: 0; padding: 5px 9px; border-radius: var(--radius-pill); background: var(--bg-2); color: var(--text-2); font-size: 10.5px; font-family: var(--font-mono); }
.source-manuscript {
  width: 100%;
  min-height: 540px;
  resize: vertical;
  padding: 17px 18px;
  line-height: 1.8;
  font-size: 13px;
  color: var(--text-1);
  background: #fbfbfd;
}
.project-setting-fields { display: flex; flex-direction: column; gap: 13px; }
.project-style-panel { display: flex; flex-direction: column; gap: 10px; margin-top: 17px; padding-top: 16px; border-top: 1px solid var(--border); }
.project-style-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.project-style-head > div { display: flex; flex-direction: column; gap: 2px; }
.project-style-head small { color: var(--text-3); font-size: 9.5px; }
.project-style-candidates { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
.project-style-choice {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 9px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--surface-raised);
  text-align: left;
  cursor: pointer;
}
.project-style-choice:hover { border-color: var(--border-strong); }
.project-style-choice.on { border-color: var(--accent); background: var(--accent-bg); box-shadow: inset 0 0 0 1px var(--accent); }
.project-style-choice > span { color: var(--accent); font-size: 8.5px; font-weight: 700; }
.project-style-choice strong { overflow: hidden; color: var(--text-0); font-size: 10.5px; text-overflow: ellipsis; white-space: nowrap; }
.project-style-choice small { overflow: hidden; color: var(--text-3); font-size: 9px; line-height: 1.35; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.project-style-select-row { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 7px; }
.project-style-select-row .btn.on { color: var(--accent); border-color: var(--accent); background: var(--accent-bg); }
.project-custom-style { display: flex; flex-direction: column; gap: 7px; padding: 10px; border: 1px solid var(--accent); border-radius: 8px; background: var(--accent-bg); }
.project-new-style-confirm { display: flex; align-items: flex-start; gap: 7px; color: var(--text-1); font-size: 10.5px; line-height: 1.45; }
.project-new-style-confirm input { margin-top: 2px; accent-color: var(--accent); }
.project-save-btn { width: 100%; margin-top: 16px; }
.episode-planner-head { display: flex; align-items: flex-start; justify-content: space-between; gap: 20px; }
.episode-plan-result { display: flex; flex-direction: column; gap: 16px; margin-top: 18px; padding-top: 18px; border-top: 1px solid var(--border); }
.episode-count-control { display: grid; grid-template-columns: minmax(0, 1fr) 100px auto; align-items: end; gap: 12px; }
.recommended-count { display: grid; grid-template-columns: auto auto minmax(0, 1fr); align-items: center; gap: 9px; }
.recommended-count > span { color: var(--text-2); font-size: 11px; }
.recommended-count strong { color: var(--accent); font-size: 26px; line-height: 1; }
.recommended-count p { margin: 0; color: var(--text-3); font-size: 10.5px; line-height: 1.45; }
.episode-count-control > label { display: flex; flex-direction: column; gap: 5px; }
.episode-count-control > label span { color: var(--text-2); font-size: 10px; font-weight: 650; }
.episode-plan-stale { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border: 1px solid color-mix(in srgb, var(--warning) 35%, var(--border)); border-radius: 9px; background: color-mix(in srgb, var(--warning) 8%, white); }
.episode-plan-stale strong { flex-shrink: 0; color: var(--warning); font-size: 10.5px; }
.episode-plan-stale span { color: var(--text-2); font-size: 10.5px; line-height: 1.45; }
.episode-plan-conflict { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 12px 14px; border: 1px solid color-mix(in srgb, var(--danger) 38%, var(--border)); border-radius: 10px; background: color-mix(in srgb, var(--danger) 7%, white); }
.episode-plan-conflict div { display: flex; flex-direction: column; gap: 3px; }
.episode-plan-conflict strong { color: var(--danger); font-size: 11px; }
.episode-plan-conflict span { color: var(--text-2); font-size: 10.5px; line-height: 1.5; }
.episode-review-toolbar { display: grid; grid-template-columns: auto minmax(120px, 1fr) auto; align-items: center; gap: 12px; padding: 11px 12px; border: 1px solid var(--border); border-radius: 10px; background: var(--bg-1); }
.review-progress-copy { display: flex; flex-direction: column; gap: 2px; }
.review-progress-copy span { color: var(--text-3); font-size: 9px; letter-spacing: 0.06em; text-transform: uppercase; }
.review-progress-copy strong { color: var(--text-1); font-size: 11px; }
.review-progress-copy small { color: var(--text-3); font-size: 9.5px; }
.review-progress-track { height: 5px; overflow: hidden; border-radius: 999px; background: var(--bg-3); }
.review-progress-track i { display: block; height: 100%; border-radius: inherit; background: var(--success); transition: width 0.28s var(--ease-out); }
.episode-draft-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(238px, 1fr)); gap: 10px; }
.episode-draft-card { min-width: 0; display: flex; flex-direction: column; gap: 7px; padding: 13px; border: 1px solid var(--border); border-radius: var(--radius); background: #fbfbfd; cursor: pointer; transition: border-color 0.18s, box-shadow 0.18s, transform 0.18s; }
.episode-draft-card:hover, .episode-draft-card:focus-visible { border-color: var(--border-strong); box-shadow: var(--shadow-lift); transform: translateY(-1px); outline: none; }
.episode-draft-card.reviewed { border-color: color-mix(in srgb, var(--success) 40%, var(--border)); background: color-mix(in srgb, var(--success) 4%, white); }
.episode-draft-topline, .episode-draft-footline { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.episode-draft-number { color: var(--accent); font-family: var(--font-mono); font-size: 9px; font-weight: 800; letter-spacing: 0.1em; }
.episode-review-state { display: inline-flex; align-items: center; gap: 5px; padding: 3px 7px; border-radius: 999px; background: var(--bg-2); color: var(--text-3); font-size: 8.5px; font-weight: 750; }
.episode-review-state::before { width: 5px; height: 5px; border-radius: 50%; background: currentColor; content: ''; }
.episode-review-state.reviewed { background: var(--success-bg); color: var(--success); }
.episode-review-state.large { padding: 5px 9px; font-size: 9.5px; }
.episode-draft-title, .episode-draft-summary { width: 100%; border: none; background: transparent; color: var(--text-0); outline: none; }
.episode-draft-title { font-size: 13px; font-weight: 750; }
.episode-draft-summary { resize: vertical; color: var(--text-2); font-size: 10.5px; line-height: 1.45; }
.episode-draft-card > p { min-height: 54px; margin: 0; overflow: hidden; color: var(--text-3); font-size: 10px; line-height: 1.55; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; }
.episode-draft-footline > span { color: var(--text-3); font-size: 9px; }
.episode-review-open { padding: 0; border: none; background: none; color: var(--accent); font-size: 9.5px; font-weight: 700; cursor: pointer; }
.episode-review-open:hover { text-decoration: underline; }
.episode-plan-foot { display: flex; align-items: center; justify-content: flex-end; gap: 16px; padding-top: 14px; border-top: 1px solid var(--border); }
.episode-plan-foot > span { margin-right: auto; color: var(--text-3); font-size: 10.5px; }
.episode-plan-foot .plan-warning { color: var(--warning); }
.episode-plan-actions { display: flex; align-items: center; gap: 8px; }

/* 页内分集 Tab 审阅：二次编辑、批注、原文核对与确认 */
.episode-inline-review { scroll-margin-top: 14px; overflow: hidden; border: 1px solid var(--border); border-radius: 12px; background: #fff; }
.episode-inline-review-head { display: flex; align-items: center; justify-content: space-between; gap: 16px; padding: 16px 18px 13px; }
.episode-inline-review-head h3 { margin: 2px 0 3px; color: var(--text-0); font-size: 15px; }
.episode-inline-review-head p { margin: 0; color: var(--text-3); font-size: 10.5px; }
.episode-detail-tabs { display: grid; grid-template-columns: repeat(var(--episode-tab-count), minmax(0, 1fr)); width: 100%; border-top: 1px solid var(--border); border-bottom: 1px solid var(--border); background: var(--bg-1); }
.episode-detail-tab { position: relative; min-width: 0; padding: 11px 5px 10px; border: none; border-right: 1px solid var(--border); border-bottom: 2px solid transparent; background: none; color: var(--text-3); font-family: var(--font-mono); font-size: 9.5px; font-weight: 750; cursor: pointer; transition: color 0.16s, border-color 0.16s, background 0.16s; }
.episode-detail-tab:last-child { border-right: none; }
.episode-detail-tab:hover { color: var(--text-1); background: rgba(255,255,255,0.7); }
.episode-detail-tab.on { border-bottom-color: var(--accent); background: #fff; color: var(--accent); }
.episode-detail-tab i { position: absolute; top: 7px; right: 7px; width: 5px; height: 5px; border-radius: 50%; background: var(--text-3); }
.episode-detail-tab.reviewed i { background: var(--success); }
.episode-inline-review-panel { display: grid; grid-template-columns: minmax(270px, 0.75fr) minmax(0, 1.45fr); gap: 18px; padding: 18px; }
.episode-review-fields { display: flex; flex-direction: column; gap: 14px; padding-right: 18px; border-right: 1px solid var(--border); }
.episode-review-title-input { font-size: 15px; font-weight: 750; }
.episode-review-note-field { margin-top: 2px; padding-top: 14px; border-top: 1px dashed var(--border); }
.episode-review-note { min-height: 112px; border-color: color-mix(in srgb, var(--accent) 28%, var(--border)); background: color-mix(in srgb, var(--accent) 3%, white); }
.episode-review-manuscript { min-width: 0; min-height: 0; display: flex; flex-direction: column; overflow: hidden; border: 1px solid var(--border); border-radius: 10px; background: #fbfaf7; }
.episode-review-manuscript-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 15px; border-bottom: 1px solid var(--border); background: rgba(255,255,255,0.72); }
.episode-review-manuscript-head > div { display: flex; flex-direction: column; gap: 3px; }
.episode-review-manuscript-head small, .episode-review-manuscript-head > span { color: var(--text-3); font-size: 9.5px; }
.episode-review-content { min-height: 280px; overflow-y: auto; padding: 20px 22px 32px; color: var(--text-1); font-family: "Noto Serif SC", "Songti SC", SimSun, serif; font-size: 14px; line-height: 2; white-space: pre-wrap; }
.episode-review-content-editable { width: 100%; flex: 1; resize: vertical; border: none; background: transparent; outline: none; }
.episode-review-content-editable:focus { box-shadow: inset 0 0 0 2px var(--accent-bg); }
.episode-inline-review-actions { grid-column: 1 / -1; display: flex; align-items: center; gap: 8px; padding-top: 14px; border-top: 1px solid var(--border); }
.episode-inline-review-actions > .btn:last-child { margin-left: auto; }
.episode-review-nav { display: flex; align-items: center; gap: 8px; margin-right: auto; }
.episode-review-nav > span { min-width: 52px; color: var(--text-3); font-family: var(--font-mono); font-size: 10px; text-align: center; }

/* Episode Grid — auto-fill 多列卡片 */
.ep-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: 14px;
}

/* 卡片主体 — 垂直面板 */
.ep-card {
  display: flex;
  flex-direction: column;
  padding: 16px 18px;
  cursor: pointer;
  border-top: 3px solid transparent;
  animation: fadeUp 0.35s var(--ease-out) both;
  transition: border-color 0.18s var(--ease-out), box-shadow 0.18s var(--ease-out), transform 0.15s var(--ease-out);
}
.ep-card:hover {
  box-shadow: var(--shadow-lift);
  transform: translateY(-2px);
}
/* 顶部状态色条 */
.ep-card-draft { border-top-color: var(--text-3); }
.ep-card-active { border-top-color: var(--success); }
.ep-card-completed { border-top-color: var(--accent); }

/* ---- 卡片头部：编号 / 状态 / 操作 ---- */
.ep-header { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }

.ep-number {
  width: 46px; height: 46px; flex-shrink: 0;
  border-radius: var(--radius);
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  font-family: var(--font-mono);
  background: var(--accent-bg); color: var(--accent-text);
  transition: background 0.16s, color 0.16s;
}
.ep-num-label {
  font-size: 8px; letter-spacing: 0.18em; font-weight: 700;
  opacity: 0.75; line-height: 1; margin-bottom: 1px;
}
.ep-number b {
  font-size: 17px; font-weight: 800; line-height: 1;
}
.ep-num-active { background: var(--success-bg); color: var(--success); }
.ep-num-completed { background: var(--accent-bg); color: var(--accent-text); }
.ep-num-draft { background: var(--bg-2); color: var(--text-1); }

.ep-badges { display: flex; align-items: center; gap: 6px; flex: 1; min-width: 0; }
.ep-actions { display: flex; align-items: center; gap: 6px; flex-shrink: 0; opacity: 0; transition: opacity 0.18s; }
.ep-card:hover .ep-actions { opacity: 1; }

/* 标题 */
.ep-title {
  font-size: 15px; font-weight: 700; color: var(--text-0);
  line-height: 1.3; margin: 0 0 10px 0;
  overflow: hidden; text-overflow: ellipsis;
  display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical;
}
.ep-source-preview { display: flex; flex-direction: column; gap: 5px; margin: 0 0 11px; padding: 9px 10px; border-radius: 8px; background: var(--bg-1); }
.ep-source-preview > span { color: var(--accent); font-size: 9px; font-weight: 700; }
.ep-source-preview > p { margin: 0; overflow: hidden; color: var(--text-3); font-size: 10.5px; line-height: 1.5; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; }

/* 元数据行 */
.ep-meta-row { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-bottom: auto; }
.ep-meta {
  display: inline-flex; align-items: center; gap: 4px;
  font-size: 11.5px; color: var(--text-3);
}
.ep-meta svg { opacity: 0.7; flex-shrink: 0; }
.ep-meta-ok { color: var(--success); }
.ep-meta-ok svg { opacity: 1; }

/* 底部栏 */
.ep-footer {
  display: flex; align-items: center; justify-content: space-between;
  margin-top: 12px; padding-top: 10px;
  border-top: 1px solid var(--border);
}
.ep-time { font-size: 11px; color: var(--text-3); opacity: 0.6; }
.ep-arrow { color: var(--text-3); transition: transform 0.18s var(--ease-out), color 0.18s; }
.ep-card:hover .ep-arrow { transform: translateX(2px); color: var(--accent); }

/* 状态胶囊 */
.ep-status-btn {
  cursor: pointer; border: none; font: inherit;
  display: inline-flex; align-items: center; gap: 5px;
  padding: 2px 9px; border-radius: 20px;
  font-size: 11px; font-weight: 600;
  transition: background 0.14s, color 0.14s;
}
.ep-status-draft { background: var(--bg-2); color: var(--text-2); }
.ep-status-active { background: rgba(34,197,94,0.1); color: #16a34a; }
.ep-status-completed { background: var(--accent-bg); color: var(--accent-text); }

/* 分辨率标签 */
.ep-res-btn {
  cursor: pointer; border: none; font: inherit;
  display: inline-flex; align-items: center;
  padding: 2px 8px; border-radius: 6px;
  font-size: 11px; font-weight: 600;
  background: var(--bg-2); color: var(--text-2);
  transition: background 0.14s, color 0.14s;
}
.ep-res-btn:hover { background: var(--bg-hover); color: var(--text-1); }

/* 状态圆点 */
.status-dot {
  width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0;
}
.dot-active { background: var(--success); box-shadow: 0 0 4px rgba(34,197,94,0.35); }
.dot-done { background: var(--accent); }
.dot-pending { background: var(--text-3); }

/* 下拉菜单 */
.status-menu {
  position: absolute;
  top: calc(100% + 5px);
  left: 0;
  width: 110px;
  display: grid;
  padding: 5px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface-raised);
  box-shadow: var(--shadow-lg);
  z-index: 10;
}
.status-menu-item {
  min-height: var(--button-height-sm);
  display: flex; align-items: center;
  border: none; border-radius: 6px;
  background: transparent; color: var(--text-1);
  padding: 0 9px; text-align: left;
  font-size: 12px; font-weight: 600;
  cursor: pointer; transition: all 0.14s var(--ease-out);
}
.status-menu-item:hover { background: var(--bg-hover); color: var(--text-0); }
.status-menu-item.on { color: var(--accent); background: var(--accent-bg); }

/* 删除按钮 */
.ep-delete {
  color: var(--text-3);
  transition: color 0.15s;
}
.ep-delete:hover { color: var(--action-danger); }

/* Empty */
.ep-empty {
  display: flex; flex-direction: column; align-items: center; gap: 10px;
  padding: 48px; text-align: center; color: var(--text-3); font-size: 13px;
  border-style: dashed;
  cursor: pointer;
  transition: border-color 0.2s, color 0.2s, background 0.2s;
}
.ep-empty:hover { border-color: var(--accent-text); color: var(--accent-text); background: var(--accent-bg); }
.ep-empty:hover .ep-empty-icon { transform: scale(1.06); }
/* 列表末尾的「添加下一集」卡片：与剧集卡片等高、内容居中 */
.ep-add { justify-content: center; min-height: 150px; padding: 24px; }
.ep-add .ep-empty-icon { width: 40px; height: 40px; }
.ep-empty-icon {
  width: 48px; height: 48px; border-radius: 50%;
  background: var(--accent-bg); color: var(--accent-text);
  display: flex; align-items: center; justify-content: center;
  transition: transform 0.2s;
}

/* Create Episode Dialog (on top of global .dialog skeleton) */
.ep-dialog { width: min(480px, 100%); }
.dialog-close { flex-shrink: 0; color: var(--text-2); }
.dialog-body { display: flex; flex-direction: column; gap: 20px; }

.field { display: flex; flex-direction: column; gap: 8px; }
.field-label { font-size: 12.5px; font-weight: 600; color: var(--text-1); }
.field-hint { font-size: 12px; color: var(--text-3); }

.dialog-foot-copy {
  margin-right: auto;
  font-size: 12px;
  line-height: 1.6;
  color: var(--text-3);
}

/* ===== 素材库 ===== */
.asset-filter { margin-bottom: 16px; }

.asset-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(190px, 1fr)); gap: 12px; align-items: stretch; }
.character-asset-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(230px, 260px));
  justify-content: start;
  gap: 10px;
}
/* 分组标题：角色 / 场景 / 道具，彩色左条 + 图标 + 数量 */
.asset-group-head {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 14px;
  margin: 4px 0 14px;
  border-radius: var(--radius);
  border-left: 3px solid var(--text-3);
  background: var(--bg-1);
  font-size: 13.5px;
  font-weight: 700;
  color: var(--text-1);
}
.asset-group-head .group-icon { display: inline-flex; color: var(--text-2); }
.asset-group-head .group-label { letter-spacing: 0.02em; }
.asset-group-head .group-count {
  margin-left: auto;
  font-size: 11.5px;
  font-weight: 600;
  color: var(--text-3);
  background: var(--bg-2);
  border-radius: 99px;
  padding: 1px 9px;
}
.asset-group-head.is-character { border-left-color: var(--accent); background: var(--accent-bg); color: var(--accent-text); }
.asset-group-head.is-character .group-icon { color: var(--accent-text); }
.asset-group-head.is-scene { border-left-color: #16a34a; background: rgba(34,197,94,0.1); color: #15803d; }
.asset-group-head.is-scene .group-icon { color: #15803d; }
.asset-group-head.is-prop { border-left-color: #b45309; background: rgba(180,83,9,0.1); color: #b45309; }
.asset-group-head.is-prop .group-icon { color: #b45309; }
.asset-card {
  display: flex; flex-direction: column; overflow: hidden;
  transition: transform 0.18s var(--ease-out), box-shadow 0.18s var(--ease-out), border-color 0.18s var(--ease-out);
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
  transition: transform 0.18s var(--ease-out), box-shadow 0.18s var(--ease-out), border-color 0.18s var(--ease-out);
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
.previewable-image { cursor: zoom-in; transition: transform 0.18s var(--ease-out), filter 0.18s var(--ease-out); }
.previewable-image:hover { transform: scale(1.015); filter: saturate(1.04); }
.asset-cover-badge {
  position: absolute;
  top: 7px;
  left: 7px;
  display: inline-flex;
  align-items: center;
  padding: 2px 7px;
  border-radius: 999px;
  background: rgba(255,255,255,0.85);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  box-shadow: 0 1px 4px rgba(0,0,0,0.08);
  color: var(--text-2);
  font-size: 9.5px;
  font-weight: 700;
}
.asset-cover-badge.is-ready {
  background: var(--success-bg);
  color: #248a3d;
}
.asset-cover-badge.is-pending {
  background: var(--accent-bg);
  color: var(--accent-text);
}
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
.prop-name-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}
.prop-name-row .asset-name { min-width: 0; }
.dot { width: 7px; height: 7px; border-radius: 50%; background: var(--bg-3); flex-shrink: 0; }
.dot.ok { background: var(--success); }
.dot.pending { background: var(--accent); }
.ring-spinner {
  width: 22px; height: 22px;
  border: 2.5px solid var(--border);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
}
.ring-spinner.sm { width: 13px; height: 13px; border-width: 2px; }
@keyframes spin { to { transform: rotate(360deg); } }

.empty-state {
  min-height: 280px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  border: 1px dashed var(--border-strong);
  border-radius: var(--radius-lg);
  background: var(--surface-raised);
  text-align: center;
}
.empty-icon {
  width: 56px; height: 56px; border-radius: var(--radius-lg);
  background: var(--bg-2); color: var(--text-3);
  display: flex; align-items: center; justify-content: center;
  margin-bottom: 4px;
}
.empty-title { font-size: 14px; font-weight: 700; color: var(--text-1); }
.empty-desc { font-size: 12px; color: var(--text-3); max-width: 260px; line-height: 1.6; }

.viewer-overlay { align-items: center; }
.viewer-dialog { width: min(960px, calc(100vw - 48px)); padding: 14px; }
.viewer-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 10px; }
.viewer-title { font-size: 13px; font-weight: 600; color: var(--text-1); }
.viewer-img { width: 100%; max-height: 76vh; object-fit: contain; border-radius: var(--radius); background: var(--bg-2); display: block; }

/* ===== 素材详情 / 编辑对话框（与工作台资产卡片同款布局） ===== */
.mat-detail-overlay { z-index: 118; padding: 28px; }
.mat-detail-dialog {
  width: min(1040px, calc(100vw - 56px));
  max-height: calc(100vh - 56px);
}
.mat-detail-head {
  display: flex; align-items: center; justify-content: space-between;
  gap: 12px; padding: 14px 16px;
  border-bottom: 1px solid var(--surface-outline);
}
.mat-detail-title-block { min-width: 0; display: flex; flex-direction: column; gap: 4px; }
.mat-detail-kicker {
  color: var(--text-3); font-size: 10px; font-weight: 800;
  letter-spacing: 0.12em; text-transform: uppercase;
}
.mat-detail-title {
  margin: 0; color: var(--text-0); font-size: 18px;
  line-height: 1.2; font-family: var(--font-display);
}
.mat-detail-head-actions {
  display: flex; align-items: center; gap: 8px; flex-shrink: 0;
}
.mat-detail-body { min-height: 0; overflow: auto; padding: 16px; }
.mat-detail-shell {
  display: grid;
  grid-template-columns: minmax(280px, 380px) minmax(0, 1fr);
  gap: 14px; align-items: start;
}
.mat-detail-preview-panel,
.mat-detail-editor-panel {
  min-width: 0; display: flex; flex-direction: column; gap: 12px;
}
.mat-detail-preview-panel { position: sticky; top: 0; }

.mat-detail-section-title {
  min-height: 24px; display: flex; align-items: center;
  justify-content: space-between; gap: 10px;
  color: var(--text-1); font-size: 12px; font-weight: 820; letter-spacing: 0.02em;
}
.mat-detail-section-title .dim {
  font-size: 11px; font-weight: 560; letter-spacing: 0; text-align: right;
}

/* 最终提示词面板 */
.mat-detail-prompt-panel {
  margin-top: 18px;
  border-top: 1px solid var(--border);
  padding-top: 16px;
}
.mat-detail-prompt-gen {
  margin-left: auto;
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.mat-detail-prompt-text {
  width: 100%;
  margin-top: 10px;
  padding: 10px 12px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  color: var(--text-0);
  font-size: 12.5px;
  line-height: 1.6;
  resize: vertical;
  min-height: 112px;
  font-family: inherit;
}
.mat-detail-prompt-text:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-bg); }
.mat-detail-prompt-text::placeholder { color: var(--text-3); }

/* 状态标签 */
.mat-detail-state {
  min-height: 20px; display: inline-flex; align-items: center;
  padding: 0 7px; border-radius: 999px;
  background: rgba(0,0,0,0.05); color: var(--text-3);
  font-size: 10px; font-weight: 760; white-space: nowrap;
}
.mat-detail-state.is-ready { color: var(--success); background: var(--success-bg); }

/* 图片预览框 */
.mat-detail-media-frame {
  position: relative; width: 100%; aspect-ratio: 16/9;
  display: block; padding: 0;
  border: 1px solid var(--surface-outline);
  border-radius: var(--radius); background: var(--bg-2);
  color: var(--text-3); overflow: hidden; cursor: zoom-in;
}
.mat-detail-media-frame:disabled { cursor: default; opacity: 1; }
.mat-detail-media-frame:focus-visible {
  outline: none; border-color: var(--action-primary);
  box-shadow: 0 0 0 3px var(--button-focus);
}
.mat-detail-media-frame img { width: 100%; height: 100%; display: block; object-fit: cover; }
.mat-detail-media-empty {
  width: 100%; height: 100%;
  display: flex; align-items: center; justify-content: center;
  color: var(--text-3);
}

/* 元数据行（类型 + 定位） */
.mat-detail-meta-row {
  display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px;
}
.mat-detail-meta-item {
  min-width: 0; padding: 9px 10px;
  border: 1px solid var(--surface-outline);
  border-radius: var(--radius); background: var(--surface-muted);
}
.mat-detail-meta-item span {
  display: block; color: var(--text-3);
  font-size: 10px; font-weight: 780; letter-spacing: 0.04em;
}
.mat-detail-meta-item strong {
  display: block; margin-top: 4px; min-width: 0;
  color: var(--text-0); font-size: 12px;
  line-height: 1.35; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;
}

/* 编辑区域 */
.mat-detail-edit-grid {
  display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px;
}
.mat-detail-edit-grid--character,
.mat-detail-edit-grid--scene { grid-template-columns: 1fr; }
.mat-detail-edit-field {
  min-width: 0; display: flex; flex-direction: column; gap: 7px;
}
.mat-detail-edit-field > span,
.mat-detail-edit-field > input::placeholder,
.mat-detail-textarea::placeholder {
  color: var(--text-3); font-size: 10px; font-weight: 780; letter-spacing: 0.04em;
}
.mat-detail-textarea { min-height: 138px; resize: vertical; }
.mat-detail-edit-grid--character .mat-detail-textarea,
.mat-detail-edit-grid--scene .mat-detail-textarea { min-height: 164px; }

/* 底部操作栏 */
.mat-detail-foot {
  display: flex; align-items: center; justify-content: space-between;
  gap: 8px; padding: 12px 16px;
  border-top: 1px solid var(--surface-outline);
}
.mat-detail-secondary-actions,
.mat-detail-primary-actions { display: flex; align-items: center; gap: 8px; }

@media (max-width: 860px) {
  .page { padding: 20px 20px 32px; }
  .page-head { flex-wrap: wrap; }
  .source-editor-layout { grid-template-columns: 1fr; }
  .project-settings-card { position: static; }
  .source-manuscript { min-height: 420px; }
  .project-style-candidates { grid-template-columns: 1fr; }
  .episode-planner-head, .episode-plan-foot { align-items: stretch; flex-direction: column; }
  .episode-count-control { grid-template-columns: 1fr; }
  .recommended-count { grid-template-columns: auto auto; }
  .recommended-count p { grid-column: 1 / -1; }
  .episode-review-toolbar { grid-template-columns: 1fr auto; }
  .review-progress-track { grid-column: 1 / -1; grid-row: 2; }
  .episode-plan-foot > span { margin-right: 0; }
  .episode-plan-actions { width: 100%; align-items: stretch; flex-direction: column; }
  .episode-plan-actions .btn { width: 100%; }
  .episode-inline-review-panel { grid-template-columns: 1fr; }
  .episode-review-fields { padding-right: 0; padding-bottom: 16px; border-right: none; border-bottom: 1px solid var(--border); }
  .episode-review-content { min-height: 240px; }
  .episode-inline-review-actions { align-items: stretch; flex-direction: column; }
  .episode-review-nav { width: 100%; margin-right: 0; justify-content: space-between; }
  .episode-inline-review-actions > .btn:last-child { width: 100%; margin-left: 0; }
  .ep-grid { grid-template-columns: 1fr; }
  .ep-actions { opacity: 1; } /* 移动端始终显示操作按钮 */
  .dialog-foot { flex-wrap: wrap; gap: 10px; }
  .dialog-foot-copy { display: none; }
}
</style>
