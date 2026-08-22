<script setup lang="ts">
import { Check, Copy, FileJson2 } from 'lucide-vue-next'
import { t } from '../i18n'
import HighlightText from './HighlightText.vue'

defineProps<{
  title: string
  code: string
  copied: boolean
  loading?: boolean
  error?: string
  emptyLabel: string
  keywords?: string[]
}>()

const emit = defineEmits<{ copy: [code: string] }>()
</script>

<template>
  <div class="code-view">
    <div class="code-toolbar">
      <span>{{ title }}</span>
      <button
        v-if="code"
        type="button"
        :title="copied ? t('copied') : t('copy')"
        @click="emit('copy', code)"
      >
        <Check v-if="copied" :size="13" />
        <Copy v-else :size="13" />
        {{ copied ? t('copied') : t('copy') }}
      </button>
    </div>
    <div v-if="loading" class="detail-empty"><span class="loading-ring"></span><span>{{ t('loadingResponse') }}</span></div>
    <pre v-else-if="code"><code><HighlightText :text="code" :keywords="keywords" /></code></pre>
    <div v-else-if="error" class="response-error">{{ error }}</div>
    <div v-else class="detail-empty"><FileJson2 :size="20" :stroke-width="1.4" /><span>{{ emptyLabel }}</span></div>
  </div>
</template>

<style scoped>
.code-view { height: 100%; min-height: 0; }

.code-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  min-height: 27px;
  padding: 0 10px;
  color: var(--faint);
  font-family: var(--mono);
  font-size: 11px;
  border-bottom: 1px solid var(--line);
  background: var(--panel-muted);
}

.code-toolbar button {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 24px;
  padding: 0 8px;
  color: var(--muted);
  border: 1px solid transparent;
  border-radius: 3px;
  cursor: pointer;
}

.code-toolbar button:hover { color: var(--ink); border-color: transparent; background: var(--panel-hover); }

.code-view pre {
  margin: 0;
  padding: 10px 10px 20px;
  overflow: auto;
  color: var(--ink);
  font-family: var(--mono);
  font-size: 11px;
  line-height: 1.5;
  white-space: pre;
}

.detail-empty {
  display: grid;
  place-content: center;
  justify-items: center;
  gap: 8px;
  min-height: 160px;
  padding: 24px 14px;
  color: var(--faint);
}

.loading-ring {
  width: 16px;
  height: 16px;
  border: 2px solid var(--line-strong);
  border-top-color: var(--accent);
  border-radius: 50%;
  animation: spin 750ms linear infinite;
}

.response-error {
  margin: 14px;
  padding: 10px 12px;
  color: var(--danger);
  border: 1px solid var(--danger-soft);
  border-radius: var(--radius);
  background: var(--danger-soft);
}

@keyframes spin { to { transform: rotate(360deg); } }
</style>
