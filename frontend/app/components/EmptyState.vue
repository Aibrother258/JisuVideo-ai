<template>
  <div class="empty-state">
    <div class="empty-icon">
      <slot name="icon" />
    </div>
    <p class="empty-title">{{ title }}</p>
    <p v-if="desc" class="empty-desc">{{ desc }}</p>
    <slot />
  </div>
</template>

<script setup lang="ts">
// P2-B1 通用空态卡片：收敛 index/detail 手写 `.empty-state` 卡片空态（先抽后改、视觉零变化）。
//
// 用法（图标经 #icon 插槽传入，动作按钮/链接放默认插槽）：
//   <EmptyState title="还没有任何素材" desc="在剧情工作台中通过「提取资产」生成…">
//     <template #icon><svg … /></template>
//     <button class="btn btn-primary" @click="…">新建项目</button>
//   </EmptyState>
//
// 说明：
// - 形态：虚线圈框卡片（`.empty-state` 容器，`min-height:280px`）→ 56px 图标方块 → 标题 → 描述 → 默认插槽动作
// - 图标是各业务场景私有 SVG，组件不内置图标；标题/描述为文案 prop，调用页按需传入
// - 仅收敛「标准卡片空态」；episode 的 `.step-empty` 展示体空态、detail 可点击 `.ep-empty` CTA 卡、
//   settings `.config-empty` 行内空提示、BaseSelect/MentionTextarea 下拉空提示等特殊形态保留手写

withDefaults(defineProps<{
  /** 空态标题（如「还没有任何素材」） */
  title: string
  /** 空态说明（可选） */
  desc?: string
}>(), {
  desc: '',
})
</script>

<style scoped>
/* 卡片空态：原 index.vue L1394 / detail.vue L2405 同名 scoped 类（结构/样式一致，仅 .empty-desc
   max-width 240 vs 260；index 的 desc 均为单行短句不触发换行，统一 260px 视觉零变化） */
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
  width: 56px;
  height: 56px;
  border-radius: var(--radius-lg);
  background: var(--bg-2);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-3);
  margin-bottom: 4px;
}
.empty-title { font-size: 14px; font-weight: 700; color: var(--text-1); }
.empty-desc { font-size: 12px; color: var(--text-3); max-width: 260px; line-height: 1.6; }
</style>
