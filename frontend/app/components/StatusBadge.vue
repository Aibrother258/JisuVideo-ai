<template>
  <span
    class="status-badge"
    :class="[`sb-${variant}`, state ? `is-${state}` : '']"
  ><slot /></span>
</template>

<script setup lang="ts">
// P2-B1 通用状态胶囊：收敛 detail/episode 手写状态徽标（先抽后改、视觉零变化）。
//
// 用法（父级按状态传入，文字经默认插槽传入）：
//   <StatusBadge variant="cover" :state="matHasImage(m) ? 'ready' : (isPending(m) ? 'pending' : '')">
//     已生成 / 生成中 / 待生成（按状态三元文案，原样保留在调用页）
//   </StatusBadge>
//
// variant：
//   - cover：封面玻璃角标（原 .asset-cover-badge）——absolute 定位于父容器左上角，
//     调用处父容器必须 position:relative（原 .asset-cover / .character-portrait 均已具备）
//   - pill（默认）：行内胶囊标签（原 .mat-detail-state / .asset-detail-state）
// state：'' 中性 / 'ready' 成功 / 'pending' 进行中（配色按 variant 声明）
//
// 说明：调用页 scoped 类无法命中组件内部，故玻璃/胶囊本体样式下沉组件内部直接声明；
// 无定位之外的外部布局覆盖需求，故不提供 class 透传之外的接口。

withDefaults(defineProps<{
  /** 胶囊形态：cover=封面玻璃角标（absolute，需父容器 relative）；pill=行内胶囊（默认） */
  variant?: 'cover' | 'pill'
  /** 状态：'' 中性 / ready 成功 / pending 进行中 */
  state?: '' | 'ready' | 'pending'
}>(), {
  variant: 'pill',
  state: '',
})
</script>

<style scoped>
/* cover：封面玻璃角标（原 .asset-cover-badge；父容器需 position:relative） */
.sb-cover {
  position: absolute;
  top: 7px;
  left: 7px;
  display: inline-flex;
  align-items: center;
  padding: 2px 7px;
  border-radius: 999px;
  background: var(--surface-glass);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  box-shadow: var(--shadow-float);
  color: var(--text-2);
  font-size: 9.5px;
  font-weight: 700;
}
.sb-cover.is-ready {
  background: var(--success-bg);
  color: var(--success-strong);
}
.sb-cover.is-pending {
  background: var(--accent-bg);
  color: var(--accent-text);
}
/* pill：行内中性胶囊（原 .mat-detail-state / .asset-detail-state） */
.sb-pill {
  min-height: 20px;
  display: inline-flex;
  align-items: center;
  padding: 0 7px;
  border-radius: 999px;
  background: var(--fill-subtle);
  color: var(--text-3);
  font-size: 10px;
  font-weight: 760;
  white-space: nowrap;
}
.sb-pill.is-ready {
  color: var(--success);
  background: var(--success-bg);
}
</style>
