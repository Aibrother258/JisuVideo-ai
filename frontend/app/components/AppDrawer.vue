<template>
  <div class="overlay app-drawer-overlay" @click.self="handleMaskClick">
    <aside
      class="app-drawer"
      :style="[{ width: width || undefined }, drawerStyle]"
      role="dialog"
      aria-modal="true"
      :aria-label="ariaLabel || undefined"
    >
      <div v-if="$slots.head" class="app-drawer-head">
        <slot name="head" />
      </div>
      <slot />
    </aside>
  </div>
</template>

<script setup lang="ts">
// P2-B1 通用抽屉容器：右侧滑出骨架 + 关闭协议（与 AppDialog 对齐）。
//
// 用法（父级 v-if 控制显隐，保证与既有抽屉行为一致）：
//   <AppDrawer v-if="taskDrawer" width="min(560px, 100vw)" @close="taskDrawer = false">
//     <template #head> 标题 / 元信息 / 操作按钮（将置于 .app-drawer-head，flex 两端布局） </template>
//     正文内容（head 之后直接渲染于 .app-drawer 内，滚动/居中由调用方容器类负责）
//   </AppDrawer>
//
// 说明：#head 与默认插槽内容仍在调用页作用域编译，调用页 scoped 类可正常命中，
// 故内容级滚动/空态布局（如 .task-drawer-body/.task-drawer-empty）不必下沉到组件内部。
// 组件只收敛抽屉骨架：右滑 overlay（复用全局 .overlay 遮罩，仅将内容改到右端）、
// 面板宽度/高度/滑入动画与 Esc/遮罩关闭协议。
// overlay 级修饰（如 z-index 提升）可经组件根透传 class 实现（组件根会继承调用页 scope）。

const props = withDefaults(defineProps<{
  /** 抽屉面板宽度（CSS width 值，直接内联到 .app-drawer；不传则默认抽屉宽度） */
  width?: string
  /** 追加到 .app-drawer 的内联样式（因页面 scoped 类无法命中组件内部骨架） */
  drawerStyle?: Record<string, string>
  /** 无障碍标签（渲染到 aside[aria-label]） */
  ariaLabel?: string
  /** Esc 键关闭 */
  escClose?: boolean
  /** 点击遮罩关闭 */
  maskClose?: boolean
}>(), {
  width: '',
  drawerStyle: () => ({}),
  ariaLabel: '',
  escClose: true,
  maskClose: true,
})

const emit = defineEmits<{ close: [] }>()

function handleMaskClick() {
  if (props.maskClose) emit('close')
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.escClose) emit('close')
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<style scoped>
/* 抽屉遮罩：复用全局 .overlay 遮罩/模糊/淡入，仅把面板定位到右端并提升层级 */
.app-drawer-overlay {
  justify-content: flex-end;
  z-index: 118;
}
.app-drawer {
  height: 100%;
  display: flex;
  flex-direction: column;
  background: var(--panel-bg);
  border-left: 1px solid var(--panel-border);
  box-shadow: var(--shadow-xl);
  animation: appDrawerIn var(--dur-med) var(--ease-out);
}
@keyframes appDrawerIn {
  from { transform: translateX(24px); opacity: 0; }
  to { transform: translateX(0); opacity: 1; }
}
.app-drawer-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid var(--surface-outline);
}
</style>
