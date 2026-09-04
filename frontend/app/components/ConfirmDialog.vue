<template>
  <Teleport to="body">
    <div v-if="open" class="overlay" @click.self="emit('cancel')">
      <div class="dialog confirm-dialog" role="alertdialog" aria-modal="true" :aria-label="title">
        <div class="confirm-icon">
          <Trash2 :size="20" :stroke-width="1.8" />
        </div>
        <h2 class="confirm-title">{{ title }}</h2>
        <p class="confirm-message">{{ message }}</p>
        <div class="confirm-actions">
          <button type="button" class="btn" :disabled="loading" @click="emit('cancel')">取消</button>
          <button type="button" class="btn confirm-danger-btn" :disabled="loading" @click="emit('confirm')">
            <Loader2 v-if="loading" :size="13" class="animate-spin" />
            {{ loading ? loadingText : confirmText }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { Trash2, Loader2 } from 'lucide-vue-next'

const props = defineProps({
  open: { type: Boolean, default: false },
  title: { type: String, default: '确认删除' },
  message: { type: String, default: '' },
  confirmText: { type: String, default: '删除' },
  loadingText: { type: String, default: '删除中...' },
  loading: { type: Boolean, default: false },
})

const emit = defineEmits(['confirm', 'cancel'])

function onKeydown(e) {
  if (e.key === 'Escape') emit('cancel')
  if (e.key === 'Enter') emit('confirm')
}

watch(() => props.open, (v) => {
  if (v) window.addEventListener('keydown', onKeydown)
  else window.removeEventListener('keydown', onKeydown)
})

onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<style scoped>
.confirm-dialog {
  width: 400px;
  max-width: calc(100vw - 48px);
  padding: 28px 24px 20px;
  align-items: center;
  text-align: center;
}
.confirm-icon {
  width: 52px;
  height: 52px;
  border-radius: 50%;
  background: var(--action-danger-bg);
  color: var(--action-danger);
  display: flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 14px;
}
.confirm-title {
  font-size: 16px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: var(--text-0);
}
.confirm-message {
  margin-top: 8px;
  font-size: 13px;
  line-height: 1.65;
  color: var(--text-2);
  max-width: 320px;
  word-break: break-word;
}
.confirm-actions {
  display: flex;
  gap: 10px;
  width: 100%;
  margin-top: 22px;
}
.confirm-actions .btn { flex: 1; }
.confirm-danger-btn {
  background: var(--action-danger);
  color: var(--text-invert);
}
.confirm-danger-btn:hover { background: var(--action-danger-hover); color: var(--text-invert); }
.confirm-danger-btn:disabled { opacity: 0.6; }
</style>
