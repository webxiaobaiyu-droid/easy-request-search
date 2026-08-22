<script setup lang="ts">
import { computed } from 'vue'
import { splitHighlightSegments } from '../utils/batch'

const props = defineProps<{
  text: string
  keywords?: string[]
}>()

const segments = computed(() => splitHighlightSegments(props.text, props.keywords ?? []))
</script>

<template>
  <template v-for="(segment, index) in segments" :key="index">
    <mark
      v-if="segment.keywordIndex !== null"
      class="keyword-hit"
      :class="`keyword-${segment.keywordIndex % 8}`"
    >{{ segment.text }}</mark>
    <template v-else>{{ segment.text }}</template>
  </template>
</template>

<style scoped>
.keyword-hit {
  color: var(--hit-color, var(--ink));
  background: color-mix(in srgb, var(--hit-color, var(--ink)) 14%, transparent);
  font-weight: 600;
  border-radius: 2px;
}

.keyword-0 { --hit-color: var(--batch-0); }
.keyword-1 { --hit-color: var(--batch-1); }
.keyword-2 { --hit-color: var(--batch-2); }
.keyword-3 { --hit-color: var(--batch-3); }
.keyword-4 { --hit-color: var(--batch-4); }
.keyword-5 { --hit-color: var(--batch-5); }
.keyword-6 { --hit-color: var(--batch-6); }
.keyword-7 { --hit-color: var(--batch-7); }
</style>
