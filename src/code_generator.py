"""
Generator kodu docelowego (Target Code Generator) dla kompilatora TrafficLightCompiler.
Przekształca zweryfikowane AST / automat skończony Moore'a w samodzielny, wykonywalny skrypt Pythona.
"""

from typing import Dict, Any
import json
from src.ast_nodes import IntersectionNode
from src.dfa_generator import DfaGenerator

class PythonCodeGenerator:
    """Generuje autonomiczny program w języku Python sterujący skrzyżowaniem w czasie rzeczywistym."""

    @staticmethod
    def generate(node: IntersectionNode) -> str:
        dfa_dict = DfaGenerator.generate(node)
        return PythonCodeGenerator.generate_from_dfa(dfa_dict)

    @staticmethod
    def generate_from_dfa(dfa: Dict[str, Any]) -> str:
        name = dfa.get("name", "SterownikSkrzyzowania")
        directions_json = json.dumps(dfa.get("directions", {}), indent=4, ensure_ascii=False)
        states_json = json.dumps(dfa.get("states", []), indent=4, ensure_ascii=False)
        num_states = len(dfa.get("states", []))
        total_cycle_ms = sum(s.get("duration_ms", 0) for s in dfa.get("states", []))
        total_cycle_s = total_cycle_ms / 1000.0

        code = f'''#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
=============================================================================
KOD DOCELOWY WYGENEROWANY AUTOMATYCZNIE PRZEZ TrafficLightCompiler
Skrzyzowanie: {name}
Liczba stanow automatu Moore'a: {num_states}
Calkowity czas trwania cyklu: {total_cycle_s:.1f}s ({total_cycle_ms} ms)
=============================================================================
"""

import sys
import time
import argparse
from datetime import datetime

# Definicja kierunkow i ich typow
DIRECTIONS = {directions_json}

# Tabela przejsc deterministycznego automatu skonczonego Moore'a
STATES = {states_json}

# Kolory ANSI dla konsoli
ANSI_RED = "\\033[91m"
ANSI_YELLOW = "\\033[93m"
ANSI_GREEN = "\\033[92m"
ANSI_CYAN = "\\033[96m"
ANSI_RESET = "\\033[0m"
ANSI_BOLD = "\\033[1m"

def format_signal(sig_val: str) -> str:
    val = sig_val.upper()
    if "ZIELONE" in val or "JAZDA" in val or "OTWARTY" in val or "GREEN" in val or "GO" in val:
        return f"{{ANSI_GREEN}}{{val}}{{ANSI_RESET}}"
    elif "ZOLTE" in val or "UWAGA" in val or "OSTRZEZENIE" in val or "YELLOW" in val or "ATTENTION" in val:
        return f"{{ANSI_YELLOW}}{{val}}{{ANSI_RESET}}"
    elif "CZERWONE" in val or "STOJ" in val or "ZAMKNIETY" in val or "RED" in val or "STOP" in val:
        return f"{{ANSI_RED}}{{val}}{{ANSI_RESET}}"
    return f"{{ANSI_CYAN}}{{val}}{{ANSI_RESET}}"

class TrafficLightController:
    """Sterownik sygnalizacji swietlnej czasu rzeczywistego (Automat Moore'a)."""

    def __init__(self, name: str, directions: dict, states: list, speed: float = 1.0):
        self.name = name
        self.directions = directions
        self.states = states
        self.speed = speed
        self.current_state_idx = 0
        self.cycle_count = 0

    def print_state_banner(self, state: dict, step_num: int, total_steps: int):
        timestamp = datetime.now().strftime("%H:%M:%S.%f")[:-3]
        dur_s = state["duration_ms"] / 1000.0
        scaled_dur_s = dur_s / self.speed

        print(f"\\n[{{ANSI_BOLD}}{{timestamp}}{{ANSI_RESET}}] "
              f"Stan {{ANSI_CYAN}}q{{state['id']}}{{ANSI_RESET}} (Krok {{step_num}}/{{total_steps}}) | "
              f"Czas: {{dur_s:.1f}}s (skalowany: {{scaled_dur_s:.2f}}s) -> Nastepny: q{{state['next_state']}}")
        print("-" * 75)

        for direction, val in state["outputs"].items():
            dir_type = self.directions.get(direction, "ogolny")
            formatted = format_signal(val)
            print(f"  • {{direction:<20}} ({{dir_type:<18}}): {{formatted}}")

    def run(self, max_cycles: int = None, dry_run: bool = False):
        total_steps = len(self.states)
        if total_steps == 0:
            print("[!] Brak zdefiniowanych stanow w automacie!")
            return

        print(f"{{ANSI_BOLD}}[*] Uruchamianie sterownika sygnalizacji: {{self.name}}{{ANSI_RESET}}")
        print(f"[*] Liczba stanow w cyklu: {{total_steps}}")
        print(f"[*] Przyspieszenie symulacji: {{self.speed}}x")
        if dry_run:
            print("[*] Tryb DRY-RUN: wykonanie jednego cyklu kontrolnego bez usypiania.")

        try:
            while True:
                state = self.states[self.current_state_idx]
                step_num = self.current_state_idx + 1

                self.print_state_banner(state, step_num, total_steps)

                if dry_run:
                    self.current_state_idx = state["next_state"]
                    if self.current_state_idx == 0:
                        print("\\n[+] Tryb DRY-RUN zakonczony pomyslnie. Cykl jest w 100% spojny.")
                        break
                    continue

                duration_s = (state["duration_ms"] / 1000.0) / self.speed
                time.sleep(duration_s)

                next_idx = state["next_state"]
                if next_idx == 0:
                    self.cycle_count += 1
                    print(f"\\n{{ANSI_GREEN}}=== Ukonczono cykl nr {{self.cycle_count}} ==={{ANSI_RESET}}")
                    if max_cycles and self.cycle_count >= max_cycles:
                        print(f"[+] Osiagnieto zadana liczbe cykli ({{max_cycles}}). Zatrzymanie.")
                        break

                self.current_state_idx = next_idx

        except KeyboardInterrupt:
            print(f"\\n{{ANSI_YELLOW}}[!] Przerwano dzialanie sterownika przez uzytkownika (Ctrl+C).{{ANSI_RESET}}")

def main():
    parser = argparse.ArgumentParser(description=f"Sterownik sygnalizacji swietlnej dla wezla: {{DIRECTIONS.keys()}}")
    parser.add_argument("-c", "--cycles", type=int, default=None, help="Maksymalna liczba pelnych cykli do wykonania")
    parser.add_argument("-s", "--speed", type=float, default=1.0, help="Mnoznik predkosci symulacji (np. 2.0 dla 2x szybciej)")
    parser.add_argument("--dry-run", action="store_true", help="Wykonaj jeden szybki przebieg sprawdzajacy bez czekania")

    args = parser.parse_args()

    controller = TrafficLightController(
        name="{name}",
        directions=DIRECTIONS,
        states=STATES,
        speed=args.speed
    )
    controller.run(max_cycles=args.cycles, dry_run=args.dry_run)

if __name__ == "__main__":
    main()
'''
        return code
