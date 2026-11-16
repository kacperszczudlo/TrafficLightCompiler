import Konva from "konva";
import type { SignalSpec } from "../layouts/types";

function isLit(state: string, color: "red" | "yellow" | "green"): boolean {
  const s = (state || "RED").toUpperCase();
  if (color === "red") {
    return (
      s.includes("RED") ||
      s.includes("CZERWONE") ||
      s.includes("STOJ") ||
      s.includes("STOP")
    );
  }
  if (color === "yellow") {
    return (
      s.includes("YELLOW") ||
      s.includes("ZOLTE") ||
      s.includes("UWAGA") ||
      s.includes("ATTENTION")
    );
  }
  return (
    s.includes("GREEN") ||
    s.includes("ZIELONE") ||
    s.includes("JAZDA") ||
    s.includes("GO")
  );
}

function addPoleUp(g: Konva.Group, footY: number, headBottom: number) {
  g.add(
    new Konva.Circle({
      x: 0,
      y: footY,
      radius: 5,
      fill: "#64748b",
      listening: false,
    }),
  );
  g.add(
    new Konva.Rect({
      x: -3,
      y: headBottom,
      width: 6,
      height: footY - headBottom,
      fill: "#475569",
      stroke: "#334155",
      strokeWidth: 1,
      listening: false,
    }),
  );
}

/** Same sekundy (np. „12”), bez strzałek / myślników. */
function attachCountdown(g: Konva.Group, y: number): (sec: number | null) => void {
  const countdown = new Konva.Text({
    x: -28,
    y,
    width: 56,
    text: "",
    fontSize: 14,
    fontStyle: "bold",
    fill: "#fbbf24",
    align: "center",
    shadowColor: "#000",
    shadowBlur: 3,
    name: "countdown",
  });
  g.add(countdown);
  return (sec: number | null) => {
    if (sec == null || sec <= 0) {
      countdown.text("");
      return;
    }
    countdown.text(String(Math.ceil(sec)));
  };
}

export function createSignalNode(spec: SignalSpec): SignalNode {
  const g = new Konva.Group({
    x: spec.x,
    y: spec.y,
    name: `signal-${spec.id}`,
    listening: false,
  }) as SignalNode;

  if (spec.kind === "tram") {
    const axis = (spec.label || "").toUpperCase();
    const isNS = axis.includes("N");
    const headH = 52;
    const poleH = 22;
    const headBottom = -poleH;
    const headTop = headBottom - headH;
    g.add(
      new Konva.Rect({
        x: -18,
        y: headTop,
        width: 36,
        height: headH,
        fill: "#0f172a",
        stroke: "#38bdf8",
        strokeWidth: 2,
        cornerRadius: 4,
      }),
    );
    g.add(
      new Konva.Text({
        x: -16,
        y: headTop + 4,
        width: 32,
        text: "TRAM",
        fontSize: 9,
        fontStyle: "bold",
        fill: "#7dd3fc",
        align: "center",
      }),
    );
    g.add(
      new Konva.Text({
        x: -16,
        y: headTop + 16,
        width: 32,
        text: isNS ? "N↔S" : "W↔E",
        fontSize: 11,
        fontStyle: "bold",
        fill: "#f8fafc",
        align: "center",
      }),
    );
    const bar = new Konva.Rect({
      x: -12,
      y: headTop + 34,
      width: 24,
      height: 7,
      fill: "#ef4444",
      cornerRadius: 2,
      name: "tram-bar",
    });
    g.add(bar);
    const status = new Konva.Text({
      x: -16,
      y: headTop + 44,
      width: 32,
      text: "CZERW.",
      fontSize: 9,
      fontStyle: "bold",
      fill: "#ef4444",
      align: "center",
      name: "tram-status",
    });
    g.add(status);
    addPoleUp(g, 0, headBottom);
    if (spec.label) {
      g.add(
        new Konva.Text({
          x: -28,
          y: 8,
          width: 56,
          text: spec.label,
          fontSize: 9,
          fontStyle: "bold",
          fill: "#e2e8f0",
          align: "center",
        }),
      );
    }
    g.setCountdown = attachCountdown(g, spec.label ? 20 : 8);
    g.setSignalState = (state: string) => {
      const go = isLit(state, "green");
      const warn = isLit(state, "yellow");
      bar.fill(go ? "#22c55e" : warn ? "#fbbf24" : "#ef4444");
      status.text(go ? "ZIEL." : warn ? "ŻÓŁ." : "CZERW.");
      status.fill(go ? "#22c55e" : warn ? "#fbbf24" : "#ef4444");
    };
    return g;
  }

  if (spec.kind === "pedestrian") {
    const headH = 44;
    const poleH = 22;
    const headBottom = -poleH;
    const headTop = headBottom - headH;
    g.add(
      new Konva.Rect({
        x: -12,
        y: headTop,
        width: 24,
        height: headH,
        fill: "#0f172a",
        stroke: "#f8fafc",
        strokeWidth: 1.5,
        cornerRadius: 3,
      }),
    );
    const red = new Konva.Circle({
      x: 0,
      y: headTop + 14,
      radius: 6,
      fill: "#ef4444",
      name: "bulb-r",
    });
    const green = new Konva.Circle({
      x: 0,
      y: headTop + 32,
      radius: 6,
      fill: "#1e293b",
      name: "bulb-g",
    });
    g.add(red);
    g.add(green);
    addPoleUp(g, 0, headBottom);
    g.add(
      new Konva.Text({
        x: -22,
        y: 8,
        width: 44,
        text: spec.label || "PIESI",
        fontSize: 9,
        fontStyle: "bold",
        fill: "#f8fafc",
        align: "center",
        shadowColor: "#000",
        shadowBlur: 3,
      }),
    );
    // Timer nad głowicą — zawsze w kadrze (szczególnie pedS przy dolnej krawędzi)
    g.setCountdown = attachCountdown(g, headTop - 16);
    g.setSignalState = (state: string) => {
      const go = isLit(state, "green");
      red.fill(go ? "#1e293b" : "#ef4444");
      green.fill(go ? "#22c55e" : "#1e293b");
      red.shadowBlur(go ? 0 : 8);
      green.shadowBlur(go ? 8 : 0);
      red.shadowColor("#ef4444");
      green.shadowColor("#22c55e");
    };
    return g;
  }

  const w = 20;
  const headH = 52;
  const poleH = 22;
  const headBottom = -poleH;
  const headTop = headBottom - headH;
  g.add(
    new Konva.Rect({
      x: -w / 2,
      y: headTop,
      width: w,
      height: headH,
      fill: "#0f172a",
      stroke: "#94a3b8",
      strokeWidth: 1.4,
      cornerRadius: 2,
    }),
  );
  const bulbs = [
    { y: headTop + 10, c: "red" as const },
    { y: headTop + 26, c: "yellow" as const },
    { y: headTop + 42, c: "green" as const },
  ];
  const nodes = bulbs.map((b) => {
    const c = new Konva.Circle({
      x: 0,
      y: b.y,
      radius: 5.5,
      fill: "#1e293b",
      name: `bulb-${b.c}`,
    });
    g.add(c);
    return { c, color: b.c };
  });
  addPoleUp(g, 0, headBottom);
  if (spec.label) {
    g.add(
      new Konva.Text({
        x: -28,
        y: 8,
        width: 56,
        text: spec.label,
        fontSize: 10,
        fontStyle: "bold",
        fill: "#f8fafc",
        align: "center",
        shadowColor: "#000",
        shadowBlur: 4,
      }),
    );
  }
  g.setCountdown = attachCountdown(g, spec.label ? 22 : 8);
  g.setSignalState = (state: string) => {
    nodes.forEach(({ c, color }) => {
      const on = isLit(state, color);
      const lit =
        color === "red" ? "#ef4444" : color === "yellow" ? "#fbbf24" : "#22c55e";
      c.fill(on ? lit : "#1e293b");
      c.shadowColor(lit);
      c.shadowBlur(on ? 8 : 0);
      c.shadowOpacity(on ? 0.85 : 0);
    });
  };
  return g;
}

export type SignalNode = Konva.Group & {
  setSignalState: (s: string) => void;
  setCountdown: (sec: number | null) => void;
};
