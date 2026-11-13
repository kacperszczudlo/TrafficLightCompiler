/**
 * TrafficLightCompiler — Aplikacja Frontend & Symulator 2D
 */

document.addEventListener("DOMContentLoaded", () => {
  // Elementy DOM
  const codeEditor = document.getElementById("codeEditor");
  const exampleSelect = document.getElementById("exampleSelect");
  const compileBtn = document.getElementById("compileBtn");
  const compilerStatusBadge = document.getElementById("compilerStatusBadge");
  const currentFileName = document.getElementById("currentFileName");

  const compilerLogsContainer = document.getElementById(
    "compilerLogsContainer",
  );
  const targetCodeContainer = document.getElementById("targetCodeContainer");
  const dfaJsonContainer = document.getElementById("dfaJsonContainer");
  const downloadCodeBtn = document.getElementById("downloadCodeBtn");

  const playPauseBtn = document.getElementById("playPauseBtn");
  const playPauseIcon = document.getElementById("playPauseIcon");
  const playPauseText = document.getElementById("playPauseText");
  const stepBtn = document.getElementById("stepBtn");
  const simSpeedSelect = document.getElementById("simSpeed");

  const activeIntersectionName = document.getElementById(
    "activeIntersectionName",
  );
  const stateIdDisplay = document.getElementById("stateIdDisplay");
  const stepProgressDisplay = document.getElementById("stepProgressDisplay");
  const stateTimeDisplay = document.getElementById("stateTimeDisplay");
  const cycleCountDisplay = document.getElementById("cycleCountDisplay");
  const stateProgressBar = document.getElementById("stateProgressBar");
  const collisionAlertBanner = document.getElementById("collisionAlertBanner");
  const collisionAlertText = document.getElementById("collisionAlertText");
  const signalsGrid = document.getElementById("signalsGrid");

  const canvas = document.getElementById("trafficCanvas");
  const ctx = canvas.getContext("2d");

  // Stan symulacji
  let dfaModel = null;
  let isRunning = false;
  let currentStateIdx = 0;
  let stateElapsedMs = 0;
  let cycleCount = 0;
  let simSpeed = 1.0;
  let lastFrameTime = performance.now();
  let generatedTargetCode = "";
  let collisionError = null;

  // Obiekty animowane w symulatorze
  const cars = [];
  const pedestrians = [];
  let tramProgress = -0.5; // -0.5 do 1.5
  let railwayBarrierAngle = 90; // 90 stopni (otwarty), 0 stopni (zamknięty)

  // Inicjalizacja aut
  function initCars() {
    cars.length = 0;
    // Auta NS (Północ -> Południe)
    cars.push({
      dir: "NS",
      x: 380,
      y: -60,
      speed: 120,
      targetY: 220,
      color: "#38bdf8",
    });
    cars.push({
      dir: "SN",
      x: 420,
      y: 660,
      speed: -120,
      targetY: 380,
      color: "#f59e0b",
    });
    // Auta WE (Zachód -> Wschód)
    cars.push({
      dir: "WE",
      x: -60,
      y: 320,
      speed: 120,
      targetX: 320,
      color: "#ec4899",
    });
    cars.push({
      dir: "EW",
      x: 860,
      y: 280,
      speed: -120,
      targetX: 480,
      color: "#a855f7",
    });
  }

  // Inicjalizacja pieszych
  function initPedestrians() {
    pedestrians.length = 0;
    // Pieszy idący przez wlot południowy (NS)
    pedestrians.push({
      x: 310,
      y: 400,
      targetX: 490,
      dir: 1,
      speed: 45,
      color: "#34d399",
    });
  }

  initCars();
  initPedestrians();

  // ==========================================================================
  // Obsługa Zakładek Inspektora
  // ==========================================================================
  const tabButtons = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");

  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabButtons.forEach((b) => b.classList.remove("active"));
      tabContents.forEach((c) => c.classList.remove("active"));

      btn.classList.add("active");
      const targetId = btn.getAttribute("data-tab");
      document.getElementById(targetId).classList.add("active");
    });
  });

  // ==========================================================================
  // Pobieranie przykładów z serwera
  // ==========================================================================
  let examplesMap = {};

  async function loadExamples() {
    try {
      const resp = await fetch("/api/examples");
      if (resp.ok) {
        examplesMap = await resp.json();
        exampleSelect.innerHTML =
          '<option value="">Wybierz gotowy szablon...</option>';
        for (const filename of Object.keys(examplesMap)) {
          const opt = document.createElement("option");
          opt.value = filename;
          opt.textContent = filename;
          exampleSelect.appendChild(opt);
        }

        // Domyślnie załaduj skrzyzowanie_zintegrowane.traffic jeśli istnieje
        if (examplesMap["skrzyzowanie_zintegrowane.traffic"]) {
          exampleSelect.value = "skrzyzowanie_zintegrowane.traffic";
          selectExample("skrzyzowanie_zintegrowane.traffic");
        } else if (Object.keys(examplesMap).length > 0) {
          const first = Object.keys(examplesMap)[0];
          exampleSelect.value = first;
          selectExample(first);
        }
      }
    } catch (e) {
      console.warn("Nie udało się pobrać przykładów:", e);
    }
  }

  function selectExample(filename) {
    if (examplesMap[filename]) {
      codeEditor.value = examplesMap[filename];
      currentFileName.textContent = filename;
      compileCode();
    }
  }

  exampleSelect.addEventListener("change", (e) => {
    if (e.target.value) {
      selectExample(e.target.value);
    }
  });

  // ==========================================================================
  // Kompilacja Kodu
  // ==========================================================================
  async function compileCode() {
    const code = codeEditor.value;
    if (!code.trim()) return;

    compilerStatusBadge.className = "status-badge ready";
    compilerStatusBadge.querySelector(".status-text").textContent =
      "Kompilacja...";

    try {
      const resp = await fetch("/api/compile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code }),
      });

      const result = await resp.json();
      renderCompilerLogs(
        result.logs,
        result.valid,
        result.error_type,
        result.error_message,
      );

      if (result.valid) {
        compilerStatusBadge.className = "status-badge valid";
        compilerStatusBadge.querySelector(".status-text").textContent =
          "Zweryfikowano (YES)";

        dfaModel = result.dfa;
        generatedTargetCode = result.target_code;
        collisionError = null;
        collisionAlertBanner.classList.add("hidden");

        targetCodeContainer.textContent = result.target_code;
        dfaJsonContainer.textContent = JSON.stringify(result.dfa, null, 2);
        downloadCodeBtn.disabled = false;

        playPauseBtn.disabled = false;
        stepBtn.disabled = false;

        activeIntersectionName.textContent = dfaModel.name;
        resetSimulationState();
        startSimulation();
      } else {
        compilerStatusBadge.className = "status-badge error";
        compilerStatusBadge.querySelector(".status-text").textContent =
          "Błąd Walidacji (NO)";

        downloadCodeBtn.disabled = true;
        playPauseBtn.disabled = true;
        stepBtn.disabled = true;
        pauseSimulation();

        if (result.error_type === "CollisionConflictException") {
          collisionError = result.error_message;
          collisionAlertText.textContent = result.error_message;
          collisionAlertBanner.classList.remove("hidden");
        } else {
          collisionError = null;
          collisionAlertBanner.classList.add("hidden");
        }
      }
    } catch (err) {
      compilerStatusBadge.className = "status-badge error";
      compilerStatusBadge.querySelector(".status-text").textContent =
        "Błąd Połączenia";
      renderCompilerLogs(
        [`[!] Błąd komunikacji z serwerem kompilatora: ${err.message}`],
        false,
        "NetworkError",
        err.message,
      );
    }
  }

  function renderCompilerLogs(logs, isValid, errType, errMsg) {
    compilerLogsContainer.innerHTML = "";
    if (!logs || logs.length === 0) return;

    logs.forEach((line) => {
      const div = document.createElement("div");
      div.className = "console-line";

      if (
        line.startsWith("[1/") ||
        line.startsWith("[2/") ||
        line.startsWith("[3/") ||
        line.startsWith("[4/") ||
        line.startsWith("[5/")
      ) {
        div.classList.add("stage");
      } else if (line.includes("SUKCESEM") || line.includes("Wygenerowano")) {
        div.classList.add("success");
      } else if (line.startsWith("[!]")) {
        div.classList.add("error");
      } else {
        div.classList.add("info");
      }

      div.textContent = line;
      compilerLogsContainer.appendChild(div);
    });

    if (isValid) {
      const div = document.createElement("div");
      div.className = "console-line success";
      div.textContent =
        "[+] VALID: YES — Program spełnia wszystkie kryteria bezpieczeństwa.";
      compilerLogsContainer.appendChild(div);
    }

    compilerLogsContainer.scrollTop = compilerLogsContainer.scrollHeight;
  }

  compileBtn.addEventListener("click", compileCode);

  window.addEventListener("keydown", (e) => {
    if (e.key === "F5" || (e.ctrlKey && e.key === "Enter")) {
      e.preventDefault();
      compileCode();
    }
  });

  // Pobieranie sterownik.py
  downloadCodeBtn.addEventListener("click", () => {
    if (!generatedTargetCode) return;
    const blob = new Blob([generatedTargetCode], {
      type: "text/x-python;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "sterownik.py";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  });

  // ==========================================================================
  // Kontrola Symulacji
  // ==========================================================================
  function resetSimulationState() {
    currentStateIdx = 0;
    stateElapsedMs = 0;
    cycleCount = 0;
    cycleCountDisplay.textContent = "0";
    updateStateDisplay();
  }

  function startSimulation() {
    isRunning = true;
    playPauseText.textContent = "Zatrzymaj";
    playPauseIcon.innerHTML =
      '<rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect>';
  }

  function pauseSimulation() {
    isRunning = false;
    playPauseText.textContent = "Uruchom";
    playPauseIcon.innerHTML = '<polygon points="5 3 19 12 5 21 5 3"></polygon>';
  }

  playPauseBtn.addEventListener("click", () => {
    if (isRunning) pauseSimulation();
    else startSimulation();
  });

  stepBtn.addEventListener("click", () => {
    if (!dfaModel || !dfaModel.states.length) return;
    pauseSimulation();
    advanceToNextState();
  });

  simSpeedSelect.addEventListener("change", (e) => {
    simSpeed = parseFloat(e.target.value) || 1.0;
  });

  function advanceToNextState() {
    if (!dfaModel || !dfaModel.states.length) return;
    const curr = dfaModel.states[currentStateIdx];
    const nextIdx = curr.next_state;
    if (nextIdx === 0) {
      cycleCount++;
      cycleCountDisplay.textContent = cycleCount;
    }
    currentStateIdx = nextIdx;
    stateElapsedMs = 0;
    updateStateDisplay();
  }

  function updateStateDisplay() {
    if (!dfaModel || !dfaModel.states.length) return;
    const state = dfaModel.states[currentStateIdx];
    const totalStates = dfaModel.states.length;

    stateIdDisplay.textContent = `q${state.id}`;
    stepProgressDisplay.textContent = `${currentStateIdx + 1} / ${totalStates}`;

    const remainingSec = Math.max(
      0,
      (state.duration_ms - stateElapsedMs) / 1000.0,
    );
    stateTimeDisplay.textContent = `${remainingSec.toFixed(1)} s`;

    const progressPct = Math.min(
      100,
      (stateElapsedMs / state.duration_ms) * 100,
    );
    stateProgressBar.style.width = `${progressPct}%`;

    // Aktualizacja siatki chipów
    renderSignalChips(state.outputs);
  }

  function renderSignalChips(outputs) {
    signalsGrid.innerHTML = "";
    for (const [dir, sig] of Object.entries(outputs)) {
      const chip = document.createElement("div");
      chip.className = "signal-chip";

      let colorClass = "blue";
      if (
        sig.includes("GREEN") ||
        sig.includes("JAZDA") ||
        sig.includes("OPEN") ||
        sig.includes("GO")
      )
        colorClass = "green";
      else if (sig.includes("RED_YELLOW")) colorClass = "red_yellow";
      else if (
        sig.includes("YELLOW") ||
        sig.includes("UWAGA") ||
        sig.includes("WARNING") ||
        sig.includes("ATTENTION")
      )
        colorClass = "yellow";
      else if (
        sig.includes("RED") ||
        sig.includes("STOJ") ||
        sig.includes("CLOSED") ||
        sig.includes("STOP")
      )
        colorClass = "red";

      chip.innerHTML = `
        <span class="dir-name">${dir}:</span>
        <span class="sig-indicator ${colorClass}">${sig}</span>
      `;
      signalsGrid.appendChild(chip);
    }
  }

  // ==========================================================================
  // RYSOWANIE SKRZYŻOWANIA 2D (HTML5 Canvas)
  // ==========================================================================
  function getCurrentSignal(dirKeyword) {
    if (!dfaModel || !dfaModel.states.length) return "OFF";
    const outputs = dfaModel.states[currentStateIdx].outputs;
    for (const [k, v] of Object.entries(outputs)) {
      if (k.toLowerCase().includes(dirKeyword.toLowerCase())) {
        return v;
      }
    }
    return "OFF";
  }

  function renderLoop(currentTime) {
    const dt = (currentTime - lastFrameTime) / 1000.0;
    lastFrameTime = currentTime;

    // Aktualizacja czasu stanu automatu
    if (isRunning && dfaModel && dfaModel.states.length) {
      const state = dfaModel.states[currentStateIdx];
      stateElapsedMs += dt * 1000.0 * simSpeed;

      if (stateElapsedMs >= state.duration_ms) {
        advanceToNextState();
      } else {
        updateStateDisplay();
      }
    }

    // Aktualizacja animacji obiektów
    updateEntities(dt);

    // Rysowanie klatki
    drawScene();

    requestAnimationFrame(renderLoop);
  }

  function updateEntities(dt) {
    const sigNS = getCurrentSignal("NS");
    const sigWE = getCurrentSignal("WE");
    const sigTram = getCurrentSignal("tram");
    const sigPKP = getCurrentSignal("pkp") || getCurrentSignal("kolej");

    const canDriveNS = sigNS.includes("GREEN") || sigNS.includes("GO");
    const canDriveWE = sigWE.includes("GREEN") || sigWE.includes("GO");
    const isTramGo = sigTram.includes("GO") || sigTram.includes("JAZDA");
    const isCrossingClosed =
      sigPKP.includes("CLOSED") ||
      sigPKP.includes("ZAMKNIETY") ||
      sigPKP.includes("WARNING");

    // Rogatki kolejowe: płynny kąt opadania/podnoszenia
    if (isCrossingClosed) {
      railwayBarrierAngle = Math.max(
        0,
        railwayBarrierAngle - dt * 60 * simSpeed,
      );
    } else {
      railwayBarrierAngle = Math.min(
        90,
        railwayBarrierAngle + dt * 60 * simSpeed,
      );
    }

    // Ruch aut
    cars.forEach((car) => {
      let speed = car.speed * simSpeed;
      let yielding = false;

      // Inteligentne ustępowanie pierwszeństwa pieszemu na przejściu:
      // Jeśli pieszy znajduje się na pasach (x: 330..470), auta zatrzymują się przed zebrą!
      const isPedestrianOnCrosswalk = pedestrians.some(
        (p) => p.x >= 325 && p.x <= 475,
      );

      if (car.dir === "NS") {
        const atStopLine = car.y >= 150 && car.y <= 190;
        const beforeCrosswalk = car.y >= 310 && car.y <= 380;

        if (!canDriveNS && atStopLine) {
          speed = 0;
        } else if (beforeCrosswalk && isPedestrianOnCrosswalk) {
          speed = 0; // Auto ustępuje pieszemu na pasach!
          yielding = true;
        }
        car.yielding = yielding;
        car.y += speed * dt;
        if (car.y > 660) car.y = -60;
      } else if (car.dir === "SN") {
        const atStopLine = car.y <= 450 && car.y >= 410;
        const beforeCrosswalk = car.y <= 475 && car.y >= 415;

        if (!canDriveNS && atStopLine) {
          speed = 0;
        } else if (beforeCrosswalk && isPedestrianOnCrosswalk) {
          speed = 0; // Auto ustępuje pieszemu na pasach!
          yielding = true;
        }
        car.yielding = yielding;
        car.y += speed * dt;
        if (car.y < -60) car.y = 660;
      } else if (car.dir === "WE") {
        const atStopLine = car.x >= 250 && car.x <= 290;
        if (!canDriveWE && atStopLine) speed = 0;
        car.y += 0;
        car.x += speed * dt;
        if (car.x > 860) car.x = -60;
      } else if (car.dir === "EW") {
        const atStopLine = car.x <= 550 && car.x >= 510;
        if (!canDriveWE && atStopLine) speed = 0;
        car.x += speed * dt;
        if (car.x < -60) car.x = 860;
      }
    });

    // Ruch tramwaju
    if (isTramGo || tramProgress > 0.0) {
      tramProgress += dt * 0.25 * simSpeed;
      if (tramProgress > 1.4) tramProgress = -0.4;
    }

    // Ruch pieszego
    const sigPieszy = getCurrentSignal("pieszy");
    const canCross = sigPieszy.includes("GREEN");
    pedestrians.forEach((p) => {
      if (canCross || (p.x > 330 && p.x < 470)) {
        p.x += p.speed * p.dir * dt * simSpeed;
        if (p.x > 490) p.dir = -1;
        if (p.x < 310) p.dir = 1;
      }
    });
  }

  function drawScene() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Trawa / Otoczenie
    ctx.fillStyle = "#062016";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 2. Jezdnie (Asfalt)
    ctx.fillStyle = "#1e293b";
    // Droga pionowa NS (szerokość 160px: x=320..480)
    ctx.fillRect(320, 0, 160, canvas.height);
    // Droga pozioma WE (wysokość 160px: y=220..380)
    ctx.fillRect(0, 220, canvas.width, 160);

    // 3. Linie krawędziowe i pasy ruchu
    ctx.strokeStyle = "#64748b";
    ctx.lineWidth = 2;
    // Krawężniki
    ctx.strokeRect(320, 0, 160, canvas.height);
    ctx.strokeRect(0, 220, canvas.width, 160);

    // Środkowe linie przerywane
    ctx.strokeStyle = "#f8fafc";
    ctx.setLineDash([15, 12]);
    ctx.lineWidth = 2;

    // Pionowa linia osiowa
    ctx.beginPath();
    ctx.moveTo(400, 0);
    ctx.lineTo(400, 220);
    ctx.moveTo(400, 380);
    ctx.lineTo(400, canvas.height);
    ctx.stroke();

    // Pozioma linia osiowa
    ctx.beginPath();
    ctx.moveTo(0, 300);
    ctx.lineTo(320, 300);
    ctx.moveTo(480, 300);
    ctx.lineTo(canvas.width, 300);
    ctx.stroke();
    ctx.setLineDash([]); // Reset linii

    // 4. Przejścia dla pieszych (Zebra)
    drawZebraCrossing(320, 385, 160, 25); // Południowe
    drawZebraCrossing(320, 190, 160, 25); // Północne

    // 5. Tory tramwajowe (ukośne / łuk)
    drawTramTracks();

    // 6. Przejazd kolejowy z rogatkami (na prawym skrzydle)
    drawRailwayCrossing();

    // 7. Rysowanie pojazdów i pieszych
    drawEntities();

    // 8. Rysowanie fizycznych sygnalizatorów (ze światłami)
    drawTrafficSignals();

    // 9. Alert kolizji na środku Canvasu
    if (collisionError) {
      drawCollisionWarning();
    }
  }

  function drawZebraCrossing(x, y, w, h) {
    ctx.fillStyle = "#f8fafc";
    const stripeWidth = 10;
    const gap = 10;
    for (let curX = x + 5; curX < x + w - 5; curX += stripeWidth + gap) {
      ctx.fillRect(curX, y, stripeWidth, h);
    }
  }

  function drawTramTracks() {
    ctx.strokeStyle = "#94a3b8";
    ctx.lineWidth = 3;
    // Para szyn tramwajowych biegnących po skosie (z lewego dołu w prawą górę)
    ctx.beginPath();
    ctx.moveTo(0, 520);
    ctx.lineTo(canvas.width, 80);
    ctx.moveTo(0, 536);
    ctx.lineTo(canvas.width, 96);
    ctx.stroke();

    // Podkłady tramwajowe
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 2;
    for (let i = 0; i < canvas.width; i += 28) {
      const y = 528 - i * 0.55;
      ctx.beginPath();
      ctx.moveTo(i - 8, y + 14);
      ctx.lineTo(i + 8, y - 14);
      ctx.stroke();
    }
  }

  function drawRailwayCrossing() {
    const rx = 660; // Współrzędna X toru kolejowego
    // Tory kolejowe pionowe po prawej stronie
    ctx.strokeStyle = "#cbd5e1";
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(rx - 8, 0);
    ctx.lineTo(rx - 8, canvas.height);
    ctx.moveTo(rx + 8, 0);
    ctx.lineTo(rx + 8, canvas.height);
    ctx.stroke();

    // Podkłady drewniane
    ctx.strokeStyle = "#78350f";
    ctx.lineWidth = 5;
    for (let y = 10; y < canvas.height; y += 22) {
      ctx.beginPath();
      ctx.moveTo(rx - 20, y);
      ctx.lineTo(rx + 20, y);
      ctx.stroke();
    }

    // Rogatka kolejowa (Bariera ze szlabanem)
    const sigPKP = getCurrentSignal("pkp") || getCurrentSignal("kolej");
    const isWarning = sigPKP.includes("WARNING") || sigPKP.includes("CLOSED");

    // Podstawa szlabanu
    ctx.fillStyle = "#1e293b";
    ctx.fillRect(rx - 35, 205, 12, 12);
    ctx.fillRect(rx - 35, 385, 12, 12);

    // Ruchome ramię szlabanu (kąt railwayBarrierAngle)
    ctx.save();
    ctx.translate(rx - 30, 210);
    ctx.rotate((railwayBarrierAngle * Math.PI) / 180);
    ctx.fillStyle = isWarning ? "#ef4444" : "#f8fafc";
    ctx.fillRect(0, -3, 80, 6);
    ctx.restore();

    ctx.save();
    ctx.translate(rx - 30, 390);
    ctx.rotate((-railwayBarrierAngle * Math.PI) / 180);
    ctx.fillStyle = isWarning ? "#ef4444" : "#f8fafc";
    ctx.fillRect(0, -3, 80, 6);
    ctx.restore();

    // Pulsujące czerwone światło przejazdowe
    const flash = isWarning && Math.floor(Date.now() / 400) % 2 === 0;
    ctx.fillStyle = flash ? "#ef4444" : "#334155";
    ctx.beginPath();
    ctx.arc(rx - 28, 195, 6, 0, Math.PI * 2);
    ctx.fill();
    if (flash) {
      ctx.shadowColor = "#ef4444";
      ctx.shadowBlur = 12;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }

  function drawTrafficSignals() {
    const sigNS = getCurrentSignal("NS");
    const sigWE = getCurrentSignal("WE");
    const sigPieszy = getCurrentSignal("pieszy");
    const sigTram = getCurrentSignal("tram");

    // 1. Sygnalizator NS Północny (dla aut jadących na południe)
    drawStandardLight(285, 160, sigNS);
    // 2. Sygnalizator NS Południowy (dla aut jadących na północ)
    drawStandardLight(495, 420, sigNS);

    // 3. Sygnalizator WE Zachodni (dla aut jadących na wschód)
    drawStandardLight(285, 395, sigWE, true);
    // 4. Sygnalizator WE Wschodni (dla aut jadących na zachód)
    drawStandardLight(495, 185, sigWE, true);

    // 5. Sygnalizator pieszy (2-komorowy)
    drawPedestrianLight(495, 360, sigPieszy);

    // 6. Sygnalizator tramwajowy STK (specjalna belka)
    drawTramLight(180, 430, sigTram);
  }

  function drawStandardLight(x, y, state, horizontal = false) {
    ctx.save();
    ctx.translate(x, y);

    // Obudowa sygnalizatora
    ctx.fillStyle = "#0f172a";
    ctx.strokeStyle = "#475569";
    ctx.lineWidth = 1.5;
    ctx.fillRect(-12, -28, 24, 56);
    ctx.strokeRect(-12, -28, 24, 56);

    const isRed = state.includes("RED") || state.includes("CZERWONE");
    const isYellow = state.includes("YELLOW") || state.includes("ZOLTE");
    const isGreen = state.includes("GREEN") || state.includes("ZIELONE");

    // Czerwona komora
    drawBulb(0, -17, isRed ? "#ef4444" : "#334155", isRed);
    // Żółta komora
    drawBulb(0, 0, isYellow ? "#f59e0b" : "#334155", isYellow);
    // Zielona komora
    drawBulb(0, 17, isGreen ? "#22c55e" : "#334155", isGreen);

    ctx.restore();
  }

  function drawBulb(cx, cy, color, isLit) {
    ctx.beginPath();
    ctx.arc(cx, cy, 6, 0, Math.PI * 2);
    ctx.fillStyle = color;
    if (isLit) {
      ctx.shadowColor = color;
      ctx.shadowBlur = 10;
    }
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  function drawPedestrianLight(x, y, state) {
    ctx.save();
    ctx.translate(x, y);

    ctx.fillStyle = "#0f172a";
    ctx.fillRect(-9, -20, 18, 40);
    ctx.strokeStyle = "#475569";
    ctx.strokeRect(-9, -20, 18, 40);

    const isRed =
      state.includes("RED") || state.includes("CZERWONE") || state === "OFF";
    const isGreen = state.includes("GREEN") || state.includes("ZIELONE");

    drawBulb(0, -10, isRed ? "#ef4444" : "#334155", isRed);
    drawBulb(0, 10, isGreen ? "#22c55e" : "#334155", isGreen);

    ctx.restore();
  }

  function drawTramLight(x, y, state) {
    ctx.save();
    ctx.translate(x, y);

    ctx.fillStyle = "#0f172a";
    ctx.fillRect(-15, -15, 30, 30);
    ctx.strokeStyle = "#38bdf8";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-15, -15, 30, 30);

    ctx.strokeStyle = "#f8fafc";
    ctx.lineWidth = 3;

    if (state.includes("STOP") || state.includes("STOJ")) {
      // Pozioma kreska
      ctx.beginPath();
      ctx.moveTo(-9, 0);
      ctx.lineTo(9, 0);
      ctx.stroke();
    } else if (state.includes("GO") || state.includes("JAZDA")) {
      // Pionowa kreska
      ctx.beginPath();
      ctx.moveTo(0, -9);
      ctx.lineTo(0, 9);
      ctx.stroke();
    } else if (state.includes("ATTENTION") || state.includes("UWAGA")) {
      // Kropka centralna
      ctx.beginPath();
      ctx.arc(0, 0, 4, 0, Math.PI * 2);
      ctx.fillStyle = "#f8fafc";
      ctx.fill();
    }

    ctx.restore();
  }

  function drawEntities() {
    // Auta
    cars.forEach((car) => {
      ctx.save();
      ctx.fillStyle = car.color;
      ctx.strokeStyle = "#0f172a";
      ctx.lineWidth = 1.5;

      if (car.dir === "NS" || car.dir === "SN") {
        ctx.fillRect(car.x - 12, car.y - 20, 24, 40);
        ctx.strokeRect(car.x - 12, car.y - 20, 24, 40);
        // Szyby
        ctx.fillStyle = "#1e293b";
        ctx.fillRect(car.x - 9, car.y - 8, 18, 16);

        // Światła stopu / ustąpienie pieszemu
        if (car.yielding) {
          ctx.fillStyle = "#ef4444";
          ctx.shadowColor = "#ef4444";
          ctx.shadowBlur = 8;
          const backY = car.dir === "NS" ? car.y - 20 : car.y + 18;
          ctx.fillRect(car.x - 11, backY, 6, 2);
          ctx.fillRect(car.x + 5, backY, 6, 2);
          ctx.shadowBlur = 0;

          // Etykieta ustąpienia
          ctx.font = "bold 9px sans-serif";
          ctx.fillStyle = "#fecaca";
          ctx.fillText("🛑 USTĘPUJE", car.x - 24, car.y - 25);
        }
      } else {
        ctx.fillRect(car.x - 20, car.y - 12, 40, 24);
        ctx.strokeRect(car.x - 20, car.y - 12, 40, 24);
        // Szyby
        ctx.fillStyle = "#1e293b";
        ctx.fillRect(car.x - 8, car.y - 9, 16, 18);
      }
      ctx.restore();
    });

    // Tramwaj
    if (tramProgress >= -0.3 && tramProgress <= 1.3) {
      const tx = tramProgress * canvas.width;
      const ty = 528 - tx * 0.55;

      ctx.save();
      ctx.translate(tx, ty);
      ctx.rotate(-0.5); // Kąt torów

      ctx.fillStyle = "#eab308"; // Żółty krakowski tramwaj
      ctx.fillRect(-50, -12, 100, 24);
      ctx.strokeStyle = "#0f172a";
      ctx.strokeRect(-50, -12, 100, 24);

      // Okna tramwaju
      ctx.fillStyle = "#0f172a";
      for (let ox = -42; ox < 45; ox += 18) {
        ctx.fillRect(ox, -8, 12, 16);
      }
      ctx.restore();
    }

    // Piesi
    pedestrians.forEach((p) => {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();
    });
  }

  function drawCollisionWarning() {
    ctx.save();
    ctx.fillStyle = "rgba(239, 68, 68, 0.25)";
    ctx.fillRect(320, 220, 160, 160);

    ctx.strokeStyle = "#ef4444";
    ctx.lineWidth = 3;
    ctx.strokeRect(320, 220, 160, 160);

    ctx.font = "bold 36px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("💥", 400, 300);

    ctx.font = "bold 13px sans-serif";
    ctx.fillStyle = "#fca5a5";
    ctx.fillText("KOLIZJA WYKRYTA!", 400, 330);
    ctx.restore();
  }

  // Uruchomienie pętli rysowania i wczytania danych
  loadExamples();
  requestAnimationFrame(renderLoop);
});
