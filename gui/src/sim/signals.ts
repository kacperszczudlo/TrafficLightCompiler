export interface DfaModel {
  name: string;
  states: { id?: string; duration_ms?: number; outputs: Record<string, string> }[];
}

export function resolveSignal(
  dfa: DfaModel | null,
  stateIndex: number,
  role: string,
): string {
  if (!dfa?.states?.length) return "RED";
  const outputs = dfa.states[stateIndex]?.outputs || {};
  const lower = role.toLowerCase();

  for (const [dirKey, sigValue] of Object.entries(outputs)) {
    const lk = dirKey.toLowerCase();
    if (lower === "north") {
      if (lk.includes("polnoc") || lk.includes("north")) return sigValue;
    } else if (lower === "south") {
      if (lk.includes("poludnie") || lk.includes("south")) return sigValue;
    } else if (lower === "west") {
      if (lk.includes("zachod") || lk.includes("west")) return sigValue;
    } else if (lower === "east") {
      if (lk.includes("wschod") || lk.includes("east")) return sigValue;
    } else if (lower === "tram_we") {
      if (lk.includes("tramwaj_linia_we") || (lk.includes("tramwaj") && lk.includes("_we")))
        return sigValue;
    } else if (lower === "tram_ns") {
      if (lk.includes("tramwaj_linia_ns") || (lk.includes("tramwaj") && lk.includes("_ns")))
        return sigValue;
    } else if (lower === "pedestrian") {
      if (lk.includes("pies") || lk.includes("pedestrian")) return sigValue;
    }
  }
  return "RED";
}

/** Sekundy do najbliższego zielonego dla roli (0 = już zielone). */
export function secondsUntilGreen(
  dfa: DfaModel | null,
  stateIndex: number,
  stateRemaining: number,
  role: string,
): number {
  if (!dfa?.states?.length) return 0;
  if (isSignalGreen(resolveSignal(dfa, stateIndex, role))) return 0;
  return secondsUntilMatch(dfa, stateIndex, stateRemaining, role, isSignalGreen);
}

/**
 * Odliczanie przy sygnale:
 * - zielone → do końca zielonego (kierowca wie, kiedy będzie czerwone/żółte)
 * - żółte / TRAM_UWAGA → tylko ta krótka faza (nie do następnego zielonego!)
 * - czerwone → do zielonego
 */
export function signalCountdownSec(
  dfa: DfaModel | null,
  stateIndex: number,
  stateRemaining: number,
  role: string,
): number {
  if (!dfa?.states?.length) return 0;
  const cur = resolveSignal(dfa, stateIndex, role);
  if (isSignalGreen(cur)) {
    return secondsUntilMatch(dfa, stateIndex, stateRemaining, role, (s) => !isSignalGreen(s));
  }
  if (isSignalYellow(cur)) {
    return secondsUntilMatch(dfa, stateIndex, stateRemaining, role, (s) => !isSignalYellow(s));
  }
  return secondsUntilMatch(dfa, stateIndex, stateRemaining, role, isSignalGreen);
}

function secondsUntilMatch(
  dfa: DfaModel,
  stateIndex: number,
  stateRemaining: number,
  role: string,
  pred: (sig: string) => boolean,
): number {
  // Koniec bieżącego kroku; jeśli pred już teraz — to ten remaining
  if (pred(resolveSignal(dfa, stateIndex, role))) {
    return Math.max(0, stateRemaining);
  }
  let t = Math.max(0, stateRemaining);
  const n = dfa.states.length;
  for (let i = 1; i <= n; i++) {
    const j = (stateIndex + i) % n;
    if (pred(resolveSignal(dfa, j, role))) return t;
    t += (dfa.states[j].duration_ms || 1000) / 1000;
  }
  return t;
}

export function isSignalGreen(sig: string): boolean {
  const s = (sig || "").toUpperCase();
  return (
    s.includes("GREEN") ||
    s.includes("ZIELONE") ||
    s.includes("GO") ||
    s.includes("JAZDA")
  );
}

/** Czyste żółte / UWAGA — bez CZERWONE_ZOLTE (to przygotowanie do zielonego). */
export function isSignalYellow(sig: string): boolean {
  const s = (sig || "").toUpperCase();
  if (s.includes("CZERWONE_ZOLTE") || s.includes("RED_YELLOW")) return false;
  return (
    s.includes("ZOLTE") ||
    s.includes("YELLOW") ||
    s.includes("UWAGA") ||
    s.includes("ATTENTION")
  );
}

/** Jednolite etykiety kolorów — auta / piesi / tram / PKP (bez JAZDA/STÓJ). */
export function labelForSignal(sig: string): string {
  const s = (sig || "").toUpperCase();
  if (s.includes("CZERWONE_ZOLTE") || s.includes("RED_YELLOW")) return "CZ+Ż";
  if (isSignalGreen(sig)) return "ZIEL.";
  if (isSignalYellow(sig)) return "ŻÓŁ.";
  return "CZERW.";
}

export function chipClass(sig: string): string {
  const s = (sig || "").toUpperCase();
  if (isSignalGreen(sig)) return "green";
  if (s.includes("CZERWONE_ZOLTE") || s.includes("RED_YELLOW") || isSignalYellow(sig))
    return "yellow";
  return "red";
}
