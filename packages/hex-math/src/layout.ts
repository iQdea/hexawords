import type { AxialCoord } from '@hexawords/types';

export interface Point {
  x: number;
  y: number;
}

/** Converts axial hex coordinate to pixel position (flat-top orientation). */
export function axialToPixel(coord: AxialCoord, size: number): Point {
  const x = size * (3 / 2) * coord.q;
  const y = size * (Math.sqrt(3) / 2 * coord.q + Math.sqrt(3) * coord.r);
  return { x, y };
}

/** Returns the 6 corner points of a flat-top hexagon. */
export function hexCorners(center: Point, size: number): Point[] {
  const corners: Point[] = [];
  for (let i = 0; i < 6; i++) {
    const angleDeg = 60 * i;
    const angleRad = (Math.PI / 180) * angleDeg;
    corners.push({
      x: center.x + size * Math.cos(angleRad),
      y: center.y + size * Math.sin(angleRad),
    });
  }
  return corners;
}

/** Computes the bounding box of a set of hexagons on the pixel grid. */
export function gridBounds(coords: AxialCoord[], size: number) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  for (const coord of coords) {
    const center = axialToPixel(coord, size);
    for (const corner of hexCorners(center, size)) {
      if (corner.x < minX) minX = corner.x;
      if (corner.y < minY) minY = corner.y;
      if (corner.x > maxX) maxX = corner.x;
      if (corner.y > maxY) maxY = corner.y;
    }
  }

  return { minX, minY, maxX, maxY };
}
