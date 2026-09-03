<template>
  <!-- ===== SCRIPT PANEL：剧本编辑面板主体（原始内容 / AI 改写编辑） =====
       组件职责：Step0 原始内容 / Step1 改写编辑两态的「工具条 + 全文文本域」渲染与输入上报。
       主壳保留：编辑缓冲 localRaw/localScript（跨面板切换保留 + 刷新按内容重置的页面级状态，
       以 raw/script 受控下发、update:raw/update:script 回写）、scriptStep（底部气泡/侧栏导航/
       localStorage 持久化共用）、doRewrite/saveRaw/skipRewrite 与 rn/rt 运行态——
       保存/改写/跳过经事件触发主壳执行（改写完成需 refresh 全剧数据，无法在卸载的子组件内进行）。
       改写引导空态与改写进行中整块加载态由主壳承载（.step-empty/.step-loading 共享态样式不复制）。 -->
  <div class="step-editor">
    <template v-if="step === 0">
      <!-- Step 0: Raw Content -->
      <div class="step-toolbar">
        <div class="toolbar-left">
          <div class="step-indicator">
            <span class="step-num">01</span>
            <span class="step-name">原始内容</span>
          </div>
        </div>
        <div class="toolbar-right">
          <span v-if="rawLen" class="char-count">{{ rawLen }} 字</span>
          <button class="btn btn-sm" @click="emit('save-raw')">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
            保存
          </button>
        </div>
      </div>
      <textarea
        class="fill-textarea"
        :value="raw"
        placeholder="粘贴小说原文、故事大纲或分镜描述..."
        @input="emit('update:raw', ($event.target as HTMLTextAreaElement).value)"
      />
    </template>
    <template v-else>
      <!-- Step 1: Rewrite -->
      <div class="step-toolbar">
        <div class="toolbar-left">
          <div class="step-indicator">
            <span class="step-num">02</span>
            <span class="step-name">AI 改写</span>
          </div>
        </div>
        <div class="toolbar-right">
          <span v-if="scriptLen" class="char-count">{{ scriptLen }} 字</span>
          <button v-if="hasRaw" class="btn btn-sm" @click="emit('skip-rewrite')">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M5 12h14"/><path d="M13 18l6-6-6-6"/></svg>
            跳过改写
          </button>
          <LoadingButton v-if="hasScript" :loading="running && taskType === 'script_rewriter'" :disabled="running && taskType !== 'script_rewriter'" class="btn btn-sm" spinner-size="11" @click="emit('rewrite')">
            <template #icon><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg></template>
            重新改写
          </LoadingButton>
        </div>
      </div>
      <textarea
        class="fill-textarea"
        :value="script"
        placeholder="格式化剧本内容..."
        @input="emit('update:script', ($event.target as HTMLTextAreaElement).value)"
      />
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import LoadingButton from '~/components/LoadingButton.vue'

// B2 拆分：编辑器为受控组件——主壳持编辑缓冲（跨面板保留 + 刷新重置），本组件只输入上报；
// 改写进行中/引导空态不渲染本组件（主壳整块态），故 Step1 在此恒为文本域态。
const props = defineProps({
  /** 剧本步骤：0=原始内容（Step0）/ 1=AI 改写（Step1），由主壳 scriptStep 下发 */
  step: { type: Number, required: true },
  /** 原始内容编辑缓冲（主壳 localRaw 受控下发） */
  raw: { type: String, default: '' },
  /** 格式化剧本编辑缓冲（主壳 localScript 受控下发） */
  script: { type: String, default: '' },
  /** 已保存原始内容是否存在（episode.content）——Step1「跳过改写」入口条件 */
  hasRaw: { type: Boolean, default: false },
  /** 已生成剧本是否存在（script_content）——「重新改写」入口条件 */
  hasScript: { type: Boolean, default: false },
  /** 全局 Agent 是否运行中（主壳 rn）——他任务忙时改写按钮禁用 */
  running: { type: Boolean, default: false },
  /** 当前运行 Agent 类型（主壳 rt）——仅 script_rewriter 属本面板改写中 */
  taskType: { type: String, default: '' },
})
const emit = defineEmits(['save-raw', 'rewrite', 'skip-rewrite', 'update:raw', 'update:script'])

const rawLen = computed(() => props.raw.replace(/\s/g, '').length || 0)
const scriptLen = computed(() => props.script.replace(/\s/g, '').length || 0)
</script>

<style scoped>
/* 编辑器工具条（自 episode.vue 下沉，仅本面板使用） */
.step-toolbar {
  display: flex; align-items: center; gap: 10px;
  min-height: 44px;
  padding: 8px 12px; border-bottom: 1px solid var(--border);
  background: var(--surface-raised); flex-shrink: 0;
}
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

/* 编辑区 */
.step-editor { flex: 1; display: flex; flex-direction: column; min-height: 0; }
.fill-textarea {
  flex: 1; border: none; border-radius: 0; padding: 26px 28px;
  font-size: 13.5px; line-height: 1.9; resize: none; outline: none;
  font-family: var(--font-body); background: var(--bg-input); color: var(--text-0);
}
.fill-textarea:focus { box-shadow: none; }

@media (max-width: 860px) {
  .toolbar-right { flex-wrap: wrap; }
}
</style>
