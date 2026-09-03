<template>
  <div class="model-select" ref="rootEl">
    <span class="model-select-label">{{ label }}</span>
    <button type="button" class="model-select-trigger" :class="{ open: isOpen }" @click="toggle">
      <span v-if="currentOption?.provider" class="model-select-provider">{{ currentOption.provider }}</span>
      <span class="model-select-value">{{ currentLabel }}</span>
      <ChevronDown :size="11" class="model-select-arrow" />
    </button>

    <Teleport to="body">
      <div v-if="isOpen" class="model-select-menu" :style="menuStyle" ref="menuEl">
        <button
          type="button"
          :class="['model-select-option', { selected: modelValue === '' }]"
          @click="pick('')"
        >
          <Check :size="12" class="opt-check" />
          <span class="opt-model dim">{{ defaultLabel }}</span>
        </button>
        <button
          v-for="o in options"
          :key="o.key || o.model"
          type="button"
          :class="['model-select-option', { selected: modelValue === (o.key || o.model) }]"
          @click="pick(o.key || o.model)"
        >
          <Check :size="12" class="opt-check" />
          <span class="opt-model">{{ o.model }}</span>
          <span v-if="o.provider" class="opt-provider">{{ o.provider }}</span>
          <span v-if="showConfig" class="opt-config">{{ o.configName }}</span>
        </button>
      </div>
      <div v-if="isOpen" class="model-select-backdrop" @click="close" />
    </Teleport>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onBeforeUnmount } from 'vue'
import { ChevronDown, Check } from 'lucide-vue-next'

const props = defineProps({
  label: { type: String, required: true },          // 改写 / 图片 / 视频
  modelValue: { type: String, default: '' },        // '' = 默认（配置首个模型）；选中值为 'provider/model' 复合键
  options: { type: Array, default: () => [] },      // [{ key, model, provider, configId, configName }]
  defaultLabel: { type: String, default: '默认' },
  showConfig: { type: Boolean, default: false },    // 多配置时显示来源配置名
})
const emit = defineEmits(['update:modelValue'])

const isOpen = ref(false)
const rootEl = ref()
const menuEl = ref()
const menuStyle = ref({})

const currentOption = computed(() => props.options.find(o => (o.key || o.model) === props.modelValue) || null)
const currentLabel = computed(() => currentOption.value?.model || props.defaultLabel)

function toggle() { isOpen.value ? close() : open() }

async function open() {
  isOpen.value = true
  await nextTick()
  positionMenu()
  menuEl.value?.querySelector('.selected')?.scrollIntoView({ block: 'nearest' })
}

function close() { isOpen.value = false }

function pick(model) {
  emit('update:modelValue', model)
  close()
}

function positionMenu() {
  const rect = rootEl.value?.getBoundingClientRect()
  if (!rect) return
  const menuWidth = Math.max(rect.width, 240)
  const left = Math.min(rect.left, window.innerWidth - menuWidth - 12)
  menuStyle.value = {
    position: 'fixed',
    top: `${rect.bottom + 6}px`,
    left: `${Math.max(12, left)}px`,
    minWidth: `${menuWidth}px`,
    maxHeight: `${Math.min(window.innerHeight - rect.bottom - 20, 340)}px`,
  }
}

function onKeydown(e) {
  if (e.key === 'Escape') close()
}

watch(isOpen, (val) => {
  if (val) {
    document.addEventListener('scroll', positionMenu, true)
    document.addEventListener('keydown', onKeydown)
  } else {
    document.removeEventListener('scroll', positionMenu, true)
    document.removeEventListener('keydown', onKeydown)
  }
})

onBeforeUnmount(() => {
  document.removeEventListener('scroll', positionMenu, true)
  document.removeEventListener('keydown', onKeydown)
})
</script>

<style scoped>
.model-select {
  display: flex;
  align-items: center;
  gap: 6px;
}
.model-select-label {
  font-size: 11px;
  font-weight: 600;
  color: var(--text-3);
}
.model-select-trigger {
  display: flex;
  align-items: center;
  gap: 6px;
  height: 26px;
  max-width: 210px;
  padding: 0 8px 0 10px;
  border: 1px solid var(--border-strong);
  border-radius: 999px;
  background: var(--bg-input);
  color: var(--text-1);
  font: 11px var(--font-body);
  cursor: pointer;
  transition: border-color var(--dur-fast) var(--ease-out), box-shadow var(--dur-fast) var(--ease-out), background var(--dur-fast) var(--ease-out);
}
.model-select-trigger:hover { border-color: var(--border-hover); }
.model-select-trigger.open,
.model-select-trigger:focus-visible {
  border-color: var(--border-focus);
  box-shadow: 0 0 0 3px var(--button-focus);
  outline: none;
}
.model-select-value {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.model-select-provider {
  flex-shrink: 0;
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--accent-bg);
  color: var(--accent);
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}
.model-select-arrow {
  flex-shrink: 0;
  color: var(--text-3);
  transition: transform var(--dur-base) var(--ease-out);
}
.model-select-trigger.open .model-select-arrow { transform: rotate(180deg); }
</style>

<!-- 菜单 Teleport 到 body，不能用 scoped -->
<style>
.model-select-backdrop {
  position: fixed;
  inset: 0;
  z-index: 990;
}
.model-select-menu {
  z-index: 991;
  display: flex;
  flex-direction: column;
  gap: 1px;
  padding: 5px;
  border-radius: 12px;
  background: var(--bg-1);
  border: 1px solid var(--border);
  box-shadow: 0 12px 32px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.06);
  overflow-y: auto;
  animation: modelMenuIn var(--dur-fast) var(--ease-out);
}
@keyframes modelMenuIn {
  from { opacity: 0; transform: translateY(-4px) scale(0.98); }
  to { opacity: 1; transform: none; }
}
.model-select-option {
  display: flex;
  align-items: center;
  gap: 7px;
  width: 100%;
  padding: 7px 9px;
  border: none;
  border-radius: 8px;
  background: transparent;
  color: var(--text-1);
  font: 12px var(--font-body);
  text-align: left;
  cursor: pointer;
  transition: background var(--dur-instant) var(--ease-out);
}
.model-select-option:hover { background: var(--accent-bg); }
.model-select-option .opt-check {
  flex-shrink: 0;
  color: var(--accent);
  opacity: 0;
}
.model-select-option.selected .opt-check { opacity: 1; }
.model-select-option.selected .opt-model { font-weight: 600; color: var(--text-0); }
.model-select-option .opt-model {
  overflow: hidden;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.model-select-option .opt-model.dim { color: var(--text-3); }
.model-select-option .opt-provider {
  flex-shrink: 0;
  margin-left: auto;
  padding: 1px 5px;
  border-radius: 4px;
  background: var(--bg-3);
  color: var(--text-3);
  font-size: 9px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.02em;
}
.model-select-option .opt-config {
  flex-shrink: 0;
  font-size: 10px;
  color: var(--text-3);
}
</style>
