/**
 * Audyt geometrii Czyżyńskiego — stopy świateł + GAP (bez flipY).
 * npx --yes tsx scripts/auditLayout.ts
 */
import { AUTORSKIE } from "../src/sim/layouts/autorskieRondo";

const L = AUTORSKIE;
const errs: string[] = [];

const GAP = 36;
const HEAD = 74;
const CX = 500;
const CY = 375;
const RING = 215;
const HW = 90;
const STOP = 52;
const ZEBRA = 28;
const TRAM_X = 40;
const TRAM_Y = 52;
/** Asfalt: krzyż ∪ koło (flare tylko przy pierścieniu — sygnały i tak poza). */
function onArmAsphalt(x: number, y: number, margin = 0): boolean {
  const { cx, cy, ringOuter, islandR } = L;
  const d = Math.hypot(x - cx, y - cy);
  if (d < islandR + margin) return false;
  const hw = HW - margin;
  if (x >= cx - hw && x <= cx + hw) return true;
  if (y >= cy - hw && y <= cy + hw) return true;
  if (d <= ringOuter - margin) return true;
  return false;
}

function onIslandGreen(x: number, y: number): boolean {
  const d = Math.hypot(x - L.cx, y - L.cy);
  if (d > L.islandR - 8) return false;
  const nearWe = Math.abs(y - L.cy) < 22;
  const nearNs = Math.abs(x - L.cx) < 22;
  return !(nearWe || nearNs);
}

function footprintOnRoad(x: number, y: number, kind: string): boolean {
  const halfW = kind === "tram" ? 18 : 12;
  const top = 74;
  const bottom = 8;
  const pts = [
    [x - halfW, y - top],
    [x + halfW, y - top],
    [x - halfW, y + bottom],
    [x + halfW, y + bottom],
    [x, y],
  ];
  return pts.some(([px, py]) => onArmAsphalt(px, py, 0));
}

console.log("=== Sygnały (wyliczone) ===");
for (const s of L.signals) {
  const hit = footprintOnRoad(s.x, s.y, s.kind);
  if (s.kind === "tram") {
    if (onIslandGreen(s.x, s.y) && !hit) console.log(`OK tram island: ${s.id} @ ${s.x},${s.y}`);
    else errs.push(`${s.id} tram nie na wyspie / na jezdni @ ${s.x},${s.y}`);
  } else if (hit) {
    errs.push(`${s.id} (${s.kind}) FOOTPRINT NA JEZDNI @ ${s.x},${s.y}`);
  } else {
    console.log(`OK off-road: ${s.id} @ ${s.x},${s.y}`);
  }
}

for (const arm of L.arms) {
  const stop = L.stops.find((s) => s.dir === arm.dir)!;
  const zeb = L.zebras.find((z) => z.dir === arm.dir)!;
  if (!(stop.out > zeb.out)) errs.push(`${arm.dir}: stop <= zebra`);
  else console.log(`OK ${arm.dir}: stop ${stop.out} > zebra ${zeb.out}`);
}

const southClear = (edge: number) => edge + GAP + HEAD;
const northClear = (edge: number) => edge - GAP;
const expect: Record<string, { x: number; y: number }> = {
  sigN: { x: CX - HW - GAP, y: CY - RING - STOP },
  sigS: { x: CX + HW + GAP, y: CY + RING + STOP },
  sigW: { x: CX - RING - STOP, y: southClear(CY + HW) },
  sigE: { x: CX + RING + STOP, y: northClear(CY - HW) },
  pedN: { x: CX + HW + GAP, y: northClear(CY - RING - ZEBRA) },
  pedS: { x: CX - HW - GAP, y: southClear(CY + RING + ZEBRA) },
  pedW: { x: CX - RING - ZEBRA - GAP, y: northClear(CY - HW) },
  pedE: { x: CX + RING + ZEBRA + GAP, y: southClear(CY + HW) },
  tramWE: { x: CX - TRAM_X, y: CY + TRAM_Y },
  tramNS: { x: CX + TRAM_X, y: CY + TRAM_Y },
};
for (const [id, p] of Object.entries(expect)) {
  const s = L.signals.find((x) => x.id === id)!;
  if (s.x !== p.x || s.y !== p.y) {
    errs.push(`${id}: jest ${s.x},${s.y} want ${p.x},${p.y}`);
  } else {
    console.log(`OK formula ${id}: ${p.x},${p.y}`);
  }
}

console.log("---");
if (errs.length) {
  console.error("FAIL", errs);
  process.exit(1);
}
console.log("LAYOUT AUDIT PASS");
