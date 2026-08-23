<script setup lang="ts">
import { onBeforeUnmount, ref, computed } from 'vue'
import { Check, Copy } from 'lucide-vue-next'
import { requestToCurl, requestToFetch, requestToNodeAxios } from '../../core/curl'
import type { CapturedRequest } from '../../types/network'
import { detailTabs, type DetailTab } from '../constants'
import { t } from '../i18n'
import { methodClass, prettyText, responseText, statusClass, statusDetail } from '../utils/format'
import DetailCodeView from './DetailCodeView.vue'
import DetailHeaders from './DetailHeaders.vue'
import DetailOverview from './DetailOverview.vue'
import DetailParams from './DetailParams.vue'
import HighlightText from './HighlightText.vue'

const props = defineProps<{
  request: CapturedRequest
  activeTab: DetailTab
  responseLoading: boolean
  batchKeywords?: string[]
}>()

const emit = defineEmits<{ 'update:activeTab': [tab: DetailTab] }>()

const copiedAction = ref('')
let copyTimer: number | undefined

const copyTargets = [
  { action: 'curl', label: 'cURL', build: requestToCurl },
  { action: 'fetch', label: 'fetch', build: requestToFetch },
  { action: 'axios', label: 'Node axios', build: requestToNodeAxios },
]

async function copyText(text: string, action: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text)
  } catch {
    const textarea = document.createElement('textarea')
    textarea.value = text
    textarea.style.position = 'fixed'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.select()
    document.execCommand('copy')
    textarea.remove()
  }
  copiedAction.value = action
  window.clearTimeout(copyTimer)
  copyTimer = window.setTimeout(() => (copiedAction.value = ''), 1400)
}

function selectTab(tab: DetailTab): void {
  emit('update:activeTab', tab)
}

/** Text each tab shows — used to mark tabs whose content hits a batch keyword. */
function tabText(tab: DetailTab): string {
  switch (tab) {
    case 'params':
      return props.request.parameters.map((parameter) => `${parameter.path}=${parameter.value}`).join('\n')
    case 'payload':
      return prettyText(props.request.requestBody, props.request.requestBodyMime)
    case 'headers':
      return [...props.request.requestHeaders, ...props.request.responseHeaders]
        .map(({ name, value }) => `${name}:${value}`)
        .join('\n')
    case 'response':
      return responseText(props.request)
    default:
      return props.request.url
  }
}

const tabHits = computed(() => {
  const keywords = (props.batchKeywords ?? []).map((keyword) => keyword.toLowerCase()).filter(Boolean)
  if (keywords.length === 0) return {}
  const hits: Partial<Record<DetailTab, number>> = {}
  for (const tab of ['overview', 'params', 'payload', 'headers', 'response'] as DetailTab[]) {
    const text = tabText(tab).toLowerCase()
    const index = keywords.findIndex((keyword) => text.includes(keyword))
    if (index >= 0) hits[tab] = index
  }
  return hits
})

onBeforeUnmount(() => window.clearTimeout(copyTimer))
</script>

<template>
  <aside class="inspector" :aria-label="t('requestDetail')">
    <div class="inspector-top">
      <header class="inspector-header">
        <div class="request-identity">
          <span class="method-pill" :class="methodClass(request.method)">{{ request.method }}</span>
          <span class="status-pill" :class="statusClass(request.status)" :title="request.status <= 0 ? request.statusText : ''">
            {{ statusDetail(request) }}
          </span>
          <strong :title="request.url">{{ request.pathname }}</strong>
          <small>{{ request.host }}</small>
        </div>
        <div class="inspector-actions">
          <button
            class="icon-button"
            type="button"
            :title="copiedAction === 'url' ? t('copied') : t('copyUrl')"
            :aria-label="t('copyUrl')"
            @click="copyText(request.url, 'url')"
          >
            <Check v-if="copiedAction === 'url'" :size="14" />
            <Copy v-else :size="14" />
          </button>
          <details class="copy-menu" @toggle="($event.target as HTMLDetailsElement).open || (copiedAction = '')">
            <summary class="curl-button" :title="copiedAction ? t('copiedFormat', { x: copiedAction }) : t('copyRequestCode')">
              <Check v-if="copiedAction" :size="13" />
              <Copy v-else :size="13" />
              {{ copiedAction ? t('copiedFormat', { x: copiedAction }) : t('copy') }}
            </summary>
            <div class="copy-menu-popover">
              <button
                v-for="target in copyTargets"
                :key="target.action"
                type="button"
                @click="copyText(target.build(request), target.action)"
              >
                {{ copiedAction === target.action ? '✓ ' : '' }}{{ target.label }}
              </button>
            </div>
          </details>
        </div>
      </header>
    </div>

    <nav class="detail-tabs" :aria-label="t('detailNavAria')">
      <button
        v-for="tab in detailTabs"
        :key="tab.value"
        type="button"
        :class="{ active: activeTab === tab.value }"
        @click="selectTab(tab.value)"
      >
        {{ t(tab.label) }}
        <i
          v-if="tabHits[tab.value] !== undefined"
          class="tab-hit"
          :style="{ background: `var(--batch-${(tabHits[tab.value] ?? 0) % 8})` }"
          aria-hidden="true"
        ></i>
        <span v-if="tab.value === 'params' && request.parameters.length">{{ request.parameters.length }}</span>
      </button>
    </nav>

    <div class="detail-content">
      <DetailOverview v-if="activeTab === 'overview'" :request="request" :keywords="batchKeywords" @goto-tab="selectTab" />
      <DetailParams v-else-if="activeTab === 'params'" :request="request" :keywords="batchKeywords" />
      <DetailCodeView
        v-else-if="activeTab === 'payload'"
        :title="request.requestBodyMime || 'Request body'"
        :code="prettyText(request.requestBody, request.requestBodyMime)"
        :copied="copiedAction === 'payload'"
        :keywords="batchKeywords"
        :empty-label="t('emptyPayload')"
        @copy="copyText($event, 'payload')"
      />
      <DetailHeaders v-else-if="activeTab === 'headers'" :request="request" :keywords="batchKeywords" />
      <DetailCodeView
        v-else
        :title="request.mimeType || 'Response body'"
        :code="responseText(request)"
        :copied="copiedAction === 'response'"
        :keywords="batchKeywords"
        :loading="responseLoading"
        :error="request.responseError"
        :empty-label="t('emptyResponse')"
        @copy="copyText($event, 'response')"
      />
    </div>
  </aside>
</template>

<style scoped>
.inspector {
  display: grid;
  grid-template-rows: auto 27px minmax(0, 1fr);
  min-width: 0;
  min-height: 0;
  overflow: hidden;
  background: var(--panel);
}

.inspector-top { border-bottom: 0; background: var(--toolbar-tinted); }

.inspector-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-width: 0;
  min-height: 28px;
  padding: 0 6px 0 8px;
}

.request-identity {
  display: flex;
  align-items: center;
  gap: 6px;
  min-width: 0;
}

.request-identity strong {
  overflow: hidden;
  max-width: 100%;
  color: var(--ink);
  font-family: var(--mono);
  font-size: 11px;
  font-weight: 500;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.request-identity small {
  overflow: hidden;
  flex: 0 1 auto;
  color: var(--faint);
  font-family: var(--mono);
  font-size: 10px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.method-pill, .status-pill {
  display: inline-flex;
  align-items: center;
  min-height: 18px;
  padding: 0 4px;
  font-family: var(--mono);
  font-size: 10px;
  font-weight: 600;
  border-radius: 2px;
}

.method-pill { color: var(--method-post); background: transparent; }
.method-pill.method-get { color: var(--method-get); background: transparent; }
.method-pill.method-put, .method-pill.method-patch { color: var(--method-put); background: transparent; }
.method-pill.method-delete { color: var(--method-delete); background: transparent; }

.status-pill { color: var(--muted); background: var(--panel-muted); }
.status-pill.status-success { color: var(--status-2xx); background: transparent; }
.status-pill.status-client-error { color: var(--status-4xx); background: transparent; }
.status-pill.status-server-error { color: var(--status-5xx); background: transparent; }
.status-pill.status-redirect { color: var(--status-3xx); background: transparent; }
.status-pill.status-failed { color: var(--danger); background: transparent; }

.inspector-actions { display: flex; flex: 0 0 auto; align-items: center; gap: 6px; }

.icon-button {
  display: inline-grid;
  width: 26px;
  height: 26px;
  padding: 0;
  place-items: center;
  color: var(--muted);
  border: 1px solid transparent;
  border-radius: 3px;
  cursor: pointer;
}

.icon-button:hover { color: var(--ink); border-color: transparent; background: var(--panel-hover); }

.curl-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 4px;
  height: 26px;
  padding: 0 9px;
  color: var(--accent);
  border: 1px solid transparent;
  border-radius: 3px;
  background: transparent;
  cursor: pointer;
}

.curl-button:hover { border-color: transparent; background: var(--panel-hover); }

.copy-menu { position: relative; flex: 0 0 auto; }
.copy-menu summary { list-style: none; }
.copy-menu summary::-webkit-details-marker { display: none; }

.copy-menu-popover {
  position: absolute;
  top: calc(100% + 3px);
  right: 0;
  z-index: 20;
  display: grid;
  min-width: 110px;
  padding: 4px 0;
  border: 1px solid var(--line-strong);
  border-radius: var(--radius-pop);
  background: var(--panel);
  box-shadow: var(--shadow);
}

.copy-menu-popover button {
  height: 24px;
  padding: 0 10px;
  color: var(--muted);
  font-size: 12px;
  font-family: var(--mono);
  text-align: left;
  border: 0;
  background: transparent;
  cursor: pointer;
}

.copy-menu-popover button:hover { color: var(--ink); background: var(--panel-hover); }

.detail-tabs {
  display: flex;
  align-items: stretch;
  gap: 0;
  padding: 0;
  border-bottom: 1px solid var(--line);
  background: var(--toolbar-tinted);
}

.detail-tabs button {
  position: relative;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 27px;
  padding: 0 10px;
  color: var(--muted);
  font-size: 12px;
  font-weight: 400;
  border: 0;
  cursor: pointer;
}

.detail-tabs button::after {
  position: absolute;
  right: 0;
  bottom: -1px;
  left: 0;
  height: 3px;
  content: "";
  opacity: 0;
  background: var(--accent);
  border-radius: 3px 3px 0 0;
}

.detail-tabs button:hover { color: var(--ink); background: var(--panel-hover); }
.detail-tabs button.active { color: var(--accent); font-weight: 500; }
.detail-tabs button.active::after { opacity: 1; }

.detail-tabs button span {
  display: inline-grid;
  min-width: 16px;
  height: 15px;
  padding: 0 3px;
  place-items: center;
  color: var(--accent);
  font-family: var(--mono);
  font-size: 9px;
  border: 1px solid var(--accent);
  border-radius: 8px;
  background: var(--panel);
}

.tab-hit {
  display: inline-block;
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.detail-content { min-height: 0; overflow: auto; }

@media (max-width: 620px) {
  .detail-tabs { overflow-x: auto; }
  .detail-tabs button { white-space: nowrap; }
}
</style>
