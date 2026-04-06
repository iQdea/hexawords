<script setup lang="ts">
import { computed, ref, watch } from 'vue';
import { RUSSIAN_VOWELS } from '@hexawords/game-engine';

const props = defineProps<{
  cx: number;
  cy: number;
  radius: number;
  char: string;
  points: number;
  isActive: boolean;
  lockType: 'gray' | 'blue' | 'purple' | 'orange' | null;
  isSelected: boolean;
  selectionIndex: number;
  variant: 'light' | 'dark' | null;
  darkSmoke: boolean;
}>();

const emit = defineEmits<{ click: [] }>();

const unlocking = ref(false);
const showSparkle = ref(false);
const sparkleColor = ref('#FFD700');

watch(() => props.lockType, (newVal, oldVal) => {
  if (oldVal && !newVal) {
    sparkleColor.value = LOCK_COLORS[oldVal] ?? '#FFD700';
    unlocking.value = true;
    setTimeout(() => {
      showSparkle.value = true;
    }, 600);
    setTimeout(() => {
      unlocking.value = false;
      showSparkle.value = false;
    }, 1600);
  }
});

const showSmoke = ref(false);

watch(() => props.darkSmoke, (val) => {
  if (val) {
    showSmoke.value = true;
    setTimeout(() => { showSmoke.value = false; }, 1200);
  }
});

const isVowel = computed(() => RUSSIAN_VOWELS.has(props.char));
const isDark = computed(() => props.variant === 'dark');

const LOCK_COLORS: Record<string, string> = {
  gray: '#9e9e9e',
  blue: '#1e88e5',
  purple: '#8e24aa',
  orange: '#fb8c00',
};

const lockColor = computed(() => props.lockType ? LOCK_COLORS[props.lockType] ?? '#9e9e9e' : '#9e9e9e');

const tintColor = computed(() => {
  if (!props.isActive) return 'rgba(150, 150, 150, 0.5)';
  if (props.lockType) {
    // Dimmed version of normal cell color — not lock color
    if (isDark.value) return 'rgba(50, 50, 70, 0.7)';
    return 'rgba(180, 185, 195, 0.55)';
  }
  if (props.isSelected) {
    return isVowel.value
      ? 'rgba(229, 57, 53, 0.6)'
      : 'rgba(67, 160, 71, 0.55)';
  }
  if (isDark.value) return 'rgba(60, 70, 90, 0.65)';
  return 'rgba(200, 210, 220, 0.45)';
});

const letterColor = computed(() => {
  if (!props.isActive) return '#aaa';
  if (props.lockType) return 'rgba(255,255,255,0.3)';
  if (props.isSelected) return '#fff';
  if (isDark.value) return isVowel.value ? '#ff8a80' : '#a5d6a7';
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
      :opacity="isActive ? 1 : 0"
      class="cell-sphere"
    />
    <!-- Color overlay -->
    <circle
      :cx="cx" :cy="cy" :r="radius * 0.92"
      :fill="tintColor"
      :opacity="isActive ? 1 : 0"
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
      :opacity="isActive ? 1 : 0"
      class="no-pointer"
      :style="isSelected ? 'text-shadow: 0 1px 3px rgba(0,0,0,0.4)' : ''"
    >{{ char.toUpperCase() }}</text>
    <!-- Lock badge with color -->
    <g v-if="(lockType || unlocking) && isActive"
       :class="{ 'lock-shake': unlocking, 'lock-open': unlocking }"
       :style="{ transformOrigin: cx + 'px ' + cy + 'px' }"
    >
      <!-- Shackle (петля) -->
      <path
        :d="`M ${cx - radius * 0.15} ${cy - radius * 0.15}
             A ${radius * 0.15} ${radius * 0.18} 0 1 1 ${cx + radius * 0.15} ${cy - radius * 0.15}`"
        fill="none"
        stroke="#fff"
        :stroke-width="radius * 0.07"
        stroke-linecap="round"
        opacity="0.9"
      />
      <!-- Lock body -->
      <rect
        :x="cx - radius * 0.22"
        :y="cy - radius * 0.15"
        :width="radius * 0.44"
        :height="radius * 0.35"
        :rx="radius * 0.06"
        :fill="lockColor"
        opacity="0.9"
      />
      <!-- Keyhole -->
      <circle
        :cx="cx" :cy="cy + radius * 0.01"
        :r="radius * 0.06"
        fill="#fff"
        opacity="0.9"
      />
    </g>
    <!-- Sparkle particles on unlock -->
    <g v-if="showSparkle" class="sparkle-group">
      <circle v-for="i in 6" :key="i"
        :cx="cx + Math.cos(i * Math.PI / 3) * radius * 0.6"
        :cy="cy + Math.sin(i * Math.PI / 3) * radius * 0.6"
        :r="radius * 0.08"
        :fill="sparkleColor"
        class="sparkle"
        :style="{ animationDelay: (i * 0.05) + 's', transformOrigin: (cx + Math.cos(i * Math.PI / 3) * radius * 0.6) + 'px ' + (cy + Math.sin(i * Math.PI / 3) * radius * 0.6) + 'px' }"
      />
    </g>
    <!-- Dark smoke cloud on dark combo -->
    <g v-if="showSmoke">
      <circle v-for="i in 8" :key="'smoke-'+i"
        :cx="cx"
        :cy="cy"
        :r="radius * 0.15"
        fill="rgba(20,20,30,0.6)"
        class="smoke-particle"
        :style="{
          animationDelay: (i * 0.06) + 's',
          '--dx': Math.cos(i * Math.PI / 4) * radius * 1.2 + 'px',
          '--dy': (Math.sin(i * Math.PI / 4) * radius * 0.8 - radius * 0.5) + 'px',
          transformOrigin: cx + 'px ' + cy + 'px',
        }"
      />
    </g>
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
.cell-sphere,
.cell-tint {
  transition: opacity 0.35s ease;
}
.cell-tint {
  transition: opacity 0.35s ease, fill 0.15s;
}
.letter-cell text {
  transition: opacity 0.35s ease;
}
.letter-cell:hover .cell-tint {
  filter: brightness(1.2);
}
.no-pointer {
  pointer-events: none;
  user-select: none;
}

/* Lock shake animation */
.lock-shake {
  animation: shake 0.6s ease-in-out;
}

.lock-icon {
  transition: opacity 0.5s ease;
}

.lock-open {
  animation: lock-pop 1s ease forwards;
}

/* Sparkle particles */
.sparkle {
  animation: sparkle-fly 0.8s ease-out forwards;
  opacity: 0;
}

@keyframes shake {
  0%, 100% { transform: translateX(0); }
  10% { transform: translateX(-3px) rotate(-8deg); }
  20% { transform: translateX(3px) rotate(8deg); }
  30% { transform: translateX(-3px) rotate(-6deg); }
  40% { transform: translateX(3px) rotate(6deg); }
  50% { transform: translateX(-2px) rotate(-4deg); }
  60% { transform: translateX(2px) rotate(4deg); }
  70% { transform: translateX(-1px) rotate(-2deg); }
  80% { transform: translateX(1px) rotate(2deg); }
}

@keyframes lock-pop {
  0% { opacity: 1; transform: scale(1); }
  30% { opacity: 1; transform: scale(1.4); }
  60% { opacity: 0.8; transform: scale(1.2) translateY(-5px); }
  100% { opacity: 0; transform: scale(0.3) translateY(-15px); }
}

/* Dark smoke cloud */
.smoke-particle {
  animation: smoke-rise 1.2s ease-out forwards;
  opacity: 0;
}

@keyframes smoke-rise {
  0% { opacity: 0.7; r: 3; transform: translate(0, 0) scale(1); }
  40% { opacity: 0.5; r: 8; }
  100% { opacity: 0; r: 12; transform: translate(var(--dx), var(--dy)) scale(2.5); }
}

@keyframes sparkle-fly {
  0% { opacity: 1; r: 1; }
  30% { opacity: 1; r: 3; }
  100% { opacity: 0; r: 0; transform: scale(3); }
}
</style>
