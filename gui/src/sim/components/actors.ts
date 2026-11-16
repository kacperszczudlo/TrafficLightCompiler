import Konva from "konva";

export type Blinker = "none" | "left" | "right";

export function createCar(color: string, id: string): Konva.Group {
  const g = new Konva.Group({ name: `car-${id}`, listening: false });
  const hw = 8;
  const hl = 15;
  g.add(
    new Konva.Rect({
      x: -hw,
      y: -hl,
      width: hw * 2,
      height: hl * 2,
      fill: color,
      stroke: "#0f172a",
      strokeWidth: 1.4,
      cornerRadius: 2,
      name: "body",
    }),
  );
  g.add(
    new Konva.Rect({
      x: -6,
      y: -8,
      width: 12,
      height: 14,
      fill: "#0f172a",
    }),
  );
  g.add(
    new Konva.Rect({
      x: -5,
      y: 8,
      width: 10,
      height: 4,
      fill: "#38bdf8",
    }),
  );
  // Tylne światła
  g.add(new Konva.Rect({ x: -hw + 1, y: -hl, width: 4, height: 2, fill: "#ef4444" }));
  g.add(new Konva.Rect({ x: hw - 5, y: -hl, width: 4, height: 2, fill: "#ef4444" }));
  // Reflektory
  g.add(new Konva.Rect({ x: -hw + 2, y: hl - 2, width: 3, height: 1.5, fill: "#94a3b8" }));
  g.add(new Konva.Rect({ x: hw - 5, y: hl - 2, width: 3, height: 1.5, fill: "#94a3b8" }));
  // Kierunkowskazy (local: +Y = przód; −X = prawa strona po rotate)
  g.add(
    new Konva.Rect({
      x: -hw - 2,
      y: hl - 5,
      width: 4,
      height: 5,
      fill: "#f59e0b",
      visible: false,
      name: "blink-right-f",
      shadowColor: "#fbbf24",
      shadowBlur: 8,
    }),
  );
  g.add(
    new Konva.Rect({
      x: -hw - 2,
      y: -hl,
      width: 4,
      height: 5,
      fill: "#f59e0b",
      visible: false,
      name: "blink-right-r",
      shadowColor: "#fbbf24",
      shadowBlur: 8,
    }),
  );
  g.add(
    new Konva.Rect({
      x: hw - 2,
      y: hl - 5,
      width: 4,
      height: 5,
      fill: "#f59e0b",
      visible: false,
      name: "blink-left-f",
      shadowColor: "#fbbf24",
      shadowBlur: 8,
    }),
  );
  g.add(
    new Konva.Rect({
      x: hw - 2,
      y: -hl,
      width: 4,
      height: 5,
      fill: "#f59e0b",
      visible: false,
      name: "blink-left-r",
      shadowColor: "#fbbf24",
      shadowBlur: 8,
    }),
  );
  return g;
}

export function setCarBlinker(node: Konva.Group, blinker: Blinker, lit: boolean) {
  const showL = blinker === "left" && lit;
  const showR = blinker === "right" && lit;
  node.findOne(".blink-left-f")?.visible(showL);
  node.findOne(".blink-left-r")?.visible(showL);
  node.findOne(".blink-right-f")?.visible(showR);
  node.findOne(".blink-right-r")?.visible(showR);
}

export function createTram(id: string): Konva.Group {
  const g = new Konva.Group({ name: `tram-${id}`, listening: false });
  g.add(
    new Konva.Rect({
      x: -42,
      y: -11,
      width: 84,
      height: 22,
      fill: "#1d4ed8",
      stroke: "#1e3a8a",
      strokeWidth: 1.4,
      cornerRadius: 3,
    }),
  );
  g.add(
    new Konva.Rect({
      x: -38,
      y: -8,
      width: 76,
      height: 16,
      fill: "#ffffff",
    }),
  );
  for (let ox = -32; ox < 32; ox += 14) {
    g.add(
      new Konva.Rect({
        x: ox,
        y: -5,
        width: 9,
        height: 10,
        fill: "#0f172a",
      }),
    );
  }
  return g;
}

export function createPedestrian(id: string): Konva.Group {
  const g = new Konva.Group({ name: `ped-${id}`, listening: false });
  g.add(
    new Konva.Circle({
      x: 0,
      y: 0,
      radius: 6,
      fill: "#fbbf24",
      stroke: "#0f172a",
      strokeWidth: 1.5,
    }),
  );
  return g;
}

/** Pose car so local +Y is forward (matches path angle from atan2). */
export function poseActor(node: Konva.Group, x: number, y: number, angle: number) {
  node.position({ x, y });
  node.rotation(((angle - Math.PI / 2) * 180) / Math.PI);
}

/** Tram mesh is long along local +X — travel angle is that axis (not car +Y). */
export function poseTram(node: Konva.Group, x: number, y: number, angle: number) {
  node.position({ x, y });
  node.rotation((angle * 180) / Math.PI);
}
