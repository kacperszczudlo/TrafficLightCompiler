import Konva from "konva";
import type { RoundaboutLayout } from "./layouts/types";
import {
  buildArmLaneDashes,
  buildRingLaneLines,
  buildStopLine,
  buildYieldLine,
  buildZebra,
  placeArmArrows,
  ASPHALT,
} from "./components/markings";
import { createSignalNode, type SignalNode } from "./components/signals";

export interface StageLayers {
  grass: Konva.Layer;
  asphalt: Konva.Layer;
  tracks: Konva.Layer;
  markings: Konva.Layer;
  signals: Konva.Layer;
  actors: Konva.Layer;
  debug: Konva.Layer;
}

export class StageApp {
  readonly stage: Konva.Stage;
  readonly layers: StageLayers;
  readonly signalNodes = new Map<string, SignalNode>();
  layout: RoundaboutLayout;

  constructor(container: HTMLDivElement, layout: RoundaboutLayout) {
    this.layout = layout;
    this.stage = new Konva.Stage({
      container,
      width: layout.width,
      height: layout.height,
    });
    this.layers = {
      grass: new Konva.Layer({ name: "grass" }),
      asphalt: new Konva.Layer({ name: "asphalt" }),
      tracks: new Konva.Layer({ name: "tracks" }),
      markings: new Konva.Layer({ name: "markings" }),
      signals: new Konva.Layer({ name: "signals" }),
      actors: new Konva.Layer({ name: "actors" }),
      debug: new Konva.Layer({ name: "debug", visible: false }),
    };
    Object.values(this.layers).forEach((l) => this.stage.add(l));
    this.rebuildStatic();
    this.fitToParent(container);
  }

  fitToParent(container: HTMLDivElement) {
    const resize = () => {
      const rect = container.getBoundingClientRect();
      if (rect.width < 40 || rect.height < 40) return;
      // Stage = cały panel; layout contain + wyśrodkowany (bleed ramion sięga krawędzi).
      const scale = Math.min(
        rect.width / this.layout.width,
        rect.height / this.layout.height,
      );
      this.stage.width(rect.width);
      this.stage.height(rect.height);
      this.stage.scale({ x: scale, y: scale });
      this.stage.position({
        x: (rect.width - this.layout.width * scale) / 2,
        y: (rect.height - this.layout.height * scale) / 2,
      });
      this.stage.batchDraw();
    };
    resize();
    requestAnimationFrame(resize);
    window.addEventListener("resize", resize);
    if (typeof ResizeObserver !== "undefined") {
      new ResizeObserver(resize).observe(container);
    }
  }

  setDebug(enabled: boolean) {
    this.layers.debug.visible(enabled);
    this.layers.debug.batchDraw();
  }

  rebuildStatic() {
    const L = this.layout;
    const { cx, cy } = L;
    Object.values(this.layers).forEach((layer) => {
      if (layer !== this.layers.actors && layer !== this.layers.debug) {
        layer.destroyChildren();
      }
    });
    this.signalNodes.clear();

    // Bleed: prostokątne ramiona wychodzą poza layout → sięgają krawędzi panelu.
    const BLEED = 800;
    this.layers.grass.add(
      new Konva.Rect({
        x: -BLEED,
        y: -BLEED,
        width: L.width + BLEED * 2,
        height: L.height + BLEED * 2,
        fill: "#131b15",
        listening: false,
      }),
    );

    // Prostokątny krzyż + koło (bez trapezów) — ciągły asfalt na styku.
    const asphaltG = new Konva.Group({ listening: false });
    const hw0 = L.arms[0]?.halfWidth ?? 90;
    asphaltG.add(
      new Konva.Rect({
        x: cx - hw0,
        y: -BLEED,
        width: hw0 * 2,
        height: L.height + BLEED * 2,
        fill: ASPHALT,
        listening: false,
      }),
    );
    asphaltG.add(
      new Konva.Rect({
        x: -BLEED,
        y: cy - hw0,
        width: L.width + BLEED * 2,
        height: hw0 * 2,
        fill: ASPHALT,
        listening: false,
      }),
    );
    asphaltG.add(
      new Konva.Circle({
        x: cx,
        y: cy,
        radius: L.ringOuter,
        fill: ASPHALT,
        listening: false,
      }),
    );
    // Clover: obetnij zielenią zewnętrzne narożniki krzyża (poza pierścieniem)
    const pad = L.cloverPad;
    (
      [
        [cx - L.ringOuter, cy - L.ringOuter],
        [cx + L.ringOuter, cy - L.ringOuter],
        [cx - L.ringOuter, cy + L.ringOuter],
        [cx + L.ringOuter, cy + L.ringOuter],
      ] as [number, number][]
    ).forEach(([px, py], i) => {
      const qx = i % 2 === 0 ? -1 : 1;
      const qy = i < 2 ? -1 : 1;
      asphaltG.add(
        new Konva.Arc({
          x: px,
          y: py,
          innerRadius: 0,
          outerRadius: pad,
          angle: 90,
          rotation:
            qx < 0 && qy < 0
              ? 180
              : qx > 0 && qy < 0
                ? 270
                : qx < 0 && qy > 0
                  ? 90
                  : 0,
          fill: "#131b15",
          listening: false,
        }),
      );
    });
    // Island
    asphaltG.add(
      new Konva.Circle({
        x: cx,
        y: cy,
        radius: L.islandR,
        fill: "#1a271f",
        stroke: "#2e4334",
        strokeWidth: 2,
      }),
    );
    // Wyspy rozdzielające wlot/wylot — dłuższe, żeby rondo wyglądało na podzielone (jak schemat)
    L.arms.forEach((arm) => {
      const base = arm.medianHalf + 2;
      const tipIn = 22;
      const tipOut = 48;
      const pts: number[] = [];
      if (arm.dir === "north") {
        pts.push(
          cx - base,
          cy - L.ringOuter - tipOut,
          cx + base,
          cy - L.ringOuter - tipOut,
          cx + base * 0.35,
          cy - L.ringOuter + tipIn,
          cx - base * 0.35,
          cy - L.ringOuter + tipIn,
        );
      } else if (arm.dir === "south") {
        pts.push(
          cx - base,
          cy + L.ringOuter + tipOut,
          cx + base,
          cy + L.ringOuter + tipOut,
          cx + base * 0.35,
          cy + L.ringOuter - tipIn,
          cx - base * 0.35,
          cy + L.ringOuter - tipIn,
        );
      } else if (arm.dir === "west") {
        pts.push(
          cx - L.ringOuter - tipOut,
          cy - base,
          cx - L.ringOuter - tipOut,
          cy + base,
          cx - L.ringOuter + tipIn,
          cy + base * 0.35,
          cx - L.ringOuter + tipIn,
          cy - base * 0.35,
        );
      } else {
        pts.push(
          cx + L.ringOuter + tipOut,
          cy - base,
          cx + L.ringOuter + tipOut,
          cy + base,
          cx + L.ringOuter - tipIn,
          cy + base * 0.35,
          cx + L.ringOuter - tipIn,
          cy - base * 0.35,
        );
      }
      asphaltG.add(
        new Konva.Line({
          points: pts,
          closed: true,
          fill: "#1a271f",
          stroke: "#2e4334",
          strokeWidth: 1.5,
        }),
      );
    });
    this.layers.asphalt.add(asphaltG);

    // Przejazd kolejowy (lewa strona) — tory N–S + krzyż św. Andrzeja
    const railX = 72;
    const TB = 800;
    [-6, 6].forEach((o) => {
      this.layers.tracks.add(
        new Konva.Line({
          points: [railX + o, -TB, railX + o, L.height + TB],
          stroke: "#374151",
          strokeWidth: 3,
          listening: false,
        }),
      );
    });
    for (let y = -TB; y < L.height + TB; y += 28) {
      this.layers.tracks.add(
        new Konva.Line({
          points: [railX - 14, y, railX + 14, y],
          stroke: "#4b5563",
          strokeWidth: 2,
          listening: false,
        }),
      );
    }
    // Krzyż ostrzegawczy przy wlocie W
    const crossY = L.cy - L.arms[0].halfWidth - 36;
    this.layers.markings.add(
      new Konva.Text({
        x: railX - 48,
        y: crossY,
        width: 40,
        text: "×",
        fontSize: 28,
        fontStyle: "bold",
        fill: "#f8fafc",
        align: "center",
        listening: false,
      }),
    );

    // Tracks tramwajowe (też z bleedem — widać do krawędzi panelu)
    L.tracks.forEach((t) => {
      if (t.kind === "we" && t.y != null && t.offsets) {
        t.offsets.forEach((o) => {
          this.layers.tracks.add(
            new Konva.Line({
              points: [-TB, t.y! + o, L.width + TB, t.y! + o],
              stroke: "#212121",
              strokeWidth: 2.2,
              listening: false,
            }),
          );
        });
      } else if (t.kind === "ns" && t.x != null && t.offsets) {
        t.offsets.forEach((o) => {
          this.layers.tracks.add(
            new Konva.Line({
              points: [t.x! + o, -TB, t.x! + o, L.height + TB],
              stroke: "#212121",
              strokeWidth: 2.2,
              listening: false,
            }),
          );
        });
      } else if (
        t.kind === "arc" &&
        t.cx != null &&
        t.cy != null &&
        t.r != null &&
        t.a0 != null &&
        t.a1 != null
      ) {
        const pts: number[] = [];
        const steps = 24;
        for (let i = 0; i <= steps; i++) {
          const a = t.a0 + ((t.a1 - t.a0) * i) / steps;
          pts.push(t.cx + Math.cos(a) * t.r, t.cy + Math.sin(a) * t.r);
        }
        this.layers.tracks.add(
          new Konva.Line({
            points: pts,
            stroke: "#212121",
            strokeWidth: 2.2,
            listening: false,
          }),
        );
      }
    });

    // Markings (czerwone spirale ze schematu — tylko w debug, nie na jezdni na stałe)
    this.layers.markings.add(buildRingLaneLines(L));
    L.arms.forEach((arm) => {
      this.layers.markings.add(buildArmLaneDashes(L, arm));
      this.layers.markings.add(placeArmArrows(L, arm));
    });
    L.zebras.forEach((z) => {
      const arm = L.arms.find((a) => a.dir === z.dir)!;
      this.layers.markings.add(buildZebra(L, z, arm));
    });
    L.stops.forEach((s) => {
      const arm = L.arms.find((a) => a.dir === s.dir)!;
      this.layers.markings.add(buildStopLine(L, s, arm));
      this.layers.markings.add(buildYieldLine(L, s, arm));
    });

    // Signals
    L.signals.forEach((spec) => {
      const node = createSignalNode(spec) as SignalNode;
      node.setSignalState("CZERWONE");
      this.signalNodes.set(spec.id, node);
      this.layers.signals.add(node);
    });

    this.layers.grass.batchDraw();
    this.layers.asphalt.batchDraw();
    this.layers.tracks.batchDraw();
    this.layers.markings.batchDraw();
    this.layers.signals.batchDraw();
  }

  clearActors() {
    this.layers.actors.destroyChildren();
    this.layers.actors.batchDraw();
  }

  clearDebug() {
    this.layers.debug.destroyChildren();
    this.layers.debug.batchDraw();
  }
}
