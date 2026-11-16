export type Cardinal = "north" | "south" | "east" | "west";

export interface Point {
  x: number;
  y: number;
}

export interface LaneSpec {
  /** Offset from arm centerline toward inbound RHT side (px). */
  offset: number;
  kind: "in" | "out";
  arrow: "straight" | "left" | "right" | "straightLeft" | "straightRight";
}

export interface ArmSpec {
  dir: Cardinal;
  label: string;
  halfWidth: number;
  medianHalf: number;
  lanes: LaneSpec[];
  /** Signal role key matching DFA outputs. */
  signalRole: string;
}

export interface ZebraSpec {
  dir: Cardinal;
  /** Distance from ring outer edge to zebra center. */
  out: number;
  height: number;
}

export interface StopSpec {
  dir: Cardinal;
  /** Distance from ring outer edge to solid stop (further out than zebra). */
  out: number;
  /** Also inner yield/stop near ring. */
  yieldOut: number;
}

export interface SignalSpec {
  id: string;
  role: string;
  x: number;
  y: number;
  kind: "vehicle" | "pedestrian" | "tram";
  horizontal?: boolean;
  /** Krótka etykieta przy sygnale (np. „N”, „TRAM W↔E”). */
  label?: string;
}

export interface TrackSpec {
  kind: "we" | "ns" | "arc";
  /** For linear: y (we) or x (ns). For arc: center + radius + angles. */
  y?: number;
  x?: number;
  offsets?: number[];
  cx?: number;
  cy?: number;
  r?: number;
  a0?: number;
  a1?: number;
}

export interface VehicleSpawn {
  id: string;
  color: string;
  role: string;
  entry: Cardinal;
  exit: Cardinal;
  /** Pas wlotu na pierścieniu (promień środka pasa). */
  ringR: number;
  /** Pas przed zjazdem; brak → dobierany z dystansu CCW w runtime. */
  exitRingR?: number;
  laneOffset: number;
  /** Prędkość liniowa [px/s]; dłuższa trasa = dłuższy czas przejazdu. */
  speed: number;
  startProgress?: number;
  /** Opóźnienie startu [s] na wlocie. */
  spawnDelay?: number;
}

export interface PedSpawn {
  id: string;
  zebra: Cardinal;
  /** Start at sidewalk end. */
  fromStart: boolean;
}

export interface RoundaboutLayout {
  id: string;
  name: string;
  width: number;
  height: number;
  cx: number;
  cy: number;
  ringOuter: number;
  ringLanes: number[];
  islandR: number;
  arms: ArmSpec[];
  zebras: ZebraSpec[];
  stops: StopSpec[];
  signals: SignalSpec[];
  tracks: TrackSpec[];
  vehicles: VehicleSpawn[];
  pedestrians: PedSpawn[];
  cloverPad: number;
}
