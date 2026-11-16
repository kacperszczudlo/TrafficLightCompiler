import type { RoundaboutLayout, SignalSpec } from "./types";

/** Stałe geometrii — od nich liczone są światła. */
const W = 1000;
const H = 750;
const CX = 500;
const CY = 375;
const RING = 215;
const HW = 90;
const STOP = 52;
const ZEBRA = 28;
const GAP = 36;
const HEAD = 74;
const TRAM_X = 40;
const TRAM_Y = 52;
/** Przejazd kolejowy na zachód od tarczy. */
export const RAIL_X = 72;
/** Linia stop przed torem (px od osi toru) — obie strony, ciaśniej. */
export const RAIL_STOP = 40;

function buildSignals(): SignalSpec[] {
  const stopN = CY - RING - STOP;
  const stopS = CY + RING + STOP;
  const stopW = CX - RING - STOP;
  const stopE = CX + RING + STOP;
  const zebraN = CY - RING - ZEBRA;
  const zebraS = CY + RING + ZEBRA;
  const zebraW = CX - RING - ZEBRA;
  const zebraE = CX + RING + ZEBRA;
  const armN = CY - HW;
  const armS = CY + HW;
  const armW = CX - HW;
  const armE = CX + HW;
  const southClear = (edge: number) => edge + GAP + HEAD;
  const northClear = (edge: number) => edge - GAP;

  return [
    { id: "sigN", role: "NORTH", x: armW - GAP, y: stopN, kind: "vehicle", label: "WLOT N" },
    { id: "sigS", role: "SOUTH", x: armE + GAP, y: stopS, kind: "vehicle", label: "WLOT S" },
    { id: "sigW", role: "WEST", x: stopW, y: southClear(armS), kind: "vehicle", label: "WLOT W" },
    { id: "sigE", role: "EAST", x: stopE, y: northClear(armN), kind: "vehicle", label: "WLOT E" },
    { id: "pedN", role: "PEDESTRIAN", x: armE + GAP, y: northClear(zebraN), kind: "pedestrian", label: "PIESI" },
    // Blisko zebry (mniejsze y) — countdown nie ucina się u dołu kadru
    { id: "pedS", role: "PEDESTRIAN", x: armW - GAP, y: zebraS + 8, kind: "pedestrian", label: "PIESI" },
    { id: "pedW", role: "PEDESTRIAN", x: zebraW - GAP, y: northClear(armN), kind: "pedestrian", label: "PIESI" },
    { id: "pedE", role: "PEDESTRIAN", x: zebraE + GAP, y: southClear(armS), kind: "pedestrian", label: "PIESI" },
    { id: "tramWE", role: "TRAM_WE", x: CX - TRAM_X, y: CY + TRAM_Y, kind: "tram", label: "W↔E" },
    { id: "tramNS", role: "TRAM_NS", x: CX + TRAM_X, y: CY + TRAM_Y, kind: "tram", label: "N↔S" },
  ];
}

/**
 * Rondo Autorskie — własna geometria demo (tramwaj + przejazd kolejowy).
 * approach/exit muszą wychodzić poza canvas, żeby pojazdy znikały za kadrem.
 */
export const AUTORSKIE: RoundaboutLayout = {
  id: "autorskie",
  name: "Rondo Autorskie",
  width: W,
  height: H,
  cx: CX,
  cy: CY,
  ringOuter: RING,
  ringLanes: [205, 180, 155],
  islandR: 108,
  cloverPad: 118,
  arms: [
    {
      dir: "north",
      label: "Wlot Północ",
      halfWidth: 90,
      medianHalf: 16,
      signalRole: "NORTH",
      lanes: [
        { offset: -72, kind: "in", arrow: "straightRight" },
        { offset: -48, kind: "in", arrow: "straight" },
        { offset: -24, kind: "in", arrow: "straightLeft" },
        { offset: 24, kind: "out", arrow: "straight" },
        { offset: 48, kind: "out", arrow: "straight" },
        { offset: 72, kind: "out", arrow: "straight" },
      ],
    },
    {
      dir: "south",
      label: "Wlot Południe",
      halfWidth: 90,
      medianHalf: 16,
      signalRole: "SOUTH",
      lanes: [
        { offset: 24, kind: "in", arrow: "straightLeft" },
        { offset: 48, kind: "in", arrow: "straight" },
        { offset: 72, kind: "in", arrow: "straightRight" },
        { offset: -72, kind: "out", arrow: "straight" },
        { offset: -48, kind: "out", arrow: "straight" },
        { offset: -24, kind: "out", arrow: "straight" },
      ],
    },
    {
      dir: "west",
      label: "Wlot Zachód",
      halfWidth: 90,
      medianHalf: 16,
      signalRole: "WEST",
      lanes: [
        { offset: 24, kind: "in", arrow: "straightLeft" },
        { offset: 48, kind: "in", arrow: "straight" },
        { offset: 72, kind: "in", arrow: "straightRight" },
        { offset: -72, kind: "out", arrow: "straight" },
        { offset: -48, kind: "out", arrow: "straight" },
        { offset: -24, kind: "out", arrow: "straight" },
      ],
    },
    {
      dir: "east",
      label: "Wlot Wschód",
      halfWidth: 90,
      medianHalf: 16,
      signalRole: "EAST",
      lanes: [
        { offset: -72, kind: "in", arrow: "straightRight" },
        { offset: -48, kind: "in", arrow: "straight" },
        { offset: -24, kind: "in", arrow: "straightLeft" },
        { offset: 24, kind: "out", arrow: "straight" },
        { offset: 48, kind: "out", arrow: "straight" },
        { offset: 72, kind: "out", arrow: "straight" },
      ],
    },
  ],
  zebras: [
    { dir: "north", out: 28, height: 18 },
    { dir: "south", out: 28, height: 18 },
    { dir: "west", out: 28, height: 18 },
    { dir: "east", out: 28, height: 18 },
  ],
  stops: [
    { dir: "north", out: 52, yieldOut: 6 },
    { dir: "south", out: 52, yieldOut: 6 },
    { dir: "west", out: 52, yieldOut: 6 },
    { dir: "east", out: 52, yieldOut: 6 },
  ],
  signals: buildSignals(),
  tracks: [
    { kind: "we", y: 375, offsets: [-14, -5, 5, 14] },
    { kind: "ns", x: 500, offsets: [-14, -5, 5, 14] },
    { kind: "arc", cx: 500 - 100, cy: 375 - 100, r: 88, a0: 0, a1: Math.PI * 0.5 },
    { kind: "arc", cx: 500 - 100, cy: 375 - 100, r: 97, a0: 0, a1: Math.PI * 0.5 },
    { kind: "arc", cx: 500 + 100, cy: 375 + 100, r: 88, a0: Math.PI, a1: Math.PI * 1.5 },
    { kind: "arc", cx: 500 + 100, cy: 375 + 100, r: 97, a0: Math.PI, a1: Math.PI * 1.5 },
    { kind: "arc", cx: 500 + 100, cy: 375 - 100, r: 88, a0: Math.PI * 0.5, a1: Math.PI },
    { kind: "arc", cx: 500 + 100, cy: 375 - 100, r: 97, a0: Math.PI * 0.5, a1: Math.PI },
    { kind: "arc", cx: 500 - 100, cy: 375 + 100, r: 88, a0: -Math.PI * 0.5, a1: 0 },
    { kind: "arc", cx: 500 - 100, cy: 375 + 100, r: 97, a0: -Math.PI * 0.5, a1: 0 },
  ],
  vehicles: [
    { id: "wL", color: "#a78bfa", role: "WEST", entry: "west", exit: "north", ringR: 155, laneOffset: 24, speed: 95, spawnDelay: 0.55 },
    { id: "wM", color: "#fb7185", role: "WEST", entry: "west", exit: "east", ringR: 180, laneOffset: 48, speed: 95, spawnDelay: 0.25 },
    { id: "wR", color: "#f59e0b", role: "WEST", entry: "west", exit: "south", ringR: 205, laneOffset: 72, speed: 95, spawnDelay: 0 },
    { id: "eR", color: "#fbbf24", role: "EAST", entry: "east", exit: "north", ringR: 205, laneOffset: 72, speed: 95, spawnDelay: 0 },
    { id: "eM", color: "#ec4899", role: "EAST", entry: "east", exit: "west", ringR: 180, laneOffset: 48, speed: 95, spawnDelay: 0.25 },
    { id: "eL", color: "#38bdf8", role: "EAST", entry: "east", exit: "south", ringR: 155, laneOffset: 24, speed: 95, spawnDelay: 0.55 },
    { id: "nR", color: "#34d399", role: "NORTH", entry: "north", exit: "west", ringR: 205, laneOffset: 72, speed: 95, spawnDelay: 0 },
    { id: "nM", color: "#2dd4bf", role: "NORTH", entry: "north", exit: "south", ringR: 180, laneOffset: 48, speed: 95, spawnDelay: 0.25 },
    // exitRingR mid — bez spirali na outer pod sR (S→E)
    { id: "nL", color: "#60a5fa", role: "NORTH", entry: "north", exit: "east", ringR: 155, exitRingR: 180, laneOffset: 24, speed: 95, spawnDelay: 0.55 },
    { id: "sR", color: "#f472b6", role: "SOUTH", entry: "south", exit: "east", ringR: 205, laneOffset: 72, speed: 95, spawnDelay: 0 },
    { id: "sM", color: "#38bdf8", role: "SOUTH", entry: "south", exit: "north", ringR: 180, laneOffset: 48, speed: 95, spawnDelay: 0.25 },
    { id: "sL", color: "#c084fc", role: "SOUTH", entry: "south", exit: "west", ringR: 155, laneOffset: 24, speed: 95, spawnDelay: 0.55 },
  ],
  pedestrians: [
    { id: "pN", zebra: "north", fromStart: true },
    { id: "pS", zebra: "south", fromStart: true },
    { id: "pW", zebra: "west", fromStart: true },
    { id: "pE", zebra: "east", fromStart: true },
    { id: "pN2", zebra: "north", fromStart: false },
    { id: "pW2", zebra: "west", fromStart: false },
  ],
};
