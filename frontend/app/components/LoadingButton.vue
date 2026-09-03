<template>
  <button :disabled="disabled || loading">
    <Loader2 v-if="loading" :size="spinnerSize" class="animate-spin" aria-hidden="true" />
    <slot v-else name="icon" />
    <slot />
  </button>
</template>

<script setup lang="ts">
import { Loader2 } from 'lucide-vue-next'
// P2-B1 通用加载按钮：收敛「按钮 + busy 时 disabled + spinner 替换图标」标准结构（先抽后改、视觉零变化）。
//
// 用法（busy 判断留在调用页，文案切换经默认插槽三元保留在调用页）：
//   <LoadingButton :loading="styleExpanding" type="button" class="btn btn-ghost btn-sm" @click="expandStyle">
//     <template #icon><Sparkles :size="13" /></template>
//     {{ styleExpanding ? '完善中…' : 'AI 完善' }}
//   </LoadingButton>
//
// 说明：
// - 语义与原始手写完全一致：loading 时前置 <Loader2 :size="spinnerSize" class="animate-spin">
//   （原 Loader2 族视觉，尺寸经 spinnerSize 逐处保留），#icon 插槽被替换（对应原 icon v-else 分支），
//   默认插槽（文案，可含三元切换）始终渲染
// - class（.btn/.btn-sm/btn-primary 等变体）、type、@click 及其余属性经 attrs 透传，视觉由调用页完全决定
// - 仅收敛「Loader2 图标 spinner」族（settings/episode 标准面）；detail/index 的 CSS 环
//   （.ring-spinner.sm / .spinner-sm）与「整块加载态」（.step-loading 24px）视觉不同，不迁入本组件

withDefaults(defineProps<{
  /** busy 状态：为 true 时禁用按钮并前置旋转 spinner */
  loading?: boolean
  /** 非 loading 的额外禁用条件（loading 自身恒禁用，勿重复传入） */
  disabled?: boolean
  /** spinner 尺寸 px（原调用页 Loader2 :size 逐处保留：11/12/13…） */
  spinnerSize?: number
}>(), {
  loading: false,
  disabled: false,
  spinnerSize: 13,
})
</script>
