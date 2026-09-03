<template>
  <div class="overlay" @click.self="handleMaskClick">
    <component
      :is="form ? 'form' : 'div'"
      class="dialog"
      :style="width ? { width } : undefined"
      role="dialog"
      aria-modal="true"
      @submit.prevent="handleSubmit"
    >
      <div v-if="$slots.head" class="dialog-head">
        <slot name="head" />
      </div>
      <div class="dialog-body">
        <slot />
      </div>
      <div v-if="$slots.foot" class="dialog-foot">
        <slot name="foot" />
      </div>
    </component>
  </div>
</template>

<script setup lang="ts">
// P2-B1 通用弹窗容器：统一 .overlay/.dialog 骨架、head/body/foot 三段与关闭协议。
//
// 用法（父级 v-if 控制显隐，保证与既有弹窗行为一致）：
//   <AppDialog v-if="cfgDialog" form :width="'min(720px, calc(100vw - 40px))'"
//              @close="cfgDialog = false" @submit="saveCfg">
//     <template #head> 标题 / 徽标等 </template>
//     正文内容（将置于 .dialog-body 内；如需内部纵向布局，自行包一层容器类）
//     <template #foot> 底部按钮（取消 / 保存） </template>
//   </AppDialog>
//
// 说明：head/body/foot 的插槽内容仍在调用页作用域编译，调用页 scoped 类可正常命中，
// 故尺寸等页面私有样式不必下沉到组件内部；统一宽度请用 width prop（内联样式，规避 scoped 失效）。
// 关闭协议：Esc（escClose，默认开）与点击遮罩（maskClose，默认开）统一派发 close，
// 与 ConfirmDialog 行为对齐；form 模式渲染 <form>，foot 中 type="submit" 触发 @submit。

const props = withDefaults(defineProps<{
  /** 渲染为 <form>，foot 中的 type="submit" 按钮触发 @submit（已 prevent 默认提交） */
  form?: boolean
  /** 弹窗宽度（CSS width 值，直接内联到 .dialog；不传则按内容自适应） */
  width?: string
  /** Esc 键关闭 */
  escClose?: boolean
  /** 点击遮罩关闭 */
  maskClose?: boolean
}>(), {
  form: false,
  width: '',
  escClose: true,
  maskClose: true,
})

const emit = defineEmits<{ close: []; submit: [] }>()

function handleMaskClick() {
  if (props.maskClose) emit('close')
}

function handleSubmit() {
  if (props.form) emit('submit')
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape' && props.escClose) emit('close')
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>
