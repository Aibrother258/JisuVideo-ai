<template>
  <section class="card theme-card">
    <div class="theme-card-head">
      <span class="theme-card-icon"><SunMoon :size="15" /></span>
      <div class="theme-card-heading">
        <div class="theme-card-title">界面主题</div>
        <div class="theme-card-sub">选择应用显示外观</div>
      </div>
    </div>
    <div class="theme-options" role="radiogroup" aria-label="界面主题">
      <label
        v-for="opt in themeOptions"
        :key="opt.value"
        :class="['theme-opt', { active: mode === opt.value }]"
      >
        <input type="radio" name="ui-theme" :value="opt.value" :checked="mode === opt.value" @change="setTheme(opt.value)" />
        <span class="theme-radio" aria-hidden="true"></span>
        <component :is="opt.icon" :size="15" class="theme-opt-icon" />
        <span class="theme-opt-copy">
          <span class="theme-opt-name">{{ opt.label }}</span>
          <span class="theme-opt-desc">{{ opt.desc }}</span>
        </span>
        <span v-if="mode === opt.value" class="theme-opt-check"><Check :size="14" /></span>
      </label>
    </div>
    <div class="theme-pref-note">当前实际外观：{{ resolved === 'dark' ? '深色' : '浅色' }}（{{ modeLabel }}）</div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { SunMoon, Monitor, Sun, Moon, Check } from 'lucide-vue-next'
import { useTheme } from '~/composables/useTheme'
import type { ThemeMode } from '~/utils/theme-core.mjs'

/**
 * C4 第三批 · 设置页「外观」——界面主题三态切换（跟随系统 / 浅色 / 深色）。
 * 交互内聚于此：mode/resolved 驱动选中态与「当前实际外观」文案；选择即
 * setTheme → theme.client.ts 注册的 controller 统一持久化 + 应用 + system 实时跟随，
 * 组件不直接触碰 localStorage（持久化单点在 theme-core writeStoredMode）。
 */
const { mode, resolved, setTheme } = useTheme()

const themeOptions: { value: ThemeMode; label: string; desc: string; icon: typeof Sun }[] = [
  { value: 'system', label: '跟随系统', desc: '随系统深浅色偏好自动切换', icon: Monitor },
  { value: 'light', label: '浅色', desc: '始终使用浅色外观', icon: Sun },
  { value: 'dark', label: '深色', desc: '始终使用深色外观', icon: Moon },
]

const modeLabel = computed(() => (mode.value === 'dark' ? '深色' : mode.value === 'light' ? '浅色' : '跟随系统'))
</script>

<style scoped>
.theme-card { overflow: hidden; }
.theme-card-head {
  display: flex; align-items: center; gap: 10px;
  padding: 14px 20px; border-bottom: 1px solid var(--border);
}
.theme-card-heading { min-width: 0; }
.theme-card-title { font-size: 14px; font-weight: 700; color: var(--text-0); }
.theme-card-sub { font-size: 11.5px; color: var(--text-2); margin-top: 2px; }
.theme-card-icon {
  display: inline-flex; align-items: center; justify-content: center;
  width: 28px; height: 28px; border-radius: 8px; flex-shrink: 0;
  background: var(--accent-bg); color: var(--accent);
}
.theme-options { display: flex; flex-direction: column; padding: 4px 0; }
.theme-opt {
  position: relative; display: flex; align-items: center; gap: 10px;
  padding: 11px 20px; cursor: pointer;
  border-top: 1px solid var(--border);
}
.theme-opt:first-child { border-top: none; }
.theme-opt:hover, .theme-opt:focus-within { background: var(--bg-hover); }
.theme-opt input { position: absolute; opacity: 0; width: 0; height: 0; }
.theme-radio {
  width: 16px; height: 16px; border-radius: 50%; flex-shrink: 0;
  border: 1.5px solid var(--border-strong);
  display: inline-flex; align-items: center; justify-content: center;
  transition: border-color var(--dur-fast) var(--ease-out);
}
.theme-radio::after {
  content: ''; width: 8px; height: 8px; border-radius: 50%;
  background: transparent; transition: background var(--dur-fast) var(--ease-out);
}
.theme-opt:focus-within .theme-radio { box-shadow: 0 0 0 3px var(--button-focus); }
.theme-opt.active .theme-radio { border-color: var(--accent); }
.theme-opt.active .theme-radio::after { background: var(--accent); }
.theme-opt-icon { color: var(--text-2); flex-shrink: 0; }
.theme-opt.active .theme-opt-icon { color: var(--accent); }
.theme-opt-copy { display: flex; flex-direction: column; gap: 1px; min-width: 0; }
.theme-opt-name { font-size: 13px; font-weight: 600; color: var(--text-0); }
/* 评审 P2：说明文字 11px 普通文本须 AA ≥4.5:1 → --text-2（dark #86868b on #1e1e1f ≈4.60:1）而非 --text-3 */
.theme-opt-desc { font-size: 11px; color: var(--text-2); }
.theme-opt-check { margin-left: auto; color: var(--accent); flex-shrink: 0; display: inline-flex; }
.theme-pref-note {
  display: flex; align-items: center;
  padding: 10px 20px; border-top: 1px solid var(--border);
  font-size: 11.5px; color: var(--text-2);
}
</style>
