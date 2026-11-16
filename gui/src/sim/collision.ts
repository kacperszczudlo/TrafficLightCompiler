export interface AABB {
  x: number;
  y: number;
  w: number;
  h: number;
}

export function aabbFromCenter(
  cx: number,
  cy: number,
  w: number,
  h: number,
  angle: number,
): AABB {
  // Axis-aligned bounds of rotated rect (conservative)
  const c = Math.abs(Math.cos(angle));
  const s = Math.abs(Math.sin(angle));
  const bw = w * c + h * s;
  const bh = w * s + h * c;
  return { x: cx - bw * 0.5, y: cy - bh * 0.5, w: bw, h: bh };
}

export function aabbOverlap(a: AABB, b: AABB): boolean {
  return (
    a.x < b.x + b.w &&
    a.x + a.w > b.x &&
    a.y < b.y + b.h &&
    a.y + a.h > b.y
  );
}
