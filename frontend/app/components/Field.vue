<template>
  <label class="field">
    <span v-if="label || $slots.label" class="field-label">
      <slot name="label">{{ label }}</slot>
      <span v-if="required" class="required">*</span>
    </span>
    <slot />
    <span v-if="hint || $slots.hint" class="field-hint">
      <slot name="hint">{{ hint }}</slot>
    </span>
  </label>
</template>

<script setup lang="ts">
// P2-B1 通用表单字段骨架：收敛 settings/index 手写 `.field`（label 在上 + 控件 + hint 纵向容器）。
//
// 注意：.required 星标样式已提升为 studio.css 全局类（本组件 required prop 渲染的
// `<span class="required">` 即走该全局类），#label 插槽内如需中段星标也可直接手写同款 span。
//
// 用法：
//   简单场景（纯文本 label / 末尾必填星标 / 纯文本 hint 用 prop）：
//     <Field label="风格名称" required hint="…">…控件…</Field>
//   复杂 label / hint（需内嵌 .dim 说明、条件 hint 等用命名插槽，星标/dim 走全局 .required/.dim）：
//     <Field required>
//       <template #label>风格 key <span class="dim">(创建后不可修改)</span></template>
//       …控件…
//       <template #hint>
//         <template v-if="x">…</template>
//         <template v-else>…</template>
//       </template>
//     </Field>
//
// 说明：
// - 组件只收骨架结构：`.field` 纵向容器 + `.field-label` + 默认插槽（控件区）+ `.field-hint`
// - label 为纯文本 prop 或 #label 插槽；控件是任意 DOM/组件（input/BaseSelect/textarea/复合按钮行），
//   一律放默认插槽，组件不预设控件类型
// - required 仅处理「星标位于 label 末尾」的简单场景；星标需插在文字中段时用 #label 插槽手写
//   `<span class="required">*</span>`（.required 已全局化于 studio.css）
// - 调用页单次附加布局类（.field-wide/.source-field/.compact-field 等）经 class 透传落到根元素保留
// - 样式基准：gap 5px / label 12px/550（settings 面为主基准）；index 原 gap 6/weight 600、
//   hint 原 line-height 1.5 与 settings margin-top 2px 合并归一（笔头漂移统一，见归档）
// - 不迁移深定制表单行（settings `.config-row`、index `.source-url-row` 等布局容器非 label+控件语义）

withDefaults(defineProps<{
  /** label 纯文本（复杂 label 用 #label 插槽传入） */
  label?: string
  /** 末尾必填红点星标（简单场景；中段星标用 #label 插槽手写） */
  required?: boolean
  /** hint 纯文本（复杂 hint 用 #hint 插槽传入） */
  hint?: string
}>(), {
  label: '',
  required: false,
  hint: '',
})
</script>

<style scoped>
/* 收敛自 settings.vue L2043-2046 / index.vue L1436-1439 同名 scoped 类（gap/weight/line-height 笔头漂移归一，见上注释） */
.field { display: flex; flex-direction: column; gap: 5px; }
.field-label { font-size: 12px; font-weight: 550; color: var(--text-1); }
.field-hint { font-size: 11px; color: var(--text-3); margin-top: 2px; line-height: 1.5; }
/* #hint 插槽内容为条件渲染（如 v-if 不满足）时 span 为空，隐藏避免产生空隙 */
.field-hint:empty { display: none; }
</style>
