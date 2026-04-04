<script setup lang="ts">
import { computed } from 'vue';
import { RUSSIAN_VOWELS } from '@hexawords/game-engine';

const props = defineProps<{
  cx: number;
  cy: number;
  radius: number;
  char: string;
  points: number;
  isActive: boolean;
  isSelected: boolean;
  selectionIndex: number;
}>();

const emit = defineEmits<{ click: [] }>();

const isVowel = computed(() => RUSSIAN_VOWELS.has(props.char));

const tintColor = computed(() => {
  if (!props.isActive) return 'rgba(150, 150, 150, 0.5)';
  if (props.isSelected) {
    return isVowel.value
      ? 'rgba(229, 57, 53, 0.6)'
      : 'rgba(67, 160, 71, 0.55)';
  }
  return 'rgba(200, 210, 220, 0.45)';
});

const letterColor = computed(() => {
  if (!props.isActive) return '#aaa';
  if (props.isSelected) return '#fff';
  return isVowel.value ? '#d32f2f' : '#2e7d32';
});
</script>

<template>
  <g class="letter-cell" @click="emit('click')" style="cursor: pointer">
    <!-- Sphere background image -->
    <image
      href="/img/sphere.png"
      :x="cx - radius"
      :y="cy - radius"
      :width="radius * 2"
      :height="radius * 2"
      :opacity="isActive ? 1 : 0.4"
      class="cell-sphere"
    />
    <!-- Color overlay -->
    <circle
      :cx="cx" :cy="cy" :r="radius * 0.92"
      :fill="tintColor"
      class="cell-tint"
    />
    <!-- Selection ring -->
    <circle
      v-if="isSelected"
      :cx="cx" :cy="cy" :r="radius * 0.95"
      fill="none"
      stroke="#fff"
      :stroke-width="radius * 0.12"
      opacity="0.8"
    />
    <!-- Selection badge -->
    <circle
      v-if="isSelected"
      :cx="cx + radius * 0.6"
      :cy="cy - radius * 0.6"
      :r="radius * 0.3"
      fill="#fff"
      stroke="#1565c0"
      :stroke-width="radius * 0.06"
    />
    <text
      v-if="isSelected"
      :x="cx + radius * 0.6"
      :y="cy - radius * 0.6"
      text-anchor="middle"
      dominant-baseline="central"
      :font-size="radius * 0.35"
      fill="#1565c0"
      font-weight="bold"
      class="no-pointer"
    >{{ selectionIndex + 1 }}</text>
    <!-- Letter -->
    <text
      :x="cx" :y="cy - radius * 0.02"
      text-anchor="middle"
      dominant-baseline="central"
      :font-size="radius * 0.85"
      :fill="letterColor"
      font-weight="bold"
      :opacity="isActive ? 1 : 0.3"
      class="no-pointer"
      :style="isSelected ? 'text-shadow: 0 1px 3px rgba(0,0,0,0.4)' : ''"
    >{{ char.toUpperCase() }}</text>
    <!-- Points -->
    <text
      :x="cx" :y="cy + radius * 0.55"
      text-anchor="middle"
      dominant-baseline="central"
      :font-size="radius * 0.3"
      fill="rgba(255,255,255,0.5)"
      class="no-pointer"
    >{{ points }}</text>
    <!-- Invisible hit area covering the entire cell -->
    <circle
      :cx="cx" :cy="cy" :r="radius"
      fill="transparent"
      class="hit-area"
    />
  </g>
</template>

<style scoped>
.cell-tint {
  transition: fill 0.15s;
}
.letter-cell:hover .cell-tint {
  filter: brightness(1.2);
}
.no-pointer {
  pointer-events: none;
  user-select: none;
}
</style>
