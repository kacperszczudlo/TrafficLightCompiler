import "./style.css";
import { StageApp } from "./sim/StageApp";
import { SimRuntime } from "./sim/SimRuntime";
import { AUTORSKIE } from "./sim/layouts/autorskieRondo";
import { compileCode, fetchExamples } from "./api/compileClient";
import type { DfaModel } from "./sim/signals";

const DEFAULT_EXAMPLE = "rondo_autorskie.traffic";

// Elementy DOM
const codeEditor = document.getElementById("codeEditor") as HTMLTextAreaElement;
const lineNumbers = document.getElementById("lineNumbers") as HTMLDivElement;
const editorStats = document.getElementById("editorStats") as HTMLSpanElement;
const cursorPos = document.getElementById("cursorPos") as HTMLSpanElement;

const compileBtn = document.getElementById("compileBtn") as HTMLButtonElement;
const compilerStatusBadge = document.getElementById("compilerStatusBadge")!;
const currentFileName = document.getElementById("currentFileName")!;
const compilerLogsContainer = document.getElementById("compilerLogsContainer")!;
const targetCodeContainer = document.getElementById("targetCodeContainer")!;
const dfaJsonContainer = document.getElementById("dfaJsonContainer")!;
const downloadCodeBtn = document.getElementById(
  "downloadCodeBtn",
) as HTMLButtonElement;
const copyCodeBtn = document.getElementById(
  "copyCodeBtn",
) as HTMLButtonElement | null;
const copyDfaBtn = document.getElementById(
  "copyDfaBtn",
) as HTMLButtonElement | null;
const exampleSelect = document.getElementById(
  "exampleSelect",
) as HTMLSelectElement | null;
const resetCodeBtn = document.getElementById(
  "resetCodeBtn",
) as HTMLButtonElement | null;

const playPauseBtn = document.getElementById(
  "playPauseBtn",
) as HTMLButtonElement;
const playPauseText = document.getElementById("playPauseText")!;
const playPauseIcon = document.getElementById("playPauseIcon")!;
const stepBtn = document.getElementById("stepBtn") as HTMLButtonElement;
const restartBtn = document.getElementById(
  "restartBtn",
) as HTMLButtonElement | null;
const simSpeedSelect = document.getElementById("simSpeed") as HTMLSelectElement;
const activeIntersectionName = document.getElementById(
  "activeIntersectionName",
)!;
const stateIdDisplay = document.getElementById("stateIdDisplay")!;
const stepProgressDisplay = document.getElementById("stepProgressDisplay")!;
const stateTimeDisplay = document.getElementById("stateTimeDisplay")!;
const cycleCountDisplay = document.getElementById("cycleCountDisplay")!;
const stateProgressBar = document.getElementById("stateProgressBar")!;
const signalsGrid = document.getElementById("signalsGrid")!;
const collisionAlertBanner = document.getElementById("collisionAlertBanner")!;
const collisionAlertText = document.getElementById("collisionAlertText")!;

// Obsługa zakładek inspektora
document.querySelectorAll(".itab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    const tab = (btn as HTMLElement).dataset.tab;
    document
      .querySelectorAll(".itab-btn")
      .forEach((b) => b.classList.remove("active"));
    document
      .querySelectorAll(".itab-content")
      .forEach((c) => c.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(tab!)?.classList.add("active");
  });
});

// Numeracja linii i statystyki edytora
function updateEditorMetrics() {
  const text = codeEditor.value;
  const lineCount = text.split("\n").length;

  let numsHtml = "";
  for (let i = 1; i <= lineCount; i++) {
    numsHtml += `<div class="line-num">${i}</div>`;
  }
  lineNumbers.innerHTML = numsHtml;
  editorStats.textContent = `${lineCount} ${lineCount === 1 ? "linia" : lineCount < 5 ? "linie" : "linii"}`;
}

function updateCursorPosition() {
  const sel = codeEditor.selectionStart;
  const textBefore = codeEditor.value.substring(0, sel);
  const line = textBefore.split("\n").length;
  const col = sel - textBefore.lastIndexOf("\n");
  cursorPos.textContent = `Ln ${line}, Col ${col}`;
}

codeEditor.addEventListener("input", () => {
  updateEditorMetrics();
  updateCursorPosition();
});
codeEditor.addEventListener("keyup", updateCursorPosition);
codeEditor.addEventListener("click", updateCursorPosition);
codeEditor.addEventListener("scroll", () => {
  lineNumbers.scrollTop = codeEditor.scrollTop;
});

// Wcięcie klawiszem Tab (4 spacje)
codeEditor.addEventListener("keydown", (e) => {
  if (e.key === "Tab") {
    e.preventDefault();
    const start = codeEditor.selectionStart;
    const end = codeEditor.selectionEnd;
    codeEditor.value =
      codeEditor.value.substring(0, start) +
      "    " +
      codeEditor.value.substring(end);
    codeEditor.selectionStart = codeEditor.selectionEnd = start + 4;
    updateEditorMetrics();
    updateCursorPosition();
  }
});

// Segmented speed controls
document.querySelectorAll(".speed-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document
      .querySelectorAll(".speed-btn")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const spd = parseFloat((btn as HTMLElement).dataset.speed || "1.0");
    sim.setSpeed(spd);
    if (simSpeedSelect) simSpeedSelect.value = String(spd);
  });
});

// Silnik symulacji Konva
const stageHost = document.getElementById("stageHost") as HTMLDivElement;
const stageApp = new StageApp(stageHost, AUTORSKIE);
const sim = new SimRuntime(stageApp);

sim.setOnPausedByCollision(() => {
  playPauseText.textContent = "Wznów";
  playPauseIcon.innerHTML = '<polygon points="5 3 19 12 5 21 5 3"></polygon>';
});

let examples: Record<string, string> = {};
let generatedTargetCode = "";
let currentDfa: DfaModel | null = null;

async function loadExamples() {
  try {
    examples = await fetchExamples();
    const names = Object.keys(examples);

    if (exampleSelect && names.length > 0) {
      exampleSelect.innerHTML = "";
      names.forEach((name) => {
        const opt = document.createElement("option");
        opt.value = name;
        opt.textContent = name;
        exampleSelect.appendChild(opt);
      });
      const selectedName = examples[DEFAULT_EXAMPLE]
        ? DEFAULT_EXAMPLE
        : names[0];
      exampleSelect.value = selectedName;
      codeEditor.value = examples[selectedName];
      currentFileName.textContent = selectedName;
    } else {
      const src = examples[DEFAULT_EXAMPLE];
      if (src) {
        codeEditor.value = src;
        currentFileName.textContent = DEFAULT_EXAMPLE;
      }
    }
  } catch (err) {
    console.warn("Błąd ładowania przykładów:", err);
  } finally {
    updateEditorMetrics();
    updateCursorPosition();
  }
}

if (exampleSelect) {
  exampleSelect.addEventListener("change", () => {
    const chosen = exampleSelect.value;
    if (examples[chosen]) {
      codeEditor.value = examples[chosen];
      currentFileName.textContent = chosen;
      updateEditorMetrics();
      updateCursorPosition();
      void doCompile();
    }
  });
}

if (resetCodeBtn) {
  resetCodeBtn.addEventListener("click", () => {
    const chosen = exampleSelect?.value || DEFAULT_EXAMPLE;
    if (examples[chosen]) {
      codeEditor.value = examples[chosen];
      currentFileName.textContent = chosen;
      updateEditorMetrics();
      updateCursorPosition();
      void doCompile();
    }
  });
}

function setBadge(kind: "ready" | "valid" | "error", text: string) {
  compilerStatusBadge.className = `status-pill ${kind}`;
  compilerStatusBadge.querySelector(".status-text")!.textContent = text;
}

function updatePipelineStepCards(logs: string[] | undefined, valid: boolean) {
  const steps = document.querySelectorAll(".stage-step");
  steps.forEach((s) => (s.className = "stage-step"));

  if (!logs) return;

  const has1 = logs.some((l) => l.includes("[1/5]"));
  const has2 = logs.some((l) => l.includes("[2/5]"));
  const has3 = logs.some((l) => l.includes("[3/5]"));
  const has4 = logs.some((l) => l.includes("[4/5]"));
  const has5 = logs.some((l) => l.includes("[5/5]"));

  const setClass = (stepNum: number, cls: "success" | "error") => {
    const el = document.querySelector(`.stage-step[data-step="${stepNum}"]`);
    if (el) el.className = `stage-step ${cls}`;
  };

  if (valid) {
    if (has1) setClass(1, "success");
    if (has2) setClass(2, "success");
    if (has3) setClass(3, "success");
    if (has4) setClass(4, "success");
    if (has5) setClass(5, "success");
  } else {
    if (has1) setClass(1, "success");
    if (has2) setClass(2, "success");
    if (has3) setClass(3, "success");
    if (has4) {
      setClass(4, "error");
    } else if (has3) {
      setClass(3, "error");
    } else if (has2) {
      setClass(2, "error");
    } else if (has1) {
      setClass(1, "error");
    }
  }
}

function renderLogs(
  logs: string[] | undefined,
  valid: boolean,
  errType?: string,
  errMsg?: string,
) {
  compilerLogsContainer.innerHTML = "";
  (logs || []).forEach((line) => {
    const div = document.createElement("div");
    div.className = "console-line info";

    if (/^\[\d\/5\]/.test(line)) {
      div.className = "console-line stage";
    } else if (
      line.includes("SUKCES") ||
      line.includes("VALID") ||
      line.includes("[+]")
    ) {
      div.className = "console-line success";
    } else if (
      line.startsWith("[!]") ||
      line.includes("Exception") ||
      line.includes("Error")
    ) {
      div.className = "console-line error";
    }

    div.textContent = line;
    compilerLogsContainer.appendChild(div);
  });

  if (valid) {
    const div = document.createElement("div");
    div.className = "console-line success";
    div.style.fontWeight = "bold";
    div.textContent =
      "[+] VALID: YES — Program spełnia wszystkie kryteria bezpieczeństwa.";
    compilerLogsContainer.appendChild(div);
  } else {
    const div = document.createElement("div");
    div.className = "console-line error";
    div.style.fontWeight = "bold";
    div.textContent = `[-] VALID: NO — ${errType || "Błąd"}: ${errMsg || "Program odrzucony przez walidator"}`;
    compilerLogsContainer.appendChild(div);
  }

  updatePipelineStepCards(logs, valid);
}

async function doCompile() {
  const code = codeEditor.value;
  if (!code.trim()) return;
  setBadge("ready", "Kompilacja...");
  try {
    const result = await compileCode(code);
    renderLogs(
      result.logs,
      result.valid,
      result.error_type,
      result.error_message,
    );
    if (result.valid && result.dfa) {
      setBadge("valid", "VALID: YES");
      collisionAlertBanner.classList.add("hidden");
      generatedTargetCode = result.target_code || "";
      currentDfa = result.dfa;
      targetCodeContainer.textContent = generatedTargetCode;
      dfaJsonContainer.textContent = JSON.stringify(result.dfa, null, 2);

      downloadCodeBtn.disabled = false;
      if (copyCodeBtn) copyCodeBtn.disabled = false;
      if (copyDfaBtn) copyDfaBtn.disabled = false;
      playPauseBtn.disabled = false;
      stepBtn.disabled = false;
      if (restartBtn) restartBtn.disabled = false;

      activeIntersectionName.textContent = result.dfa.name;
      sim.setDfa(result.dfa);
      sim.setRunning(true);
      playPauseText.textContent = "Zatrzymaj";
      playPauseIcon.innerHTML =
        '<rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect>';
    } else {
      setBadge("error", "VALID: NO");
      collisionAlertBanner.classList.remove("hidden");
      collisionAlertText.textContent = `${result.error_type || "Błąd"}: ${result.error_message || "Program odrzucony przez walidator"}`;
      if (result.dfa) {
        currentDfa = result.dfa;
        sim.setDfa(result.dfa);
        playPauseBtn.disabled = false;
        stepBtn.disabled = false;
        if (restartBtn) restartBtn.disabled = false;
        activeIntersectionName.textContent = `[ZAGROŻENIE] ${result.dfa.name}`;
        sim.setRunning(true);
      } else {
        playPauseBtn.disabled = true;
        stepBtn.disabled = true;
        if (restartBtn) restartBtn.disabled = true;
        sim.setRunning(false);
        sim.setDfa(null);
      }
      downloadCodeBtn.disabled = true;
      if (copyCodeBtn) copyCodeBtn.disabled = true;
      if (copyDfaBtn) copyDfaBtn.disabled = true;
    }
  } catch (e) {
    setBadge("error", "Błąd połączenia");
    renderLogs(
      [`[!] Błąd komunikacji z serwerem: ${(e as Error).message}`],
      false,
    );
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
  playPauseIcon.innerHTML = '<polygon points="5 3 19 12 5 21 5 3"></polygon>';
  sim.stepState();
});

if (restartBtn) {
  restartBtn.addEventListener("click", () => {
    if (currentDfa) {
      sim.setDfa(currentDfa);
      sim.setRunning(true);
      playPauseText.textContent = "Zatrzymaj";
      playPauseIcon.innerHTML =
        '<rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect>';
    }
  });
}

downloadCodeBtn.addEventListener("click", () => {
  if (!generatedTargetCode) return;
  const blob = new Blob([generatedTargetCode], {
    type: "text/plain;charset=utf-8",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "sterownik.py";
  a.click();
});

function showCopiedNotification(btn: HTMLButtonElement, originalHtml: string) {
  btn.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg> Skopiowano`;
  btn.classList.add("btn-copied");
  setTimeout(() => {
    btn.innerHTML = originalHtml;
    btn.classList.remove("btn-copied");
  }, 1600);
}

if (copyCodeBtn) {
  copyCodeBtn.addEventListener("click", () => {
    if (!generatedTargetCode) return;
    const orig = copyCodeBtn.innerHTML;
    void navigator.clipboard.writeText(generatedTargetCode).then(() => {
      showCopiedNotification(copyCodeBtn, orig);
    });
  });
}

if (copyDfaBtn) {
  copyDfaBtn.addEventListener("click", () => {
    const text = dfaJsonContainer.textContent || "";
    if (!text || text.startsWith("//")) return;
    const orig = copyDfaBtn.innerHTML;
    void navigator.clipboard.writeText(text).then(() => {
      showCopiedNotification(copyDfaBtn, orig);
    });
  });
}

function paintHud() {
  const hud = sim.getHud();
  stateIdDisplay.textContent = hud.stateId;
  stepProgressDisplay.textContent = `(${hud.stepLabel})`;
  stateTimeDisplay.textContent = `${hud.timeLeft}s`;
  cycleCountDisplay.textContent = hud.cycles;
  stateProgressBar.style.transform = `scaleX(${Math.max(0, Math.min(1, hud.progress))})`;

  signalsGrid.innerHTML = "";
  hud.chips.forEach((c) => {
    const chip = document.createElement("div");
    chip.className = "signal-chip";
    const eta =
      c.countdown != null && c.countdown > 0
        ? ` ${Math.ceil(c.countdown)}s`
        : "";
    chip.innerHTML = `
      <span class="sig-dot ${c.cls}" aria-hidden="true"></span>
      <span class="dir-name">${c.name}</span>
      <span class="sig-indicator ${c.cls}">${c.label}${eta}</span>
    `;
    signalsGrid.appendChild(chip);
  });

  if (hud.collisions.length) {
    collisionAlertBanner.classList.remove("hidden");
    collisionAlertText.textContent = `Kolizja na planszy: ${hud.collisions.join(", ")}`;
  } else if (compilerStatusBadge.classList.contains("valid")) {
    const t = collisionAlertText.textContent || "";
    if (t.startsWith("Kolizja na planszy"))
      collisionAlertBanner.classList.add("hidden");
  }
}

let lastTime = performance.now();
function loop(now: number) {
  const dt = Math.min(0.05, (now - lastTime) / 1000);
  lastTime = now;
  sim.tick(dt);
  paintHud();
  requestAnimationFrame(loop);
}

void loadExamples().then(() => {
  void doCompile().then(() => {
    requestAnimationFrame(loop);
  });
});
