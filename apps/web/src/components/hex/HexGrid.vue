<script setup lang="ts">
import { computed } from 'vue';
import { axialToPixel, hexCorners, gridBounds } from '@hexawords/hex-math';
import type { HexagonDTO, WordPathStep } from '@hexawords/types';
import HexCell from './HexCell.vue';

const props = defineProps<{
  hexagons: HexagonDTO[];
  selectedPath: WordPathStep[];
  usedHexKeys: Set<string>;
  selectedCellKeys: Set<string>;
  hexSize?: number;
}>();

const emit = defineEmits<{
  (e: 'cellClick', hexQ: number, hexR: number, slot: number): void;
}>();

const size = computed(() => props.hexSize ?? 110);
const cellRadius = computed(() => size.value * 0.19);

const coords = computed(() => props.hexagons.map(h => ({ q: h.q, r: h.r })));

const bounds = computed(() => {
  if (coords.value.length === 0) return { minX: 0, minY: 0, maxX: 100, maxY: 100 };
  return gridBounds(coords.value, size.value);
});

const padding = computed(() => size.value * 0.6);

const viewBox = computed(() => {
  const b = bounds.value;
  const p = padding.value;
  return `${b.minX - p} ${b.minY - p} ${b.maxX - b.minX + p * 2} ${b.maxY - b.minY + p * 2}`;
});

function hexCenter(hex: HexagonDTO) {
  return axialToPixel(hex, size.value);
}

function hexPoints(hex: HexagonDTO) {
  const center = hexCenter(hex);
  return hexCorners(center, size.value).map(c => `${c.x},${c.y}`).join(' ');
}

/**
 * Position 7 letter circles inside a hexagon:
 * - slot 0: center
 * - slots 1-6: ring around center at 60° intervals
 */
function slotPosition(hex: HexagonDTO, slot: number) {
  const center = hexCenter(hex);
  if (slot === 0) return { cx: center.x, cy: center.y };

  const ringRadius = size.value * 0.54;
  const angle = (Math.PI / 180) * (60 * (slot - 1) - 90);
  return {
    cx: center.x + ringRadius * Math.cos(angle),
    cy: center.y + ringRadius * Math.sin(angle),
  };
}

function isHexHighlighted(hex: HexagonDTO): boolean {
  // Highlight hexagons adjacent to the last selected (valid next moves)
  if (props.selectedPath.length === 0) return false;
  const last = props.selectedPath[props.selectedPath.length - 1]!;
  if (hex.q === last.hexQ && hex.r === last.hexR) return false;
  if (props.usedHexKeys.has(`${hex.q},${hex.r}`)) return false;
  const dq = hex.q - last.hexQ;
  const dr = hex.r - last.hexR;
  const ds = -(dq + dr);
  return Math.abs(dq) + Math.abs(dr) + Math.abs(ds) === 2;
}

const LINE_COLORS = ['#e91e63', '#ff9800', '#4caf50', '#2196f3', '#9c27b0', '#00bcd4', '#ff5722', '#8bc34a', '#673ab7', '#009688'];

// Connection lines between selected CELLS (not hex centers)
const connectionLines = computed(() => {
  const lines: Array<{ x1: number; y1: number; x2: number; y2: number; color: string }> = [];
  for (let i = 1; i < props.selectedPath.length; i++) {
    const prev = props.selectedPath[i - 1]!;
    const curr = props.selectedPath[i]!;
    const prevHex = props.hexagons.find(h => h.q === prev.hexQ && h.r === prev.hexR);
    const currHex = props.hexagons.find(h => h.q === curr.hexQ && h.r === curr.hexR);
    if (!prevHex || !currHex) continue;
    const from = slotPosition(prevHex, prev.slot);
    const to = slotPosition(currHex, curr.slot);
    lines.push({ x1: from.cx, y1: from.cy, x2: to.cx, y2: to.cy, color: LINE_COLORS[i % LINE_COLORS.length]! });
  }
  return lines;
});

function selectionIndex(hexQ: number, hexR: number, slot: number): number {
  return props.selectedPath.findIndex(
    s => s.hexQ === hexQ && s.hexR === hexR && s.slot === slot
  );
}
</script>

<template>
  <svg :viewBox="viewBox" preserveAspectRatio="xMidYMid meet" class="hex-grid" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">
    <defs>
      <filter id="hex-blur" x="-10%" y="-10%" width="120%" height="120%">
        <feGaussianBlur in="SourceGraphic" stdDeviation="8" />
      </filter>
    </defs>
    <!-- Connection lines -->
    <line
      v-for="(line, i) in connectionLines"
      :key="'line-' + i"
      :x1="line.x1" :y1="line.y1"
      :x2="line.x2" :y2="line.y2"
      :stroke="line.color"
      :stroke-width="size * 0.04"
      opacity="0.7"
      stroke-linecap="round"
    />

    <!-- Layer 1: Hexagon backgrounds -->
    <g v-for="hex in hexagons" :key="`bg-${hex.q}-${hex.r}`">
      <polygon
        :points="hexPoints(hex)"
        fill="rgba(255, 255, 255, 0.35)"
        stroke="none"
        filter="url(#hex-blur)"
      />
      <image
        :href="'/img/hexagon.png'"
        :x="hexCenter(hex).x - size * 1.15"
        :y="hexCenter(hex).y - size * 1.15"
        :width="size * 2.3"
        :height="size * 2.3"
        opacity="1"
        :transform="`rotate(30 ${hexCenter(hex).x} ${hexCenter(hex).y})`"
        class="hex-bg"
      />
      <polygon
        v-if="isHexHighlighted(hex)"
        :points="hexPoints(hex)"
        fill="none"
        stroke="rgba(255, 215, 0, 0.7)"
        :stroke-width="size * 0.04"
        class="hex-highlight"
      />
    </g>

    <!-- Layer 2: All letter cells on top (so no hexagon bg overlaps them) -->
    <g v-for="hex in hexagons" :key="`cells-${hex.q}-${hex.r}`">
      <HexCell
        v-for="cell in hex.cells"
        :key="cell.id"
        v-bind="slotPosition(hex, cell.slot)"
        :radius="cellRadius"
        :char="cell.char"
        :points="cell.points"
        :is-active="cell.isActive"
        :is-selected="selectedCellKeys.has(`${hex.q},${hex.r},${cell.slot}`)"
        :selection-index="selectionIndex(hex.q, hex.r, cell.slot)"
        @click="emit('cellClick', hex.q, hex.r, cell.slot)"
      />
    </g>
  </svg>
</template>

<style scoped>
.hex-grid {
  display: block;
  touch-action: manipulation;
  width: 55vw;
  height: 70vh;
}
.hex-outline {
  transition: stroke 0.15s, stroke-width 0.15s;
}
</style>
