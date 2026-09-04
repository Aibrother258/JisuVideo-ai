<template>
  <NuxtLayout>
    <NuxtPage />
  </NuxtLayout>
  <Toaster position="top-right" :duration="3000" />
</template>

<script setup>
import { Toaster } from 'vue-sonner'

// UI C4 暗色主题：首帧写入 data-theme，避免「先亮后闪」。
// 三态：localStorage['ui-theme'] 为 'dark'/'light' 时强制；缺省（system）跟随 prefers-color-scheme。
// 值详见 docs/ui-dark-theme-spec.md §2；dark token 覆盖块在 assets/studio.css。
useHead({
  script: [{
    innerHTML: `(function(){try{var t=localStorage.getItem('ui-theme');var d=t==='dark'||(t!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.setAttribute('data-theme',d?'dark':'light')}catch(e){document.documentElement.setAttribute('data-theme','light')}})();`,
  }],
})
</script>

<style>
@import url('./assets/studio.css');
</style>
