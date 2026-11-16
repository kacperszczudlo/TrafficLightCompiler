import Konva from "konva";
import type { StageApp } from "./StageApp";
import type { RoundaboutLayout, Cardinal } from "./layouts/types";
import {
  createRoundaboutRoute,
  stopPredicate,
  ccwSteps,
  ringLaneForExit,
  type SimPath,
} from "./paths/roundaboutRoute";
import {
  createCar,
  createPedestrian,
  createTram,
  poseActor,
  poseTram,
  setCarBlinker,
} from "./components/actors";
import { aabbFromCenter, aabbOverlap } from "./collision";
import {
  type DfaModel,
  resolveSignal,
  isSignalGreen,
  labelForSignal,
  chipClass,
  signalCountdownSec,
} from "./signals";
import { RAIL_X, RAIL_STOP } from "./layouts/autorskieRondo";

interface VehicleActor {
  id: string;
  role: string;
  entry: Cardinal;
  exit: Cardinal;
  node: Konva.Group;
  path: SimPath;
  progress: number;
  /** Stała prędkość liniowa [px/s] — dłuższa trasa = dłuższy czas przejazdu. */
  speedPx: number;
  stopProgress: number;
  /** Stop przed torem z zachodu (wlot). */
  railGateIn: number | null;
  /** Stop przed torem od wschodu (zjazd na W). */
  railGateOut: number | null;
  waitTimer: number;
  /** Pozostały czas przed pierwszym ruchem (wyrównany start). */
  spawnHold: number;
}

interface PedActor {
  id: string;
  node: Konva.Group;
  vertical: boolean;
  x: number;
  y: number;
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
  dir: number;
  speed: number;
  /** Start poza jezdnią; cel = przeciwny chodnik; po dojściu done. */
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  done: boolean;
  crossing: boolean;
  /** Czas poza jezdnią po przejściu — potem respawn. */
  waitOff: number;
}

export interface SimHud {
  stateId: string;
  stepLabel: string;
  timeLeft: string;
  cycles: string;
  progress: number;
  chips: { name: string; label: string; cls: string; countdown?: number }[];
  collisions: string[];
}

export class SimRuntime {
  private stageApp: StageApp;
  private layout: RoundaboutLayout;
  private dfa: DfaModel | null = null;
  private stateIndex = 0;
  private stateRemaining = 0;
  private stateTotal = 1;
  private cycles = 0;
  private running = false;
  private speed = 1;
  private debug = false;
  /** Callback UI gdy pauza z kolizji (przycisk Wznów + debug). */
  private onPausedByCollision: (() => void) | null = null;
  private vehicles: VehicleActor[] = [];
  private peds: PedActor[] = [];
  /** Progress 0→1 along dedicated track; opposite directions never share a rail. */
  private tramEW = 0.2; // W→E on southern WE track
  private tramWE = 0.65; // E→W on northern WE track
  private tramNS = 0.25; // N→S on eastern NS track
  private tramSN = 0.7; // S→N on western NS track
  private tramEWNode: Konva.Group | null = null;
  private tramWENode: Konva.Group | null = null;
  private tramNSNode: Konva.Group | null = null;
  private tramSNNode: Konva.Group | null = null;
  /** Skręt W→S po łuku SW (jak realne rozjazdy na Czyżyńskim). */
  private tramTurnNode: Konva.Group | null = null;
  /** Pociąg po lewej (N→S); progress poza [0,1] = poza kadrem. */
  private trainT = -0.35;
  private trainNode: Konva.Group | null = null;
  /** Czas zatrzymania pociągu przed przejazdem (do przerywania ewentualnych deadlocków). */
  private trainHoldSeconds = 0;
  /** Rogatki: zachód/wschód toru × północ/południe jezdni. */
  private barriers: Konva.Group[] = [];
  private barriersDown = false;
  private railLightW: Konva.Group | null = null;
  private railLightE: Konva.Group | null = null;
  /** HUD PKP: czerwone gdy zamknięte / zagrożenie, inaczej zielone + countdown. */
  private railHudStop = false;
  private railHudCountdown = 0;
  private lastHud: SimHud | null = null;
  private collisionMsgs: string[] = [];
  /** Ile klatek z rzędu para AABB — banner tylko przy trwałym styku, nie przy otarciu. */
  private collisionStreak = new Map<string, number>();
  /** Dystans dojazdu/zjazdu — poza krawędź layoutu (nie znikać w środku pasa). */
  private static readonly ARM_RUN = 420;

  constructor(stageApp: StageApp) {
    this.stageApp = stageApp;
    this.layout = stageApp.layout;
  }

  setDfa(dfa: DfaModel | null) {
    this.dfa = dfa;
    this.stateIndex = 0;
    this.cycles = 0;
    this.collisionMsgs = [];
    this.collisionStreak.clear();
    if (dfa?.states?.[0]) {
      this.stateTotal = (dfa.states[0].duration_ms || 1000) / 1000;
      this.stateRemaining = this.stateTotal;
    }
    this.spawnActors();
    this.syncSignals();
  }

  setRunning(v: boolean) {
    this.running = v;
  }

  isRunning() {
    return this.running;
  }

  setOnPausedByCollision(cb: (() => void) | null) {
    this.onPausedByCollision = cb;
  }

  setSpeed(v: number) {
    this.speed = v;
  }

  setDebug(v: boolean) {
    this.debug = v;
    this.stageApp.setDebug(v);
    if (!v) this.stageApp.clearDebug();
  }

  stepState() {
    this.advanceState();
  }

  getHud(): SimHud {
    return (
      this.lastHud || {
        stateId: "-",
        stepLabel: "- / -",
        timeLeft: "- s",
        cycles: "0",
        progress: 0,
        chips: [],
        collisions: [],
      }
    );
  }

  tick(dt: number) {
    if (!this.dfa?.states?.length) return;
    if (this.running) {
      this.stateRemaining -= dt * this.speed;
      if (this.stateRemaining <= 0) this.advanceState();
      this.updateActors(dt);
    }
    this.syncSignals();
    this.drawDebug();
    this.lastHud = this.buildHud();
    this.stageApp.layers.actors.batchDraw();
  }

  private advanceState() {
    if (!this.dfa?.states?.length) return;
    this.stateIndex = (this.stateIndex + 1) % this.dfa.states.length;
    if (this.stateIndex === 0) this.cycles += 1;
    const st = this.dfa.states[this.stateIndex];
    this.stateTotal = (st.duration_ms || 1000) / 1000;
    this.stateRemaining = this.stateTotal;
  }

  private spawnActors() {
    this.stageApp.clearActors();
    this.vehicles = [];
    this.peds = [];
    const L = this.layout;
    const layer = this.stageApp.layers.actors;

    L.vehicles.forEach((v) => {
      const steps = ccwSteps(v.entry, v.exit);
      const exitRingR = v.exitRingR ?? ringLaneForExit(steps, L.ringLanes);
      const entryRingR = v.ringR;
      const path = createRoundaboutRoute(
        L.cx,
        L.cy,
        entryRingR,
        exitRingR,
        v.entry,
        v.exit,
        {
          lane: Math.abs(v.laneOffset),
          approachDist: SimRuntime.ARM_RUN,
          exitDist: SimRuntime.ARM_RUN,
          approachRingR: L.ringOuter,
        },
      );
      const stop = L.stops.find((s) => s.dir === v.entry)!;
      const pred = stopPredicate(
        v.entry,
        L.cx,
        L.cy,
        L.ringOuter,
        stop.out,
        18,
      );
      const stopProgress = path.progressAtStop(pred);
      const hw = L.arms[0].halfWidth;
      const westGate = RAIL_X - RAIL_STOP;
      const eastGate = RAIL_X + RAIL_STOP;
      const start = path.sample(0);
      let railGateIn: number | null = null;
      let railGateOut: number | null = null;
      if (start.x < westGate - 5) {
        // Dalej przed belką — AABB auta nie styka barrier-W/E przy zamknięciu
        railGateIn = path.progressAtStop(
          (p) => Math.abs(p.y - L.cy) < hw + 30 && p.x >= westGate - 32,
        );
      }
      // Zjazd na zachód — linia stop WSCHÓD toru (nie przejeżdżaj przez rogatki)
      for (let t = 0.45; t <= 1.001; t += 0.004) {
        const p = path.sample(Math.min(1, t));
        const fx = Math.cos(p.angle);
        if (
          Math.abs(p.y - L.cy) < hw + 28 &&
          fx < -0.25 &&
          p.x <= eastGate + 32
        ) {
          railGateOut = t;
          break;
        }
      }
      // Wjazd ze wschodu przez tor (E→…): stop przed wschodnią belką
      if (start.x > eastGate + 5 && railGateOut == null) {
        for (let t = 0; t <= 0.55; t += 0.004) {
          const p = path.sample(t);
          const fx = Math.cos(p.angle);
          if (
            Math.abs(p.y - L.cy) < hw + 28 &&
            fx < -0.2 &&
            p.x <= eastGate + 32
          ) {
            railGateOut = t;
            break;
          }
        }
      }
      const node = createCar(v.color, v.id);
      layer.add(node);
      const progress = 0;
      const sample = path.sample(progress);
      poseActor(node, sample.x, sample.y, sample.angle);
      this.vehicles.push({
        id: v.id,
        role: v.role,
        entry: v.entry,
        exit: v.exit,
        node,
        path,
        progress,
        speedPx: v.speed,
        stopProgress,
        railGateIn,
        railGateOut,
        waitTimer: 0,
        spawnHold: v.spawnDelay ?? 0,
      });
    });

    L.pedestrians.forEach((p) => {
      const z = L.zebras.find((zz) => zz.dir === p.zebra)!;
      const arm = L.arms.find((a) => a.dir === p.zebra)!;
      const dist = L.ringOuter + z.out;
      const curb = Math.min(arm.halfWidth - 2, 70);
      const walkPad = 42; // głęboko na trawniku/chodniku — nie na asfalcie
      const node = createPedestrian(p.id);
      layer.add(node);
      let vertical = false;
      let minX = 0,
        maxX = 0,
        minY = 0,
        maxY = 0;
      let startX = L.cx;
      let startY = L.cy;
      let endX = L.cx;
      let endY = L.cy;
      if (p.zebra === "north" || p.zebra === "south") {
        const y = p.zebra === "north" ? L.cy - dist : L.cy + dist;
        minX = L.cx - curb;
        maxX = L.cx + curb;
        startX = p.fromStart ? minX - walkPad : maxX + walkPad;
        endX = p.fromStart ? maxX + walkPad : minX - walkPad;
        startY = y;
        endY = y;
      } else {
        vertical = true;
        const x = p.zebra === "west" ? L.cx - dist : L.cx + dist;
        minY = L.cy - curb;
        maxY = L.cy + curb;
        startY = p.fromStart ? minY - walkPad : maxY + walkPad;
        endY = p.fromStart ? maxY + walkPad : minY - walkPad;
        startX = x;
        endX = x;
      }
      node.position({ x: startX, y: startY });
      this.peds.push({
        id: p.id,
        node,
        vertical,
        x: startX,
        y: startY,
        minX,
        maxX,
        minY,
        maxY,
        dir: p.fromStart ? 1 : -1,
        speed: 48,
        startX,
        startY,
        endX,
        endY,
        done: false,
        crossing: false,
        waitOff: 0,
      });
    });

    this.tramEWNode = createTram("ew");
    this.tramWENode = createTram("we");
    this.tramNSNode = createTram("ns");
    this.tramSNNode = createTram("sn");
    this.tramTurnNode = createTram("turn");
    layer.add(this.tramEWNode);
    layer.add(this.tramWENode);
    layer.add(this.tramNSNode);
    layer.add(this.tramSNNode);
    layer.add(this.tramTurnNode);
    this.tramTurnNode.visible(false); // wyłączony — łuk SW psuł tor/kolizje
    this.tramEW = 0.02;
    this.tramWE = 0.98;
    this.tramNS = 0.04;
    this.tramSN = 0.96;
    this.spawnRailCrossing(layer);
    this.poseTrams();
    this.poseTrain();
  }

  private trainY(): number {
    const M = 180;
    return -M + this.trainT * (this.layout.height + 2 * M);
  }

  private spawnRailCrossing(layer: Konva.Layer) {
    const L = this.layout;
    const hw = L.arms[0].halfWidth;
    const westStop = RAIL_X - RAIL_STOP;
    const eastStop = RAIL_X + RAIL_STOP;
    const marks = this.stageApp.layers.markings;
    const sigs = this.stageApp.layers.signals;

    // Linie stop — krótkie kreski na pasach wlotu (nie „ramka” przez całą jezdnię)
    const paintStop = (x: number) => {
      for (let y = L.cy - hw + 10; y < L.cy + hw - 10; y += 22) {
        marks.add(
          new Konva.Line({
            points: [x, y, x, y + 12],
            stroke: "#f8fafc",
            strokeWidth: 3,
            listening: false,
          }),
        );
      }
    };
    paintStop(westStop);
    paintStop(eastStop);

    this.trainNode = new Konva.Group({ name: "train", listening: false });
    this.trainNode.add(
      new Konva.Rect({
        x: -12,
        y: -52,
        width: 24,
        height: 104,
        fill: "#1e3a5f",
        stroke: "#0f172a",
        strokeWidth: 2,
        cornerRadius: 3,
      }),
    );
    this.trainNode.add(
      new Konva.Rect({
        x: -9,
        y: -44,
        width: 18,
        height: 16,
        fill: "#38bdf8",
        opacity: 0.85,
      }),
    );
    layer.add(this.trainNode);

    /** Światło przejazdu: czerwone przy zamkniętych / zielone przy otwartych + sekundy. */
    const mkRailLight = (x: number, y: number, name: string) => {
      const g = new Konva.Group({ x, y, name, listening: false });
      g.add(
        new Konva.Rect({
          x: -10,
          y: -52,
          width: 20,
          height: 40,
          fill: "#0f172a",
          stroke: "#94a3b8",
          strokeWidth: 1.2,
          cornerRadius: 2,
        }),
      );
      g.add(
        new Konva.Circle({
          x: 0,
          y: -38,
          radius: 5.5,
          fill: "#ef4444",
          name: "bulb-r",
        }),
      );
      g.add(
        new Konva.Circle({
          x: 0,
          y: -22,
          radius: 5.5,
          fill: "#1e293b",
          name: "bulb-g",
        }),
      );
      g.add(
        new Konva.Text({
          x: -28,
          y: -8,
          width: 56,
          text: "PKP",
          fontSize: 10,
          fontStyle: "bold",
          fill: "#f8fafc",
          align: "center",
        }),
      );
      g.add(
        new Konva.Text({
          x: -28,
          y: 6,
          width: 56,
          text: "",
          fontSize: 14,
          fontStyle: "bold",
          fill: "#fbbf24",
          align: "center",
          name: "countdown",
        }),
      );
      sigs.add(g);
      return g;
    };
    this.railLightW = mkRailLight(westStop - 28, L.cy + hw + 58, "rail-sig-w");
    this.railLightE = mkRailLight(eastStop + 28, L.cy - hw - 58, "rail-sig-e");

    /**
     * Rogatka top-down: jedna belka na stronę toru.
     * Zamknięta = pasek w poprzek jezdni (N–S). Otwarta = krótki kikut przy krawężniku.
     */
    this.barriers = [];
    const mkBoom = (x: number, foldAway: 1 | -1, name: string) => {
      const g = new Konva.Group({ x, y: L.cy, name, listening: false });
      // Słupki przy krawężnikach
      g.add(
        new Konva.Rect({
          x: -5,
          y: -hw - 10,
          width: 10,
          height: 10,
          fill: "#475569",
          cornerRadius: 2,
        }),
      );
      g.add(
        new Konva.Rect({
          x: -5,
          y: hw,
          width: 10,
          height: 10,
          fill: "#475569",
          cornerRadius: 2,
        }),
      );
      // Zamknięta: jedna ciągła belka w poprzek jezdni + paski
      const closed = new Konva.Group({ name: "closed", visible: false });
      closed.add(
        new Konva.Rect({
          x: -6,
          y: -hw + 2,
          width: 12,
          height: 2 * hw - 4,
          fill: "#f8fafc",
          stroke: "#0f172a",
          strokeWidth: 1,
        }),
      );
      for (let i = 0; i < 9; i++) {
        closed.add(
          new Konva.Rect({
            x: -6,
            y: -hw + 6 + i * ((2 * hw - 12) / 9),
            width: 12,
            height: 10,
            fill: "#ef4444",
          }),
        );
      }
      g.add(closed);
      // Otwarta: belka na trawie, OD torów (poza asfaltem)
      const open = new Konva.Group({ name: "open", visible: true });
      open.add(
        new Konva.Rect({
          x: foldAway > 0 ? 10 : -70,
          y: -hw - 16,
          width: 60,
          height: 10,
          fill: "#f8fafc",
          stroke: "#0f172a",
          strokeWidth: 1,
        }),
      );
      for (let i = 0; i < 4; i++) {
        open.add(
          new Konva.Rect({
            x: foldAway > 0 ? 14 + i * 14 : -66 + i * 14,
            y: -hw - 16,
            width: 10,
            height: 10,
            fill: "#ef4444",
          }),
        );
      }
      g.add(open);
      sigs.add(g);
      this.barriers.push(g);
      return g;
    };
    // Zachód: złóż w lewo (−); wschód: w prawo (+)
    mkBoom(westStop, -1, "boom-w");
    mkBoom(eastStop, 1, "boom-e");
    this.trainT = -0.5;
  }

  /**
   * Ktoś jest MIĘDZY belkami (na torach) — awaryjne otwarcie + pociąg czeka.
   * Auta stojące przed linią stop NIE liczą się (inaczej rogatki bez sensu podskakują).
   */
  private crossingTrapped(): boolean {
    const L = this.layout;
    const hw = L.arms[0].halfWidth;
    const west = RAIL_X - RAIL_STOP;
    const east = RAIL_X + RAIL_STOP;
    const onTracks = (x: number, y: number) =>
      x > west + 2 && x < east - 2 && Math.abs(y - L.cy) < hw + 14;
    if (
      this.vehicles.some((v) => {
        const s = v.path.sample(Math.min(1, v.progress));
        return onTracks(s.x, s.y);
      })
    )
      return true;
    for (const [t, y] of [
      [this.tramEW, L.cy + 9.5],
      [this.tramWE, L.cy - 9.5],
    ] as const) {
      // Tram ma ~42 px półdługości — środek + zasięg pudła
      if (t <= 0.02 || t >= 0.98) continue;
      const x = this.tramMapX(t);
      if (onTracks(x, y) || onTracks(x - 36, y) || onTracks(x + 36, y))
        return true;
    }
    if (this.peds.some((p) => !p.done && onTracks(p.x, p.y))) return true;
    return false;
  }

  private poseTrain() {
    const L = this.layout;
    const y = this.trainY();
    if (this.trainNode) {
      this.trainNode.visible(this.trainT > -0.02 && this.trainT < 1.02);
      this.trainNode.position({ x: RAIL_X, y });
    }
    const dist = Math.abs(y - L.cy);
    const onApproach = this.trainT > -0.02 && this.trainT < 1.02;
    const wantClose = onApproach && dist < 520;
    const trapped = this.crossingTrapped();
    // Zamknij gdy nikt NIE jest na torach. Auta/tram przed belką NIE blokują zamknięcia
    // (wcześniej clearToClose + holdTrain = deadlock: pociąg stał w nieskończoność).
    if (!wantClose) {
      this.barriersDown = false;
    } else if (trapped) {
      this.barriersDown = false;
    } else {
      this.barriersDown = true;
    }
    for (const b of this.barriers) {
      const closed = b.findOne(".closed") as Konva.Group | null;
      const open = b.findOne(".open") as Konva.Group | null;
      if (closed) closed.visible(this.barriersDown);
      if (open) open.visible(!this.barriersDown);
    }
    const etaSec = this.railCountdownSec(wantClose);
    const stop = this.barriersDown || wantClose;
    this.railHudStop = stop;
    this.railHudCountdown = etaSec;
    const syncRailLight = (g: Konva.Group | null) => {
      if (!g) return;
      const red = g.findOne(".bulb-r") as Konva.Circle | null;
      const green = g.findOne(".bulb-g") as Konva.Circle | null;
      const cd = g.findOne(".countdown") as Konva.Text | null;
      if (red) red.fill(stop ? "#ef4444" : "#1e293b");
      if (green) green.fill(stop ? "#1e293b" : "#22c55e");
      if (cd) cd.text(etaSec > 0 ? String(etaSec) : "");
    };
    syncRailLight(this.railLightW);
    syncRailLight(this.railLightE);
  }

  /**
   * Odliczanie PKP jak przy zwykłych światłach:
   * zielone → za ile czerwone (zamknięcie); czerwone → za ile znów zielone.
   */
  private railCountdownSec(wantClose: boolean): number {
    const L = this.layout;
    const M = 180;
    const span = L.height + 2 * M;
    const dTdt = Math.max(0.09 * this.speed, 0.01);
    const yOf = (t: number) => -M + t * span;
    if (this.barriersDown) {
      // Do zielonego: pociąg musi wyjść ze strefy wantClose (dist ≥ 520)
      let t = this.trainT;
      let acc = 0;
      for (let i = 0; i < 900; i++) {
        t += dTdt * 0.05;
        if (t > 1.25) t = -0.45;
        acc += 0.05;
        const yy = yOf(t);
        const on = t > -0.02 && t < 1.02;
        const close = on && Math.abs(yy - L.cy) < 520;
        if (!close) return Math.max(1, Math.ceil(acc));
      }
      return 1;
    }
    // Zielone / zaraz czerwone: sekundy do wantClose (czerwone PKP)
    let t = this.trainT;
    let acc = 0;
    for (let i = 0; i < 900; i++) {
      const yy = yOf(t);
      const on = t > -0.02 && t < 1.02;
      if (on && Math.abs(yy - L.cy) < 520) {
        if (wantClose) return Math.max(1, Math.ceil(Math.max(acc, 0.4)));
        return Math.max(1, Math.ceil(acc));
      }
      t += dTdt * 0.05;
      if (t > 1.25) t = -0.45;
      acc += 0.05;
    }
    return 0;
  }

  private poseTrams() {
    const L = this.layout;
    const weSouth = L.cy + 9.5;
    const weNorth = L.cy - 9.5;
    const nsEast = L.cx + 9.5;
    const nsWest = L.cx - 9.5;
    // Margin poza layout — tram wyjeżdża za kadr (bleed), dopiero potem znika
    const MX = 240;
    const MY = 200;
    const mapX = (t: number) => -MX + t * (L.width + 2 * MX);
    const mapY = (t: number) => -MY + t * (L.height + 2 * MY);
    const onScreen = (t: number) => t > -0.02 && t < 1.02;

    if (this.tramEWNode) {
      this.tramEWNode.visible(onScreen(this.tramEW));
      poseTram(this.tramEWNode, mapX(this.tramEW), weSouth, 0);
    }
    if (this.tramWENode) {
      this.tramWENode.visible(onScreen(this.tramWE));
      poseTram(this.tramWENode, mapX(this.tramWE), weNorth, Math.PI);
    }
    if (this.tramNSNode) {
      this.tramNSNode.visible(onScreen(this.tramNS));
      poseTram(this.tramNSNode, nsEast, mapY(this.tramNS), Math.PI * 0.5);
    }
    if (this.tramSNNode) {
      this.tramSNNode.visible(onScreen(this.tramSN));
      poseTram(this.tramSNNode, nsWest, mapY(this.tramSN), -Math.PI * 0.5);
    }
    if (this.tramTurnNode) this.tramTurnNode.visible(false);
  }

  private updateActors(dt: number) {
    const L = this.layout;
    const pedSig = resolveSignal(this.dfa, this.stateIndex, "PEDESTRIAN");
    const canPed = isSignalGreen(pedSig);
    // Trams: przeciwne kierunki = osobne tory; osie WE⊥NS = mutex + clearance
    const weGo = isSignalGreen(
      resolveSignal(this.dfa, this.stateIndex, "TRAM_WE"),
    );
    const nsGo = isSignalGreen(
      resolveSignal(this.dfa, this.stateIndex, "TRAM_NS"),
    );
    const weInJunction = this.tramAxisInJunction("we");
    const nsInJunction = this.tramAxisInJunction("ns");
    const weMayEnter = weGo && !nsInJunction;
    const nsMayEnter = nsGo && !weInJunction;
    const tramStep = dt * 0.16 * this.speed;
    // Dalej poza tarczą (x≈-166) — nie stój na pasie wlotu W pod nosem aut
    const HOLD_LO = 0.05;
    const HOLD_HI = 0.95;
    const carBlockingTram = (
      axis: "we" | "ns",
      t: number,
      dir: 1 | -1,
    ): boolean => {
      const tx =
        axis === "we" ? this.tramMapX(t) : L.cx + (dir > 0 ? 9.5 : -9.5);
      const ty =
        axis === "we" ? L.cy + (dir > 0 ? 9.5 : -9.5) : this.tramMapY(t);
      return this.vehicles.some((v) => {
        if (v.progress <= v.stopProgress - 0.01 || v.progress >= 0.9)
          return false;
        const s = v.path.sample(Math.min(1, v.progress));
        if (Math.hypot(s.x - L.cx, s.y - L.cy) > L.ringOuter + 28) return false;
        if (axis === "we") {
          const ahead = (s.x - tx) * dir;
          return Math.abs(s.y - L.cy) < 21.5 && ahead > 32 && ahead < 84;
        } else {
          const ahead = (s.y - ty) * dir;
          return Math.abs(s.x - L.cx) < 21.5 && ahead > 32 && ahead < 84;
        }
      });
    };
    const advance = (
      axis: "we" | "ns",
      t: number,
      dir: 1 | -1,
      mayEnter: boolean,
    ) => {
      if (carBlockingTram(axis, t, dir)) return t;
      const inJ = this.tramProgressInJunction(t);
      const atRailHold = axis === "we" && dir > 0 && t > 0.13 && t < 0.22;
      const committed =
        !atRailHold && (dir > 0 ? t > HOLD_LO + 0.01 : t < HOLD_HI - 0.01);
      if (mayEnter || inJ || committed) {
        let n = t + dir * tramStep;
        // Wyjedź za kadr, dopiero potem respawn
        if (dir > 0 && n > 1.2) n = -0.2;
        if (dir < 0 && n < -0.2) n = 1.2;
        return n;
      }
      const n = t + dir * tramStep;
      if (atRailHold) return t;
      if (dir > 0) return Math.min(n, HOLD_LO);
      return Math.max(n, HOLD_HI);
    };
    // Pas tramu przez tarczę + pierścień — sprawdza czy przed wjazdem z HOLD tory są wolne
    const carOnWe = this.vehicles.some((v) => {
      if (v.progress <= v.stopProgress || v.progress >= 0.9) return false;
      const s = v.path.sample(Math.min(1, v.progress));
      return (
        Math.abs(s.y - L.cy) < 30 && Math.abs(s.x - L.cx) < L.ringOuter + 20
      );
    });
    const carOnNs = this.vehicles.some((v) => {
      if (v.progress <= v.stopProgress || v.progress >= 0.9) return false;
      const s = v.path.sample(Math.min(1, v.progress));
      return (
        Math.abs(s.x - L.cx) < 30 && Math.abs(s.y - L.cy) < L.ringOuter + 20
      );
    });
    // Przy zagrożeniu PKP tram W↔E nie wjeżdża; jeśli już na przejeździe — ewakuacja poza belki
    this.tramEW = this.advanceTramPastRail(
      this.tramEW,
      1,
      advance("we", this.tramEW, 1, weMayEnter && !carOnWe),
    );
    this.tramWE = this.advanceTramPastRail(
      this.tramWE,
      -1,
      advance("we", this.tramWE, -1, weMayEnter && !carOnWe),
    );
    this.tramNS = advance("ns", this.tramNS, 1, nsMayEnter && !carOnNs);
    this.tramSN = advance("ns", this.tramSN, -1, nsMayEnter && !carOnNs);

    // Pociąg N→S: stój przed jezdnią TYLKO gdy ktoś jest na torach (ewakuacja).
    // Nie wymagaj barriersDown — inaczej tram przed belką blokował pociąg na zawsze.
    const trainYNow = this.trainY();
    const stopBeforeRoad = L.cy - L.arms[0].halfWidth - 100;
    const approachingRoad =
      this.trainT > -0.02 && this.trainT < 1.02 && trainYNow < L.cy + 10;
    const holdTrain =
      approachingRoad &&
      trainYNow > stopBeforeRoad - 30 &&
      this.crossingTrapped();
    if (holdTrain) {
      this.trainHoldSeconds += dt * this.speed;
    } else {
      this.trainHoldSeconds = 0;
    }
    // Awaryjne przełamanie deadlocka: jeśli pociąg stoi > 5s z powodu blokady,
    // pojazdy na torach otrzymują bezwzględną ewakuację, a po 8s pociąg wznawia bieg.
    if (!holdTrain || this.trainHoldSeconds > 8) {
      this.trainT += dt * 0.09 * this.speed;
      if (this.trainT > 1.25) this.trainT = -0.45;
    }
    this.poseTrain();

    this.poseTrams();

    // Piesi: jedno przejście chodnik→chodnik; po chwili respawn (bez ping-ponga)
    this.peds.forEach((p) => {
      if (p.done) {
        p.waitOff += dt * this.speed;
        if (p.waitOff > 6) {
          p.done = false;
          p.crossing = false;
          p.waitOff = 0;
          p.x = p.startX;
          p.y = p.startY;
          p.node.position({ x: p.startX, y: p.startY });
        } else {
          p.node.position({ x: p.endX, y: p.endY });
        }
        return;
      }
      const onRoad = p.vertical
        ? p.y > p.minY + 2 && p.y < p.maxY - 2
        : p.x > p.minX + 2 && p.x < p.maxX - 2;
      if (!p.crossing) {
        if (!canPed) return;
        p.crossing = true;
      }
      if (!canPed && !onRoad) {
        // Czerwone zanim weszli — wróć na start
        p.crossing = false;
        p.x = p.startX;
        p.y = p.startY;
        p.node.position({ x: p.x, y: p.y });
        return;
      }
      const dx = p.endX - p.x;
      const dy = p.endY - p.y;
      const dist = Math.hypot(dx, dy) || 1;
      const step = p.speed * dt * this.speed;
      const nx = dist <= step ? p.endX : p.x + (dx / dist) * step;
      const ny = dist <= step ? p.endY : p.y + (dy / dist) * step;
      const carInWay = this.vehicles.some((v) => {
        if (v.progress <= v.stopProgress + 0.005 || v.progress >= 0.92)
          return false;
        const s = v.path.sample(Math.min(1, v.progress));
        return (
          Math.hypot(nx - s.x, ny - s.y) < 22 &&
          Math.hypot(nx - s.x, ny - s.y) < Math.hypot(p.x - s.x, p.y - s.y)
        );
      });
      if (!carInWay) {
        if (dist <= step) {
          p.x = p.endX;
          p.y = p.endY;
          p.done = true;
          p.crossing = false;
        } else {
          p.x = nx;
          p.y = ny;
        }
      }
      p.node.position({ x: p.x, y: p.y });
    });

    const tramBoxes = this.tramAabbs("traffic");
    const tramBlocking = tramBoxes.length > 0;

    // Faza 1: zaproponuj progress (kolejność: dalej na trasie najpierw — liderzy)
    const order = [...this.vehicles].sort((a, b) => b.progress - a.progress);
    const proposed = new Map<string, number>();
    for (const v of order) {
      if (v.spawnHold > 0) {
        v.spawnHold -= dt * this.speed;
        proposed.set(v.id, v.progress);
        continue;
      }
      const sig = resolveSignal(this.dfa, this.stateIndex, v.role);
      const canDrive = isSignalGreen(sig);
      const stopAt = v.stopProgress;
      // progress = ułamek długości trasy → ta sama speedPx, różny czas przejazdu
      const step = (v.speedPx / Math.max(v.path.length, 1)) * dt * this.speed;
      let next = v.progress;
      const lookProg = Math.min(1, v.progress + step * 4);
      const lookPose = v.path.sample(lookProg);
      const nowPose = v.path.sample(Math.min(1, v.progress));
      const carBox = aabbFromCenter(
        lookPose.x,
        lookPose.y,
        12,
        22,
        lookPose.angle - Math.PI / 2,
      );
      const nowBox = aabbFromCenter(
        nowPose.x,
        nowPose.y,
        10,
        18,
        nowPose.angle - Math.PI / 2,
      );
      const lookBox = aabbFromCenter(
        lookPose.x,
        lookPose.y,
        11,
        20,
        lookPose.angle - Math.PI / 2,
      );
      const fx = Math.cos(nowPose.angle);
      const inWeTrackNow =
        Math.abs(nowPose.y - L.cy) < 22.5 &&
        Math.hypot(nowPose.x - L.cx, nowPose.y - L.cy) < L.ringOuter + 20;
      const inNsTrackNow =
        Math.abs(nowPose.x - L.cx) < 22.5 &&
        Math.hypot(nowPose.x - L.cx, nowPose.y - L.cy) < L.ringOuter + 20;
      const carOnArm =
        Math.hypot(nowPose.x - L.cx, nowPose.y - L.cy) > L.ringOuter - 15;
      const parallelWeArm = carOnArm && Math.abs(nowPose.y - L.cy) > 18;
      const parallelNsArm = carOnArm && Math.abs(nowPose.x - L.cx) > 18;

      const betweenRail =
        Math.abs(nowPose.y - L.cy) < L.arms[0].halfWidth + 18 &&
        nowPose.x > RAIL_X - RAIL_STOP - 36 &&
        nowPose.x < RAIL_X + RAIL_STOP + 36;
      // Pojazd ewakuujący się z przejazdu za rogatki wyjazdowe
      const evacuatingRail =
        Math.abs(nowPose.y - L.cy) < L.arms[0].halfWidth + 18 &&
        ((fx < -0.2 && nowPose.x < RAIL_X + RAIL_STOP + 15) ||
          (fx > 0.2 && nowPose.x > RAIL_X - RAIL_STOP - 15));

      const wouldHitTram =
        tramBlocking &&
        !inWeTrackNow &&
        !inNsTrackNow &&
        !evacuatingRail &&
        tramBoxes.some((tb) => {
          // Na ramieniu z osobnym pasem nie ma kolizji z tramem jadącym w osi jezdni
          if (parallelWeArm && (tb.id === "tram-EW" || tb.id === "tram-WE"))
            return false;
          if (parallelNsArm && (tb.id === "tram-NS" || tb.id === "tram-SN"))
            return false;
          return aabbOverlap(carBox, tb.box) || aabbOverlap(nowBox, tb.box);
        });
      const trainHit = this.trainAabb();
      const wouldHitTrain =
        !betweenRail &&
        !evacuatingRail &&
        !!trainHit &&
        (aabbOverlap(nowBox, trainHit.box) ||
          aabbOverlap(carBox, trainHit.box) ||
          Math.hypot(nowPose.x - RAIL_X, nowPose.y - this.trainY()) < 48);

      // Na przejeździe lub podczas ewakuacji — jedź dalej; rogatki nie blokują wyjazdu
      const wouldHitBarrier =
        !betweenRail &&
        !evacuatingRail &&
        this.barrierAabbs().some(
          (b) =>
            aabbOverlap(nowBox, b.box) ||
            aabbOverlap(lookBox, b.box) ||
            aabbOverlap(carBox, b.box),
        );
      const wouldHitPed = this.pedAabbs().some(
        (pb) => aabbOverlap(nowBox, pb.box) || aabbOverlap(lookBox, pb.box),
      );
      // Korytarz torowy: zatrzymaj auto PRZED wejściem na torowisko na pierścieniu, jeśli nadjeżdża tramwaj.
      // Jeśli auto już jest na torowisku (inWeTrackNow / inNsTrackNow) — ewakuuj (tramwaj poczeka w carBlockingTram).
      const ewX = this.tramMapX(this.tramEW);
      const weX = this.tramMapX(this.tramWE);
      const nsY = this.tramMapY(this.tramNS);
      const snY = this.tramMapY(this.tramSN);
      const ewActive = this.tramEW > 0.22 && this.tramEW < 0.78;
      const weActive = this.tramWE > 0.22 && this.tramWE < 0.78;
      const nsActive = this.tramNS > 0.18 && this.tramNS < 0.82;
      const snActive = this.tramSN > 0.18 && this.tramSN < 0.82;
      let tramCorridor = false;
      if (v.progress > stopAt + 0.035 && v.progress < 0.78) {
        for (
          let t = v.progress + 0.008;
          t <= Math.min(1, v.progress + 0.06);
          t += 0.008
        ) {
          const p = v.path.sample(t);
          if (Math.hypot(p.x - L.cx, p.y - L.cy) > L.ringOuter + 8) continue;
          if (!inWeTrackNow && Math.abs(p.y - L.cy) < 21.5) {
            const ewNear = ewActive && p.x - ewX > -42 && p.x - ewX < 105;
            const weNear = weActive && weX - p.x > -42 && weX - p.x < 105;
            if (ewNear || weNear) {
              tramCorridor = true;
              break;
            }
          }
          if (!inNsTrackNow && Math.abs(p.x - L.cx) < 21.5) {
            const nsNear = nsActive && p.y - nsY > -42 && p.y - nsY < 105;
            const snNear = snActive && snY - p.y > -42 && snY - p.y < 105;
            if (nsNear || snNear) {
              tramCorridor = true;
              break;
            }
          }
        }
      }
      const railBlock = this.railBlocksVehicle(v);
      const railYellowBox = this.railCrossingBlockedAhead(v);
      // Za linią stop → już na wlocie/pierścieniu: czerwone wlotu nie obowiązuje
      const pastStop = v.progress > stopAt + 0.02;
      const onRing = pastStop && v.progress < 0.78;
      const followGap = onRing ? 40 : 42;
      let followScale = 1;
      const wouldHitCar = this.vehicles.some((o) => {
        if (o.id === v.id) return false;
        if (
          (proposed.get(o.id) ?? o.progress) === 0 &&
          o.spawnHold > 0 &&
          v.progress === 0
        ) {
          return false;
        }
        const oProg = proposed.get(o.id) ?? o.progress;
        const os = o.path.sample(Math.min(1, oProg));
        const dist = Math.hypot(nowPose.x - os.x, nowPose.y - os.y);
        if (dist > followGap + 12) return false;
        const oBox = aabbFromCenter(os.x, os.y, 10, 18, os.angle - Math.PI / 2);
        const fx = Math.cos(nowPose.angle);
        const fy = Math.sin(nowPose.angle);
        const ahead = (os.x - nowPose.x) * fx + (os.y - nowPose.y) * fy;
        const oAhead =
          (nowPose.x - os.x) * Math.cos(os.angle) +
          (nowPose.y - os.y) * Math.sin(os.angle);
        const relLead = ahead - oAhead;
        const shouldYieldToO =
          relLead > 1 || (Math.abs(relLead) <= 1 && v.id < o.id);
        const side = Math.abs(
          -(os.x - nowPose.x) * fy + (os.y - nowPose.y) * fx,
        );
        // Sąsiedni pas tego samego wlotu (obok) — OK
        if (o.entry === v.entry && side > 16 && Math.abs(ahead) < 14)
          return false;
        const overlapped = aabbOverlap(nowBox, oBox) && side < 15;
        if (overlapped) {
          // Ściśle antysymetryczny priorytet: tylko auto z tyłu staje, lider odjeżdża
          return shouldYieldToO;
        }
        if (relLead < -2 || ahead < -2) return false;
        if (side > (onRing ? 28 : 20)) return false;
        if (
          (aabbOverlap(lookBox, oBox) || aabbOverlap(carBox, oBox)) &&
          shouldYieldToO
        )
          return true;
        if (o.entry === v.entry && ahead > 8 && dist < followGap && side < 14)
          return shouldYieldToO;
        // Merge / zmiana pasa na pierścieniu (zarówno różne wloty, jak i spirala tego samego wlotu)
        if (onRing && ahead > 0 && side < 22 && dist < followGap + 8) {
          const myR = Math.hypot(nowPose.x - L.cx, nowPose.y - L.cy);
          const myLookR = Math.hypot(lookPose.x - L.cx, lookPose.y - L.cy);
          const oR = Math.hypot(os.x - L.cx, os.y - L.cy);
          if (Math.abs(myR - oR) > 18 && Math.abs(myLookR - oR) > 16) {
            followScale = Math.min(followScale, 0.75);
            return false;
          }
          if (shouldYieldToO) {
            followScale = Math.min(
              followScale,
              Math.max(0.15, (dist - 14) / (followGap + 8)),
            );
            if (dist < 26) return true;
          }
          return false;
        }
        if (
          shouldYieldToO &&
          ahead > 6 &&
          side < (onRing ? 15 : 12) &&
          dist < followGap
        ) {
          followScale = Math.min(
            followScale,
            Math.max(0.3, (dist - 12) / followGap),
          );
          return dist < 18;
        }
        return false;
      });
      const pedBlock = this.pedBlocksVehicle(v);
      const hardBlock =
        wouldHitTram ||
        wouldHitTrain ||
        wouldHitBarrier ||
        wouldHitPed ||
        tramCorridor ||
        railBlock ||
        railYellowBox ||
        pedBlock ||
        wouldHitCar;

      if (!hardBlock) {
        const moveStep = step * followScale;
        if (!canDrive && !pastStop) {
          if (v.progress < stopAt - 0.004) {
            next = Math.min(stopAt, v.progress + moveStep);
          } else {
            next = stopAt;
          }
        } else {
          next = v.progress + moveStep;
        }
      }
      next = this.clampRailGates(v, next);
      if (next >= 1) {
        v.waitTimer += dt * this.speed;
        if (v.waitTimer > 2.2) {
          // Respawn tylko gdy slot startowy wolny
          const startPose = v.path.sample(0);
          const clear = !this.vehicles.some((o) => {
            if (o.id === v.id) return false;
            const op = proposed.get(o.id) ?? o.progress;
            if (op > 0.12) return false;
            const os = o.path.sample(Math.min(1, op));
            return Math.hypot(startPose.x - os.x, startPose.y - os.y) < 40;
          });
          if (clear) {
            next = 0;
            v.waitTimer = 0;
            v.spawnHold = 0.8; // krótka przerwa przed kolejnym okrążeniem
          } else {
            next = 1;
          }
        } else {
          next = 1;
        }
      }
      proposed.set(v.id, next);
    }

    // Faza 2: zastosuj + pose
    this.vehicles.forEach((v) => {
      v.progress = proposed.get(v.id) ?? v.progress;
      const s = v.path.sample(Math.min(1, v.progress));
      poseActor(v.node, s.x, s.y, s.angle);
      const lit = Math.floor(performance.now() / 200) % 2 === 0;
      setCarBlinker(v.node, s.blinker, lit);
    });

    this.checkCollisions();
  }

  /** Wąski pas środka — clearance, nie „parking” na wyspie. */
  private tramProgressInJunction(t: number): boolean {
    return t > 0.42 && t < 0.58;
  }

  private tramAxisInJunction(axis: "we" | "ns"): boolean {
    if (axis === "we") {
      return (
        this.tramProgressInJunction(this.tramEW) ||
        this.tramProgressInJunction(this.tramWE)
      );
    }
    return (
      this.tramProgressInJunction(this.tramNS) ||
      this.tramProgressInJunction(this.tramSN)
    );
  }

  private tramMapX(t: number): number {
    const MX = 240;
    return -MX + t * (this.layout.width + 2 * MX);
  }

  private tramMapY(t: number): number {
    const MY = 200;
    return -MY + t * (this.layout.height + 2 * MY);
  }

  /**
   * Hitbox tramu. `full` = pudło 84×22 (debug / pociąg / rogatki).
   * `traffic` = ciaśniej vs auta (bez fałszywych otarć sąsiedniego pasa).
   */
  private tramAabbs(kind: "full" | "traffic" = "full"): {
    id: string;
    box: ReturnType<typeof aabbFromCenter>;
    x: number;
    y: number;
  }[] {
    const L = this.layout;
    const weSouth = L.cy + 9.5;
    const weNorth = L.cy - 9.5;
    const nsEast = L.cx + 9.5;
    const nsWest = L.cx - 9.5;
    const out: {
      id: string;
      box: ReturnType<typeof aabbFromCenter>;
      x: number;
      y: number;
    }[] = [];
    const tw = kind === "full" ? 84 : 64;
    const th = kind === "full" ? 22 : 14;
    const push = (
      id: string,
      t: number,
      x: number,
      y: number,
      angle: number,
    ) => {
      if (t < -0.02 || t > 1.02) return;
      out.push({ id, x, y, box: aabbFromCenter(x, y, tw, th, angle) });
    };
    push("tram-EW", this.tramEW, this.tramMapX(this.tramEW), weSouth, 0);
    push("tram-WE", this.tramWE, this.tramMapX(this.tramWE), weNorth, Math.PI);
    push(
      "tram-NS",
      this.tramNS,
      nsEast,
      this.tramMapY(this.tramNS),
      Math.PI * 0.5,
    );
    push(
      "tram-SN",
      this.tramSN,
      nsWest,
      this.tramMapY(this.tramSN),
      -Math.PI * 0.5,
    );
    return out;
  }

  private railThreat(): boolean {
    if (this.barriersDown) return true;
    const dist = Math.abs(this.trainY() - this.layout.cy);
    return this.trainT > -0.02 && this.trainT < 1.02 && dist < 520;
  }

  private railBlocksVehicle(v: VehicleActor): boolean {
    if (!this.railThreat()) return false;
    const L = this.layout;
    const hw = L.arms[0].halfWidth;
    const now = v.path.sample(Math.min(1, v.progress));
    if (Math.abs(now.y - L.cy) > hw + 16) return false;
    const westStop = RAIL_X - RAIL_STOP;
    const eastStop = RAIL_X + RAIL_STOP;
    const fx = Math.cos(now.angle);
    // Już między belkami lub ewakuacja poza strefę zagrożenia — nie blokuj!
    if (now.x > westStop - 10 && now.x < eastStop + 10) return false;
    if (fx < -0.2 && now.x < eastStop + 10) return false;
    if (fx > 0.2 && now.x > westStop - 10) return false;
    // →E: stój przed zachodnią belką (większy luz pod AABB)
    if (fx > 0.2 && now.x <= westStop - 20 && now.x >= westStop - 75)
      return true;
    // →W: stój przed wschodnią belką
    if (fx < -0.2 && now.x >= eastStop + 20 && now.x <= eastStop + 75)
      return true;
    return false;
  }

  /**
   * Zasada "żółtego pola" (anti-gridlock) na przejeździe kolejowym:
   * Zakaz wjazdu na przejazd, jeżeli za przejazdem w tym samym pasie nie ma wolnego miejsca.
   */
  private railCrossingBlockedAhead(v: VehicleActor): boolean {
    const L = this.layout;
    const hw = L.arms[0].halfWidth;
    const now = v.path.sample(Math.min(1, v.progress));
    if (Math.abs(now.y - L.cy) > hw + 16) return false;
    const westStop = RAIL_X - RAIL_STOP;
    const eastStop = RAIL_X + RAIL_STOP;
    const fx = Math.cos(now.angle);
    // Jeśli pojazd już wjechał na przejazd — ewakuuj, nie zatrzymuj go na torach!
    if (now.x > westStop - 12 && now.x < eastStop + 12) return false;

    // →W (zjazd na zachód): pojazd jest przed wschodnią linią stop i planuje wjechać
    if (fx < -0.2 && now.x >= eastStop - 5 && now.x <= eastStop + 75) {
      const exitBlocked = this.vehicles.some((o) => {
        if (o.id === v.id) return false;
        const os = o.path.sample(Math.min(1, o.progress));
        const ofy = Math.cos(os.angle);
        return (
          ofy < -0.2 &&
          Math.abs(os.y - now.y) < 14 && // ten sam pas ruchu
          os.x <= westStop + 20 &&
          os.x >= westStop - 75
        );
      });
      if (exitBlocked) return true;
    }

    // →E (wjazd od zachodu): pojazd jest przed zachodnią linią stop i planuje wjechać
    if (fx > 0.2 && now.x <= westStop + 5 && now.x >= westStop - 75) {
      const exitBlocked = this.vehicles.some((o) => {
        if (o.id === v.id) return false;
        const os = o.path.sample(Math.min(1, o.progress));
        const ofy = Math.cos(os.angle);
        return (
          ofy > 0.2 &&
          Math.abs(os.y - now.y) < 14 && // ten sam pas ruchu
          os.x >= eastStop - 20 &&
          os.x <= eastStop + 75
        );
      });
      if (exitBlocked) return true;
    }

    return false;
  }

  private clampRailGates(v: VehicleActor, next: number): number {
    if (!this.railThreat()) return next;
    const now = v.path.sample(Math.min(1, v.progress));
    const westStop = RAIL_X - RAIL_STOP;
    const eastStop = RAIL_X + RAIL_STOP;
    const fx = Math.cos(now.angle);
    // Ewakuacja: jeśli pojazd już minął linię wjazdową — nie zaciskaj rogatek, pozwól zjechać!
    if (fx < -0.2 && now.x < eastStop + 10) return next;
    if (fx > 0.2 && now.x > westStop - 10) return next;

    const clampAt = (gate: number | null) => {
      if (gate == null) return next;
      if (v.progress <= gate + 0.012 && next > gate) return gate;
      return next;
    };
    next = clampAt(v.railGateIn);
    next = clampAt(v.railGateOut);
    return next;
  }

  /** Tram W↔E: stop przed belką; jeśli już między belkami przy pociągu — jedź dalej (ewakuacja). */
  private advanceTramPastRail(t: number, dir: 1 | -1, next: number): number {
    if (!this.railThreat()) return next;
    const MX = 240;
    const span = this.layout.width + 2 * MX;
    const halfLen = 52;
    const westT = (RAIL_X - RAIL_STOP - halfLen + MX) / span;
    const eastT = (RAIL_X + RAIL_STOP + halfLen + MX) / span;
    const x = this.tramMapX(t);
    const west = RAIL_X - RAIL_STOP;
    const east = RAIL_X + RAIL_STOP;
    const between = x > west - halfLen && x < east + halfLen;
    if (between) {
      // Ewakuacja: nie wracaj za belkę w stronę pociągu
      return next;
    }
    if (dir > 0 && t <= westT + 0.02 && next > westT) return westT;
    if (dir < 0 && t >= eastT - 0.02 && next < eastT) return eastT;
    return next;
  }

  private pedAabbs(): { id: string; box: ReturnType<typeof aabbFromCenter> }[] {
    return this.peds
      .filter((p) => !p.done)
      .map((p) => ({
        id: p.id,
        box: aabbFromCenter(p.x, p.y, 8, 8, 0),
      }));
  }

  private trainAabb(): {
    id: string;
    box: ReturnType<typeof aabbFromCenter>;
  } | null {
    if (this.trainT < 0.02 || this.trainT > 0.98) return null;
    const y = this.trainY();
    // Pociąg w okolicy jezdni W–E — zawsze hitbox do kolizji
    if (Math.abs(y - this.layout.cy) > this.layout.arms[0].halfWidth + 110)
      return null;
    return { id: "train", box: aabbFromCenter(RAIL_X, y, 24, 100, 0) };
  }

  /** Hitboxy zamkniętych rogatek (belka w poprzek jezdni). */
  private barrierAabbs(): {
    id: string;
    box: ReturnType<typeof aabbFromCenter>;
  }[] {
    if (!this.barriersDown) return [];
    const L = this.layout;
    const hw = L.arms[0].halfWidth;
    const westStop = RAIL_X - RAIL_STOP;
    const eastStop = RAIL_X + RAIL_STOP;
    return [
      {
        id: "barrier-W",
        box: aabbFromCenter(westStop, L.cy, 14, 2 * hw - 8, 0),
      },
      {
        id: "barrier-E",
        box: aabbFromCenter(eastStop, L.cy, 14, 2 * hw - 8, 0),
      },
    ];
  }

  private pedOnArmZebra(arm: Cardinal): boolean {
    const L = this.layout;
    return this.peds.some((p) => {
      if (p.done || !p.crossing) return false;
      const onStrip =
        arm === "north" || arm === "south"
          ? !p.vertical && p.x > p.minX + 4 && p.x < p.maxX - 4
          : p.vertical && p.y > p.minY + 4 && p.y < p.maxY - 4;
      if (!onStrip) return false;
      if (arm === "north") return p.y < L.cy - L.ringOuter;
      if (arm === "south") return p.y > L.cy + L.ringOuter;
      if (arm === "west") return p.x < L.cx - L.ringOuter;
      return p.x > L.cx + L.ringOuter;
    });
  }

  private pedBlocksVehicle(v: VehicleActor): boolean {
    // Piesi blokują tylko przed stopem / na zjeździe — nie auto już na pierścieniu
    const beforeStop = v.progress <= v.stopProgress + 0.02;
    const nearExit = v.progress >= 0.72;
    if (beforeStop && this.pedOnArmZebra(v.entry)) return true;
    if (nearExit && this.pedOnArmZebra(v.exit)) return true;
    return false;
  }

  private checkCollisions() {
    this.collisionMsgs = [];
    type Hit = {
      id: string;
      box: ReturnType<typeof aabbFromCenter>;
      entry?: Cardinal;
      x: number;
      y: number;
      angle: number;
    };
    const cars: Hit[] = this.vehicles.map((v) => {
      const s = v.path.sample(Math.min(1, v.progress));
      return {
        id: v.id,
        entry: v.entry,
        x: s.x,
        y: s.y,
        angle: s.angle,
        box: aabbFromCenter(s.x, s.y, 10, 18, s.angle - Math.PI / 2),
      };
    });
    const tramsTraffic: Hit[] = this.tramAabbs("traffic").map((t) => ({
      id: t.id,
      box: t.box,
      x: t.x,
      y: t.y,
      angle: 0,
    }));
    const tramsFull: Hit[] = this.tramAabbs("full").map((t) => ({
      id: t.id,
      box: t.box,
      x: t.x,
      y: t.y,
      angle: 0,
    }));

    const rawHits = new Set<string>();
    const reportPair = (a: Hit, b: Hit) => {
      if (!aabbOverlap(a.box, b.box)) return;
      const tramPair = a.id.startsWith("tram-") && b.id.startsWith("tram-");
      if (tramPair) {
        const weAxis = (id: string) => id === "tram-EW" || id === "tram-WE";
        const nsAxis = (id: string) => id === "tram-NS" || id === "tram-SN";
        if (weAxis(a.id) && weAxis(b.id)) return;
        if (nsAxis(a.id) && nsAxis(b.id)) return;
        const turnPair =
          (a.id === "tram-TURN" &&
            (b.id === "tram-EW" || b.id === "tram-NS" || b.id === "tram-SN")) ||
          (b.id === "tram-TURN" &&
            (a.id === "tram-EW" || a.id === "tram-NS" || a.id === "tram-SN"));
        if (turnPair) return;
      }
      const fx = Math.cos(a.angle);
      const fy = Math.sin(a.angle);
      const side = Math.abs(-(b.x - a.x) * fy + (b.y - a.y) * fx);
      const ahead = (b.x - a.x) * fx + (b.y - a.y) * fy;
      // Sąsiedni pas tego samego wlotu — nie alarmuj
      if (a.entry && a.entry === b.entry) {
        if (side > 16 && Math.abs(ahead) < 22) return;
      }
      // Różne wloty, równoległe pasy pierścienia (np. nL R155 vs sR R205) — otarcie AABB OK
      if (a.entry && b.entry && a.entry !== b.entry) {
        const ra = Math.hypot(a.x - this.layout.cx, a.y - this.layout.cy);
        const rb = Math.hypot(b.x - this.layout.cx, b.y - this.layout.cy);
        if (Math.abs(ra - rb) > 18 && side > 14) return;
        if (side > 24 && Math.abs(ahead) < 36) return;
      }
      rawHits.add(`${a.id} × ${b.id}`);
    };

    for (let i = 0; i < cars.length; i++) {
      for (let j = i + 1; j < cars.length; j++) reportPair(cars[i], cars[j]);
    }
    for (const c of cars) {
      for (const t of tramsTraffic) {
        // Otarcia pasa obok toru — nie pauzuj; tylko realny nalot na pudło
        if (Math.hypot(c.x - t.x, c.y - t.y) > 36) continue;
        reportPair(c, t);
      }
    }
    for (let i = 0; i < tramsFull.length; i++) {
      for (let j = i + 1; j < tramsFull.length; j++)
        reportPair(tramsFull[i], tramsFull[j]);
    }
    const train = this.trainAabb();
    if (train) {
      const th = { ...train, x: RAIL_X, y: this.trainY(), angle: 0 };
      for (const c of cars) reportPair(c, th);
      for (const t of tramsFull) reportPair(t, th);
    }
    const westStop = RAIL_X - RAIL_STOP;
    const eastStop = RAIL_X + RAIL_STOP;
    const hw = this.layout.arms[0].halfWidth;
    for (const bar of this.barrierAabbs()) {
      const bx = bar.box.x + bar.box.w / 2;
      const by = bar.box.y + bar.box.h / 2;
      const bh = { id: bar.id, box: bar.box, x: bx, y: by, angle: 0 };
      for (const c of cars) {
        const onArm = Math.abs(c.y - this.layout.cy) < hw + 22;
        // Na przejeździe / przy linii stop — stój, nie raportuj „kolizji z belką”
        if (onArm && c.x > westStop - 40 && c.x < eastStop + 40) continue;
        if (
          onArm &&
          (Math.abs(c.x - westStop) < 36 || Math.abs(c.x - eastStop) < 36)
        )
          continue;
        reportPair(c, bh);
      }
      for (const t of tramsFull) {
        // Tram stojący PRZED belką — AABB może stykać krawędź; to nie kolizja na torach
        if (t.x + 40 < westStop - 2 || t.x - 40 > eastStop + 2) continue;
        reportPair(t, bh);
      }
    }
    const peds = this.pedAabbs().map((p) => ({
      ...p,
      x: p.box.x + p.box.w / 2,
      y: p.box.y + p.box.h / 2,
      angle: 0,
    }));
    for (const ped of peds) {
      for (const c of cars) reportPair(c, ped);
      for (const t of tramsFull) reportPair(t, ped);
      if (train)
        reportPair(ped, { ...train, x: RAIL_X, y: this.trainY(), angle: 0 });
      for (const bar of this.barrierAabbs()) {
        reportPair(ped, {
          id: bar.id,
          box: bar.box,
          x: bar.box.x + bar.box.w / 2,
          y: bar.box.y + bar.box.h / 2,
          angle: 0,
        });
      }
    }

    const nextStreak = new Map<string, number>();
    for (const key of rawHits) {
      const n = (this.collisionStreak.get(key) || 0) + 1;
      nextStreak.set(key, n);
      // 3 klatki ≈ 50ms — pauza od razu do oglądania hitboxów
      if (n >= 3) this.collisionMsgs.push(key);
    }
    this.collisionStreak = nextStreak;
    if (this.collisionMsgs.length && this.running) {
      this.running = false;
      this.debug = true;
      this.stageApp.setDebug(true);
      this.onPausedByCollision?.();
    }
  }

  private syncSignals() {
    this.layout.signals.forEach((spec) => {
      const node = this.stageApp.signalNodes.get(spec.id);
      if (!node) return;
      const state = resolveSignal(this.dfa, this.stateIndex, spec.role);
      node.setSignalState(state);
      const sec = signalCountdownSec(
        this.dfa,
        this.stateIndex,
        this.stateRemaining,
        spec.role,
      );
      node.setCountdown(sec > 0.05 ? sec : 0);
    });
    this.stageApp.layers.signals.batchDraw();
  }

  private drawDebug() {
    if (!this.debug) return;
    const dbg = this.stageApp.layers.debug;
    dbg.destroyChildren();
    const L = this.layout;
    // Ring lane centerlines
    L.ringLanes.forEach((r) => {
      dbg.add(
        new Konva.Circle({
          x: L.cx,
          y: L.cy,
          radius: r,
          stroke: "rgba(250,204,21,0.35)",
          strokeWidth: 1,
          listening: false,
        }),
      );
    });
    // Active signal highlight
    L.signals.forEach((spec) => {
      const state = resolveSignal(this.dfa, this.stateIndex, spec.role);
      if (!isSignalGreen(state)) return;
      dbg.add(
        new Konva.Circle({
          x: spec.x,
          y: spec.y,
          radius: 22,
          stroke: "#22c55e",
          strokeWidth: 2,
          listening: false,
        }),
      );
    });
    this.tramAabbs("full").forEach((t) => {
      const hit = this.collisionMsgs.some((m) => m.includes(t.id));
      dbg.add(
        new Konva.Rect({
          x: t.box.x,
          y: t.box.y,
          width: t.box.w,
          height: t.box.h,
          fill: hit ? "rgba(239,68,68,0.25)" : "rgba(34,211,238,0.2)",
          stroke: hit ? "#ef4444" : "#22d3ee",
          strokeWidth: 2.5,
          listening: false,
        }),
      );
    });
    const trainDbg = this.trainAabb();
    if (trainDbg) {
      dbg.add(
        new Konva.Rect({
          x: trainDbg.box.x,
          y: trainDbg.box.y,
          width: trainDbg.box.w,
          height: trainDbg.box.h,
          stroke: this.collisionMsgs.some((m) => m.includes("train"))
            ? "#ef4444"
            : "#f59e0b",
          strokeWidth: 2,
          listening: false,
        }),
      );
    }
    this.barrierAabbs().forEach((b) => {
      dbg.add(
        new Konva.Rect({
          x: b.box.x,
          y: b.box.y,
          width: b.box.w,
          height: b.box.h,
          stroke: this.collisionMsgs.some((m) => m.includes(b.id))
            ? "#ef4444"
            : "#f97316",
          strokeWidth: 2,
          listening: false,
        }),
      );
    });
    this.pedAabbs().forEach((p) => {
      dbg.add(
        new Konva.Rect({
          x: p.box.x,
          y: p.box.y,
          width: p.box.w,
          height: p.box.h,
          stroke: this.collisionMsgs.some((m) => m.includes(p.id))
            ? "#ef4444"
            : "#34d399",
          strokeWidth: 1.5,
          listening: false,
        }),
      );
    });
    this.vehicles.forEach((v) => {
      const s = v.path.sample(Math.min(1, v.progress));
      const box = aabbFromCenter(s.x, s.y, 16, 30, s.angle - Math.PI / 2);
      dbg.add(
        new Konva.Rect({
          x: box.x,
          y: box.y,
          width: box.w,
          height: box.h,
          stroke: this.collisionMsgs.some((m) => m.includes(v.id))
            ? "#ef4444"
            : "#38bdf8",
          strokeWidth: 1.5,
          listening: false,
        }),
      );
      const stop = v.path.sample(v.stopProgress);
      dbg.add(
        new Konva.Circle({
          x: stop.x,
          y: stop.y,
          radius: 4,
          fill: "#fbbf24",
          listening: false,
        }),
      );
      const pts: number[] = [];
      for (let t = 0; t <= 1.001; t += 0.02) {
        const p = v.path.sample(t);
        pts.push(p.x, p.y);
      }
      dbg.add(
        new Konva.Line({
          points: pts,
          stroke: "rgba(56,189,248,0.45)",
          strokeWidth: 1.5,
          listening: false,
        }),
      );
    });
    dbg.batchDraw();
  }

  private buildHud(): SimHud {
    const st = this.dfa?.states?.[this.stateIndex];
    const chips: SimHud["chips"] = [];
    if (st?.outputs) {
      const roleOf = (name: string) => {
        const lk = name.toLowerCase();
        if (lk.includes("polnoc")) return "NORTH";
        if (lk.includes("poludnie")) return "SOUTH";
        if (lk.includes("zachod")) return "WEST";
        if (lk.includes("wschod")) return "EAST";
        if (lk.includes("_we")) return "TRAM_WE";
        if (lk.includes("_ns")) return "TRAM_NS";
        if (lk.includes("pies")) return "PEDESTRIAN";
        return "";
      };
      // Stała kolejność: wloty → piesi → tramwaje
      const order = (name: string) => {
        const r = roleOf(name);
        const rank: Record<string, number> = {
          WEST: 1,
          EAST: 2,
          SOUTH: 3,
          NORTH: 4,
          PEDESTRIAN: 5,
          TRAM_WE: 6,
          TRAM_NS: 7,
        };
        return rank[r] ?? 50;
      };
      Object.entries(st.outputs)
        .sort((a, b) => order(a[0]) - order(b[0]))
        .forEach(([name, sig]) => {
          const roleGuess = roleOf(name);
          const countdown = roleGuess
            ? signalCountdownSec(
                this.dfa,
                this.stateIndex,
                this.stateRemaining,
                roleGuess,
              )
            : undefined;
          chips.push({
            name,
            label: labelForSignal(sig),
            cls: chipClass(sig),
            countdown: countdown && countdown > 0.05 ? countdown : undefined,
          });
        });
    }
    // PKP — nie ma w DFA, stan z rogatek / pociągu
    chips.push({
      name: "PKP_Przejazd",
      label: this.railHudStop ? "CZERW." : "ZIEL.",
      cls: this.railHudStop ? "red" : "green",
      countdown:
        this.railHudCountdown > 0.05 ? this.railHudCountdown : undefined,
    });
    return {
      stateId: st?.id || `q${this.stateIndex}`,
      stepLabel: `${this.stateIndex + 1} / ${this.dfa?.states.length || 0}`,
      timeLeft: `${Math.max(0, this.stateRemaining).toFixed(1)} s`,
      cycles: String(this.cycles),
      progress:
        this.stateTotal > 0 ? 1 - this.stateRemaining / this.stateTotal : 0,
      chips,
      collisions: this.collisionMsgs,
    };
  }
}
