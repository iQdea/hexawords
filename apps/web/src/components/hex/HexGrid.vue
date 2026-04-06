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
  darkCombo: Array<{ hexQ: number; hexR: number; slot: number }>;
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


const DIRS = [
  { q: +1, r: 0 }, { q: +1, r: -1 }, { q: 0, r: -1 },
  { q: -1, r: 0 }, { q: -1, r: +1 }, { q: 0, r: +1 },
];

/**
 * Find the two full hexes that this edge hex's trapezoid connects.
 * Direct neighbor + the other full hex that the direct neighbor is adjacent to.
 */
function findTrapezoidParents(hex: HexagonDTO): [HexagonDTO, HexagonDTO] | null {
  // Find direct full neighbor
  let directParent: HexagonDTO | null = null;
  for (let dir = 0; dir < 6; dir++) {
    const nq = hex.q + DIRS[dir].q;
    const nr = hex.r + DIRS[dir].r;
    const found = props.hexagons.find(h => h.q === nq && h.r === nr && h.hexType === 'full');
    if (found) { directParent = found; break; }
  }
  if (!directParent) return null;

  // Find the other full hex (neighbor of directParent, not the edge hex)
  let otherParent: HexagonDTO | null = null;
  for (let dir = 0; dir < 6; dir++) {
    const nq = directParent.q + DIRS[dir].q;
    const nr = directParent.r + DIRS[dir].r;
    if (nq === hex.q && nr === hex.r) continue;
    const found = props.hexagons.find(h => h.q === nq && h.r === nr && h.hexType === 'full');
    if (found) { otherParent = found; break; }
  }
  if (!otherParent) return null;

  // Sort: X = upper (smaller y), Y = lower (larger y)
  const a = hexCenter(directParent).y <= hexCenter(otherParent).y ? directParent : otherParent;
  const b = a === directParent ? otherParent : directParent;
  return [a, b]; // [X=upper, Y=lower]
}

function isEdgeVariantA(hex: HexagonDTO): boolean {
  // Determine by slots: A has slots 6,1,2 (bottom half), B has slots 5,4,3 (top half)
  const slots = hex.cells.map(c => c.slot).sort((a, b) => a - b);
  return slots.includes(1) && slots.includes(2);
}

function edgeHexPoints(hex: HexagonDTO): string {
  const parents = findTrapezoidParents(hex);
  if (!parents) {
    const center = hexCenter(hex);
    const corners = hexCorners(center, size.value);
    return [corners[3], corners[4], corners[5], corners[0]].map(c => `${c.x},${c.y}`).join(' ');
  }

  const [hexX, hexY] = parents; // X=upper, Y=lower
  const cX = hexCorners(hexCenter(hexX), size.value);
  const cY = hexCorners(hexCenter(hexY), size.value);

  const s = size.value;
  if (isEdgeVariantA(hex)) {
    // Trap A (below): short top = cX[1]→cX[2], long bottom at cY[1].y
    // p4.x = cY[1].x + 2*size, p4.y = cY[1].y
    const p4 = { x: cY[1].x + 2 * s, y: cY[1].y };
    return [cX[1], cX[2], cY[1], p4].map(c => `${c.x},${c.y}`).join(' ');
  } else {
    // Trap B (above): short bottom = cY[4]→cY[5], long top at cX[4].y
    // p4.x = cX[4].x - 2*size, p4.y = cX[4].y
    const p4 = { x: cX[4].x - 2 * s, y: cX[4].y };
    return [cY[5], cY[4], p4, cX[4]].map(c => `${c.x},${c.y}`).join(' ');
  }
}

/**
 * Position and size for trapezoid PNG image, covering the trapezoid polygon.
 */
/**
 * Position trap PNG. Calibrated via pixel matching:
 * w = size * 2.3 * 1.445, h = w / 2.
 * Centered on hex's short edge midpoint.
 * Trap A (bottom half): top of image at hex center Y.
 * Trap B (top half): bottom of image at hex center Y.
 */
function trapImagePos(hex: HexagonDTO): { imgX: number; imgY: number; w: number; h: number } {
  const parents = findTrapezoidParents(hex);
  if (!parents) return { imgX: 0, imgY: 0, w: 0, h: 0 };
  const [hexX, hexY] = parents;
  const cX = hexCorners(hexCenter(hexX), size.value);
  const cY = hexCorners(hexCenter(hexY), size.value);
  const s = size.value;

  // PNG is already rotated 30°. Its width corresponds to the rotated hex bbox.
  // hexagon.png = 512x512, rendered at size*2.3. Canvas in gen = 512*1.366 = 699 → 740px PNG.
  // Scale: 740/512 = 1.445. So PNG width = size * 2.3 * 1.445 in hex-size units.
  // But hexagon.png in game is rendered at size*2.3 THEN rotated by SVG transform.
  // The trap PNG is pre-rotated, so it needs the rotated size directly.
  // Calibration: trap w/drawSize = 1.445, drawSize = hexRenderSize = size*2.3
  const w = s * 2.3 * 1.445;
  const h = w / 2;

  if (isEdgeVariantA(hex)) {
    const c = hexCenter(hexX);
    return { imgX: c.x - w / 2 + 2.2, imgY: c.y + 6.5, w, h };
  } else {
    const c = hexCenter(hexY);
    return { imgX: c.x - w / 2 - 2.2, imgY: c.y - h - 6.5, w, h };
  }
}

function trapBaseLine(hex: HexagonDTO): { x1: number; y1: number; x2: number; y2: number } {
  const parents = findTrapezoidParents(hex);
  if (!parents) return { x1: 0, y1: 0, x2: 0, y2: 0 };
  const [hexX, hexY] = parents;
  const cX = hexCorners(hexCenter(hexX), size.value);
  const cY = hexCorners(hexCenter(hexY), size.value);
  const s = size.value;

  if (isEdgeVariantA(hex)) {
    // Long bottom edge: cY[1] → p4(cY[1].x + 2s, cY[1].y)
    return { x1: cY[1].x, y1: cY[1].y, x2: cY[1].x + 2 * s, y2: cY[1].y };
  } else {
    // Long top edge: p4(cX[4].x - 2s, cX[4].y) → cX[4]
    return { x1: cX[4].x - 2 * s, y1: cX[4].y, x2: cX[4].x, y2: cX[4].y };
  }
}

function hexPoints(hex: HexagonDTO) {
  if (hex.hexType !== 'full') return edgeHexPoints(hex);
  const center = hexCenter(hex);
  return hexCorners(center, size.value).map(c => `${c.x},${c.y}`).join(' ');
}

function slotPosition(hex: HexagonDTO, slot: number) {
  if (hex.hexType !== 'full') {
    const parents = findTrapezoidParents(hex);
    if (parents) {
      const [hexX, hexY] = parents;
      const cX = hexCorners(hexCenter(hexX), size.value);
      const cY = hexCorners(hexCenter(hexY), size.value);
      const s = size.value;
      const ringRadius = s * 0.54;

      if (isEdgeVariantA(hex)) {
        // Trap A (below): slots 6,1,2. Slot 1 y = Y slots 3,5 y
        const trapCenterX = (cX[1].x + cX[2].x) / 2;
        const targetSlot1Y = hexCenter(hexY).y + ringRadius * Math.sin((Math.PI / 180) * (60 * 2 - 90));
        const trapCenterY = targetSlot1Y + ringRadius;
        const angle = (Math.PI / 180) * (60 * (slot - 1) - 90);
        return {
          cx: trapCenterX + ringRadius * Math.cos(angle),
          cy: trapCenterY + ringRadius * Math.sin(angle),
        };
      } else {
        // Trap B (above): slots 5,4,3. Slot 4 y = X slots 6,2 y
        const trapCenterX = (cY[4].x + cY[5].x) / 2;
        const targetSlot4Y = hexCenter(hexX).y + ringRadius * Math.sin((Math.PI / 180) * (60 * 5 - 90));
        const trapCenterY = targetSlot4Y - ringRadius;
        const angle = (Math.PI / 180) * (60 * (slot - 1) - 90);
        return {
          cx: trapCenterX + ringRadius * Math.cos(angle),
          cy: trapCenterY + ringRadius * Math.sin(angle),
        };
      }
    }
  }

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
      <filter id="trap-shadow" x="-20%" y="-20%" width="150%" height="150%">
        <feGaussianBlur in="SourceAlpha" stdDeviation="6" result="blur" />
        <feOffset dx="4" dy="5" result="offsetBlur" />
        <feFlood flood-color="rgba(0,0,0,0.22)" result="color" />
        <feComposite in="color" in2="offsetBlur" operator="in" result="shadow" />
        <feMerge>
          <feMergeNode in="shadow" />
          <feMergeNode in="SourceGraphic" />
        </feMerge>
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
        :fill="hex.hexType === 'full' ? 'rgba(255, 255, 255, 0.35)' : 'rgba(200, 210, 230, 0.4)'"
        stroke="none"
        filter="url(#hex-blur)"
      />
      <image
        v-if="hex.hexType === 'full'"
        :href="'/img/hexagon.png'"
        :x="hexCenter(hex).x - size * 1.15"
        :y="hexCenter(hex).y - size * 1.15"
        :width="size * 2.3"
        :height="size * 2.3"
        opacity="1"
        :transform="`rotate(30 ${hexCenter(hex).x} ${hexCenter(hex).y})`"
        class="hex-bg"
      />
      <template v-else>
        <defs>
          <clipPath :id="`trap-clip-${hex.q}-${hex.r}`">
            <polygon :points="hexPoints(hex)" />
          </clipPath>
        </defs>
        <!-- Shadow line -->
        <line
          :x1="trapBaseLine(hex).x1 + 3" :y1="trapBaseLine(hex).y1 + 4"
          :x2="trapBaseLine(hex).x2 + 3" :y2="trapBaseLine(hex).y2 + 4"
          stroke="rgba(0,0,0,0.15)"
          :stroke-width="5"
          stroke-linecap="round"
        />
        <!-- Border line -->
        <line
          :x1="trapBaseLine(hex).x1" :y1="trapBaseLine(hex).y1"
          :x2="trapBaseLine(hex).x2" :y2="trapBaseLine(hex).y2"
          stroke="rgba(110,115,125,0.5)"
          :stroke-width="2"
          stroke-linecap="round"
        />
        <image
          :href="isEdgeVariantA(hex) ? '/img/trapezoid-b.png' : '/img/trapezoid-a.png'"
          :x="trapImagePos(hex).imgX"
          :y="trapImagePos(hex).imgY"
          :width="trapImagePos(hex).w"
          :height="trapImagePos(hex).h"
          opacity="0.85"
          class="hex-bg"
        />
      </template>
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
        :lock-type="cell.lockType ?? null"
        :variant="cell.variant ?? null"
        :dark-smoke="darkCombo.some(c => c.hexQ === hex.q && c.hexR === hex.r && c.slot === cell.slot)"
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
