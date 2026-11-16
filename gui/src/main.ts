import "./style.css";
import { StageApp } from "./sim/StageApp";
import { SimRuntime } from "./sim/SimRuntime";
import { AUTORSKIE } from "./sim/layouts/autorskieRondo";
import { compileCode, fetchExamples } from "./api/compileClient";

const ONLY_EXAMPLE = "rondo_autorskie.traffic";

const codeEditor = document.getElementById("codeEditor") as HTMLTextAreaElement;
const compileBtn = document.getElementById("compileBtn") as HTMLButtonElement;
const compilerStatusBadge = document.getElementById("compilerStatusBadge")!;
const currentFileName = document.getElementById("currentFileName")!;
const compilerLogsContainer = document.getElementById("compilerLogsContainer")!;
const targetCodeContainer = document.getElementById("targetCodeContainer")!;
const dfaJsonContainer = document.getElementById("dfaJsonContainer")!;
const downloadCodeBtn = document.getElementById("downloadCodeBtn") as HTMLButtonElement;
const playPauseBtn = document.getElementById("playPauseBtn") as HTMLButtonElement;
const playPauseText = document.getElementById("playPauseText")!;
const playPauseIcon = document.getElementById("playPauseIcon")!;
const stepBtn = document.getElementById("stepBtn") as HTMLButtonElement;
const simSpeedSelect = document.getElementById("simSpeed") as HTMLSelectElement;
const activeIntersectionName = document.getElementById("activeIntersectionName")!;
const stateIdDisplay = document.getElementById("stateIdDisplay")!;
const stepProgressDisplay = document.getElementById("stepProgressDisplay")!;
const stateTimeDisplay = document.getElementById("stateTimeDisplay")!;
const cycleCountDisplay = document.getElementById("cycleCountDisplay")!;
const stateProgressBar = document.getElementById("stateProgressBar")!;
const signalsGrid = document.getElementById("signalsGrid")!;
const collisionAlertBanner = document.getElementById("collisionAlertBanner")!;
const collisionAlertText = document.getElementById("collisionAlertText")!;
const debugToggle = document.getElementById("debugToggle") as HTMLInputElement | null;

document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const tab = (btn as HTMLElement).dataset.tab;
    document.querySelectorAll(".tab-btn").forEach((b) => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach((c) => c.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(tab!)?.classList.add("active");
  });
});

const stageHost = document.getElementById("stageHost") as HTMLDivElement;
const stageApp = new StageApp(stageHost, AUTORSKIE);
const sim = new SimRuntime(stageApp);

sim.setOnPausedByCollision(() => {
  playPauseText.textContent = "Wznów";
  playPauseIcon.innerHTML = '<polygon points="5 3 19 12 5 21 5 3"></polygon>';
  if (debugToggle) debugToggle.checked = true;
});

let examples: Record<string, string> = {};
let generatedTargetCode = "";

async function loadExamples() {
  examples = await fetchExamples();
  const src = examples[ONLY_EXAMPLE];
  if (!src) return;
  codeEditor.value = src;
  currentFileName.textContent = ONLY_EXAMPLE;
}

function setBadge(kind: "ready" | "valid" | "error", text: string) {
  compilerStatusBadge.className = `status-badge ${kind}`;
  compilerStatusBadge.querySelector(".status-text")!.textContent = text;
}

function renderLogs(logs: string[] | undefined, valid: boolean, errType?: string, errMsg?: string) {
  compilerLogsContainer.innerHTML = "";
  (logs || []).forEach((line) => {
    const div = document.createElement("div");
    div.className = "console-line info";
    if (line.includes("VALID") || line.includes("[+]")) div.className = "console-line success";
    if (line.startsWith("[!]")) div.className = "console-line error";
    div.textContent = line;
    compilerLogsContainer.appendChild(div);
  });
  if (!valid && errMsg) {
    const div = document.createElement("div");
    div.className = "console-line error";
    div.textContent = `[!] ${errType || "Error"}: ${errMsg}`;
    compilerLogsContainer.appendChild(div);
  }
}

async function doCompile() {
  const code = codeEditor.value;
  if (!code.trim()) return;
  setBadge("ready", "Kompilacja...");
  try {
    const result = await compileCode(code);
    renderLogs(result.logs, result.valid, result.error_type, result.error_message);
    if (result.valid && result.dfa) {
      setBadge("valid", "Zweryfikowano (YES)");
      collisionAlertBanner.classList.add("hidden");
      generatedTargetCode = result.target_code || "";
      targetCodeContainer.textContent = generatedTargetCode;
      dfaJsonContainer.textContent = JSON.stringify(result.dfa, null, 2);
      downloadCodeBtn.disabled = false;
      playPauseBtn.disabled = false;
      stepBtn.disabled = false;
      activeIntersectionName.textContent = result.dfa.name;
      sim.setDfa(result.dfa);
      sim.setRunning(true);
      playPauseText.textContent = "Zatrzymaj";
      playPauseIcon.innerHTML =
        '<rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect>';
    } else {
      setBadge("error", "Odrzucono");
      collisionAlertBanner.classList.remove("hidden");
      collisionAlertText.textContent = `${result.error_type || "Error"}: ${result.error_message || ""}`;
      if (result.dfa) {
        sim.setDfa(result.dfa);
        playPauseBtn.disabled = false;
        stepBtn.disabled = false;
        activeIntersectionName.textContent = `[ZAGROŻENIE] ${result.dfa.name}`;
        sim.setRunning(true);
      } else {
        playPauseBtn.disabled = true;
        stepBtn.disabled = true;
        sim.setRunning(false);
        sim.setDfa(null);
      }
      downloadCodeBtn.disabled = true;
    }
  } catch (e) {
    setBadge("error", "Błąd połączenia");
    renderLogs([`[!] ${(e as Error).message}`], false);
  }
}

compileBtn.addEventListener("click", () => void doCompile());
window.addEventListener("keydown", (e) => {
  if (e.key === "F5" || (e.ctrlKey && e.key === "Enter")) {
    e.preventDefault();
    void doCompile();
  }
});

playPauseBtn.addEventListener("click", () => {
  if (sim.isRunning()) {
    sim.setRunning(false);
    playPauseText.textContent = "Wznów";
    playPauseIcon.innerHTML = '<polygon points="5 3 19 12 5 21 5 3"></polygon>';
  } else {
    sim.setRunning(true);
    playPauseText.textContent = "Zatrzymaj";
    playPauseIcon.innerHTML =
      '<rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect>';
  }
});

stepBtn.addEventListener("click", () => {
  sim.setRunning(false);
  playPauseText.textContent = "Wznów";
  sim.stepState();
});

simSpeedSelect.addEventListener("change", () => {
  sim.setSpeed(parseFloat(simSpeedSelect.value) || 1);
});

debugToggle?.addEventListener("change", () => {
  sim.setDebug(!!debugToggle.checked);
});

downloadCodeBtn.addEventListener("click", () => {
  if (!generatedTargetCode) return;
  const blob = new Blob([generatedTargetCode], { type: "text/plain" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "sterownik.py";
  a.click();
});

function paintHud() {
  const hud = sim.getHud();
  stateIdDisplay.textContent = hud.stateId;
  stepProgressDisplay.textContent = hud.stepLabel;
  stateTimeDisplay.textContent = hud.timeLeft;
  cycleCountDisplay.textContent = hud.cycles;
  stateProgressBar.style.transform = `scaleX(${Math.max(0, Math.min(1, hud.progress))})`;
  signalsGrid.innerHTML = "";
  hud.chips.forEach((c) => {
    const chip = document.createElement("div");
    chip.className = "signal-chip";
    const eta = c.countdown != null && c.countdown > 0 ? ` ${Math.ceil(c.countdown)}` : "";
    chip.innerHTML = `<span class="dir-name">${c.name}</span><span class="sig-indicator ${c.cls}">${c.label}${eta}</span>`;
    signalsGrid.appendChild(chip);
  });
  if (hud.collisions.length) {
    collisionAlertBanner.classList.remove("hidden");
    collisionAlertText.textContent = `Kolizja AABB: ${hud.collisions.join(", ")}`;
  } else if (compilerStatusBadge.classList.contains("valid")) {
    // Nie zasłaniaj błędu kompilatora — chowaj tylko alert hitboxów
    const t = collisionAlertText.textContent || "";
    if (t.startsWith("Kolizja AABB")) collisionAlertBanner.classList.add("hidden");
  }
}

let last = performance.now();
function loop(now: number) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  sim.tick(dt);
  paintHud();
  requestAnimationFrame(loop);
}

void loadExamples().then(() => {
  requestAnimationFrame(loop);
});
