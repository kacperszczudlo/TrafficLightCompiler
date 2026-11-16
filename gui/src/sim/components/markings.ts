import Konva from "konva";
import type {
  ArmSpec,
  Cardinal,
  RoundaboutLayout,
  StopSpec,
  ZebraSpec,
} from "../layouts/types";

const WHITE = "#e2e8f0";
const ASPHALT = "#222735";

function armAxis(dir: Cardinal, layout: RoundaboutLayout, dist: number) {
  const { cx, cy } = layout;
  switch (dir) {
    case "north":
      return { x: cx, y: cy - dist };
    case "south":
      return { x: cx, y: cy + dist };
    case "west":
      return { x: cx - dist, y: cy };
    case "east":
      return { x: cx + dist, y: cy };
  }
}

/** Solid stop on inbound RHT half only. */
export function buildStopLine(
  layout: RoundaboutLayout,
  stop: StopSpec,
  arm: ArmSpec,
): Konva.Line {
  const { cx, cy, ringOuter } = layout;
  const d = ringOuter + stop.out;
  const m = arm.medianHalf;
  const half = arm.halfWidth;
  let points: number[];
  switch (stop.dir) {
    case "north":
      points = [cx - half + 2, cy - d, cx - m - 1, cy - d];
      break;
    case "south":
      points = [cx + m + 1, cy + d, cx + half - 2, cy + d];
      break;
    case "west":
      points = [cx - d, cy + m + 1, cx - d, cy + half - 2];
      break;
    case "east":
      points = [cx + d, cy - half + 2, cx + d, cy - m - 1];
      break;
  }
  return new Konva.Line({
    points,
    stroke: WHITE,
    strokeWidth: 6,
    lineCap: "butt",
    listening: false,
    name: `stop-${stop.dir}`,
  });
}

export function buildYieldLine(
  layout: RoundaboutLayout,
  stop: StopSpec,
  arm: ArmSpec,
): Konva.Line {
  const { cx, cy, ringOuter } = layout;
  const d = ringOuter + stop.yieldOut;
  const m = arm.medianHalf;
  const half = arm.halfWidth;
  let points: number[];
  switch (stop.dir) {
    case "north":
      points = [cx - half + 2, cy - d, cx - m - 1, cy - d];
      break;
    case "south":
      points = [cx + m + 1, cy + d, cx + half - 2, cy + d];
      break;
    case "west":
      points = [cx - d, cy + m + 1, cx - d, cy + half - 2];
      break;
    case "east":
      points = [cx + d, cy - half + 2, cx + d, cy - m - 1];
      break;
  }
  return new Konva.Line({
    points,
    stroke: WHITE,
    strokeWidth: 5,
    dash: [12, 9],
    listening: false,
    name: `yield-${stop.dir}`,
  });
}

export function buildZebra(
  layout: RoundaboutLayout,
  z: ZebraSpec,
  arm: ArmSpec,
): Konva.Group {
  const g = new Konva.Group({ listening: false, name: `zebra-${z.dir}` });
  const { cx, cy, ringOuter } = layout;
  const dist = ringOuter + z.out;
  const half = Math.min(arm.halfWidth - 2, 70);
  const stripe = 11;
  const gap = 7;
  const h = z.height;

  if (z.dir === "north" || z.dir === "south") {
    const y0 = (z.dir === "north" ? cy - dist : cy + dist) - h / 2;
    const x0 = cx - half;
    for (let x = x0; x < cx + half - 4; x += stripe + gap) {
      g.add(
        new Konva.Rect({
          x,
          y: y0,
          width: stripe,
          height: h,
          fill: WHITE,
        }),
      );
    }
  } else {
    const x0 = (z.dir === "west" ? cx - dist : cx + dist) - h / 2;
    const y0 = cy - half;
    for (let y = y0; y < cy + half - 4; y += stripe + gap) {
      g.add(
        new Konva.Rect({
          x: x0,
          y,
          width: h,
          height: stripe,
          fill: WHITE,
        }),
      );
    }
  }
  return g;
}

export function buildLaneArrow(
  x: number,
  y: number,
  angle: number,
  kind: ArmSpec["lanes"][0]["arrow"],
): Konva.Group {
  // Lokalnie +X = kierunek jazdy; −Y = lewo (Y w dół na canvasie)
  const g = new Konva.Group({
    x,
    y,
    rotation: (angle * 180) / Math.PI,
    listening: false,
  });
  const shaftOnly = kind === "straight" || kind === "left" || kind === "right";
  if (shaftOnly || kind === "straightLeft" || kind === "straightRight") {
    g.add(
      new Konva.Line({
        points: [-14, 0, 8, 0],
        stroke: WHITE,
        strokeWidth: 3.5,
        lineCap: "round",
      }),
    );
    g.add(
      new Konva.Line({
        points: [2, -6, 14, 0, 2, 6],
        fill: WHITE,
        closed: true,
        strokeEnabled: false,
      }),
    );
  }
  if (kind === "left" || kind === "straightLeft") {
    g.add(
      new Konva.Line({
        points: [-2, 0, -2, -12],
        stroke: WHITE,
        strokeWidth: 3.5,
        lineCap: "round",
      }),
    );
    g.add(
      new Konva.Line({
        points: [-8, -6, -2, -14, 4, -6],
        fill: WHITE,
        closed: true,
        strokeEnabled: false,
      }),
    );
  }
  if (kind === "right" || kind === "straightRight") {
    g.add(
      new Konva.Line({
        points: [-2, 0, -2, 12],
        stroke: WHITE,
        strokeWidth: 3.5,
        lineCap: "round",
      }),
    );
    g.add(
      new Konva.Line({
        points: [-8, 6, -2, 14, 4, 6],
        fill: WHITE,
        closed: true,
        strokeEnabled: false,
      }),
    );
  }
  return g;
}

export function buildArmLaneDashes(
  layout: RoundaboutLayout,
  arm: ArmSpec,
): Konva.Group {
  const g = new Konva.Group({ listening: false });
  const { cx, cy, ringOuter } = layout;
  // Linie pasów przez CAŁĄ długość wlotu (od krawędzi canvasu do pierścienia)
  const inner = ringOuter + 2;
  const sepOffsets = new Set<number>();
  const ins = arm.lanes
    .filter((l) => l.kind === "in")
    .map((l) => l.offset)
    .sort((a, b) => a - b);
  const outs = arm.lanes
    .filter((l) => l.kind === "out")
    .map((l) => l.offset)
    .sort((a, b) => a - b);
  for (let i = 1; i < ins.length; i++)
    sepOffsets.add((ins[i - 1] + ins[i]) / 2);
  for (let i = 1; i < outs.length; i++)
    sepOffsets.add((outs[i - 1] + outs[i]) / 2);

  // Bleed poza layout — pasy ciągłe do krawędzi panelu (jak asfalt)
  const EDGE = 800;
  sepOffsets.forEach((o) => {
    let points: number[];
    switch (arm.dir) {
      case "north":
        points = [cx + o, -EDGE, cx + o, cy - inner];
        break;
      case "south":
        points = [cx + o, cy + inner, cx + o, layout.height + EDGE];
        break;
      case "west":
        points = [-EDGE, cy + o, cx - inner, cy + o];
        break;
      case "east":
        points = [cx + inner, cy + o, layout.width + EDGE, cy + o];
        break;
    }
    g.add(
      new Konva.Line({
        points,
        stroke: WHITE,
        strokeWidth: 1.6,
        dash: [14, 10],
        listening: false,
      }),
    );
  });
  return g;
}

export function placeArmArrows(
  layout: RoundaboutLayout,
  arm: ArmSpec,
): Konva.Group {
  const g = new Konva.Group({ listening: false });
  const stopOut = 52;
  // Dalej od stopu / zebry, żeby strzałki nie nachodziły na oznakowanie
  const arrDist = layout.ringOuter + stopOut + 36;
  const travelAngle: Record<Cardinal, number> = {
    north: Math.PI * 0.5,
    south: -Math.PI * 0.5,
    west: 0,
    east: Math.PI,
  };
  const outAngle: Record<Cardinal, number> = {
    north: -Math.PI * 0.5,
    south: Math.PI * 0.5,
    west: Math.PI,
    east: 0,
  };
  // Tylko wloty — mniej bałaganu; wyloty i tak są „prosto”
  arm.lanes
    .filter((lane) => lane.kind === "in")
    .forEach((lane) => {
      const p = armAxis(arm.dir, layout, arrDist);
      let x = p.x;
      let y = p.y;
      if (arm.dir === "north" || arm.dir === "south")
        x = layout.cx + lane.offset;
      else y = layout.cy + lane.offset;
      g.add(buildLaneArrow(x, y, travelAngle[arm.dir], lane.arrow));
    });
  void outAngle;
  return g;
}

export function buildRingLaneLines(layout: RoundaboutLayout): Konva.Group {
  const g = new Konva.Group({ listening: false });
  const { cx, cy, arms, ringLanes } = layout;
  const armHalf = Math.max(...arms.map((a) => a.halfWidth));
  // ringLanes = środki pasów; linie malujemy MIĘDZY nimi (nie po centerline — stąd „auta na liniach”)
  const seps: number[] = [];
  for (let i = 0; i < ringLanes.length - 1; i++) {
    seps.push((ringLanes[i] + ringLanes[i + 1]) / 2);
  }
  seps.forEach((r) => {
    const gap = Math.asin(Math.min(0.98, (armHalf + 12) / r));
    const spans: [number, number][] = [
      [gap, Math.PI * 0.5 - gap],
      [Math.PI * 0.5 + gap, Math.PI - gap],
      [Math.PI + gap, Math.PI * 1.5 - gap],
      [Math.PI * 1.5 + gap, Math.PI * 2 - gap],
    ];
    spans.forEach(([a0, a1]) => {
      if (a1 <= a0 + 0.1) return;
      const pts: number[] = [];
      const steps = 20;
      for (let i = 0; i <= steps; i++) {
        const a = a0 + ((a1 - a0) * i) / steps;
        pts.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      }
      g.add(
        new Konva.Line({
          points: pts,
          stroke: WHITE,
          strokeWidth: 1.5,
          dash: [16, 12],
          listening: false,
        }),
      );
    });
  });
  return g;
}

/**
 * Czerwone spirale zjazdowe ze schematu JANTAR — prowadzenie z pasa pierścienia
 * na wylot (nie dekoracja: logika zjazdu).
 */
export function buildSpiralExitGuides(layout: RoundaboutLayout): Konva.Group {
  const g = new Konva.Group({ listening: false, name: "spiral-guides" });
  const { cx, cy, ringLanes } = layout;
  const outer = ringLanes[0] ?? 198;
  const mid = ringLanes[1] ?? 178;
  const RED = "#dc2626";
  // Cztery ćwiartki: spiralny zjazd CCW z zewnętrznego pasa na oś wylotu
  const exits: { a0: number; a1: number; r0: number; r1: number }[] = [
    { a0: -0.55, a1: 0.15, r0: outer, r1: outer + 36 }, // → E
    {
      a0: Math.PI * 0.5 - 0.55,
      a1: Math.PI * 0.5 + 0.15,
      r0: outer,
      r1: outer + 36,
    }, // → S
    { a0: Math.PI - 0.55, a1: Math.PI + 0.15, r0: outer, r1: outer + 36 }, // → W
    {
      a0: -Math.PI * 0.5 - 0.55,
      a1: -Math.PI * 0.5 + 0.15,
      r0: outer,
      r1: outer + 36,
    }, // → N
  ];
  exits.forEach(({ a0, a1, r0, r1 }) => {
    const pts: number[] = [];
    const steps = 14;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const a = a0 + (a1 - a0) * t;
      const r = r0 + (r1 - r0) * t * t;
      pts.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    g.add(
      new Konva.Line({
        points: pts,
        stroke: RED,
        strokeWidth: 3,
        lineCap: "round",
        listening: false,
      }),
    );
    const tipA = a1;
    const tipR = r1;
    const tx = cx + Math.cos(tipA) * tipR;
    const ty = cy + Math.sin(tipA) * tipR;
    const tang = tipA + Math.PI * 0.5; // CCW tangent outward-ish
    const hx = Math.cos(tipA) * 10;
    const hy = Math.sin(tipA) * 10;
    const px = Math.cos(tang) * 7;
    const py = Math.sin(tang) * 7;
    g.add(
      new Konva.Line({
        points: [
          tx - hx + px,
          ty - hy + py,
          tx,
          ty,
          tx - hx - px,
          ty - hy - py,
        ],
        stroke: RED,
        strokeWidth: 3,
        lineJoin: "round",
        lineCap: "round",
        listening: false,
      }),
    );
  });
  // Wewnętrzna spirala (środkowy pas → zewnętrzny przed zjazdem)
  const innerSpirals: [number, number][] = [
    [-0.9, -0.25],
    [Math.PI * 0.5 - 0.9, Math.PI * 0.5 - 0.25],
    [Math.PI - 0.9, Math.PI - 0.25],
    [-Math.PI * 0.5 - 0.9, -Math.PI * 0.5 - 0.25],
  ];
  innerSpirals.forEach(([a0, a1]) => {
    const pts: number[] = [];
    for (let i = 0; i <= 12; i++) {
      const t = i / 12;
      const a = a0 + (a1 - a0) * t;
      const r = mid + (outer - mid) * t;
      pts.push(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    }
    g.add(
      new Konva.Line({
        points: pts,
        stroke: RED,
        strokeWidth: 2.5,
        opacity: 0.85,
        listening: false,
      }),
    );
  });
  return g;
}

export { ASPHALT, WHITE, armAxis };
