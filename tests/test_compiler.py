#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Kompleksowy zestaw testów jednostkowych i integracyjnych dla kompilatora TrafficLightCompiler.
Można uruchomić standardowym poleceniem:
    python -m unittest discover tests
lub
    pytest
"""

import unittest
import sys
import os

# Dodanie katalogu głównego do sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from compiler import compile_source_string
from src.ast_nodes import parse_duration_to_ms, IntersectionNode, StepNode
from src.semantic_validator import (
    SemanticValidator,
    CollisionConflictException,
    InvalidPhaseTransitionError,
    InvalidLightStateForTypeException,
    InvalidTimeDurationError,
    IncompleteStepDefinitionError,
    UndeclaredDirectionError,
    CycleTooShortError
)
from src.dfa_generator import DfaGenerator
from src.code_generator import PythonCodeGenerator

VALID_TRAFFIC_CODE = """
skrzyzowanie "SkrzyzowanieTestowe" {
    kierunki {
        Pojazdy_NS: pojazdy;
        Pojazdy_WE: pojazdy;
        Piesi_NS: piesi;
    }

    kolizje {
        Pojazdy_NS <-> Pojazdy_WE;
        Pojazdy_WE <-> Piesi_NS;
    }

    cykl {
        krok(czas: 20s) {
            Pojazdy_NS: ZIELONE;
            Pojazdy_WE: CZERWONE;
            Piesi_NS: ZIELONE;
        }
        krok(czas: 3s) {
            Pojazdy_NS: ZOLTE;
            Pojazdy_WE: CZERWONE;
            Piesi_NS: CZERWONE;
        }
        krok(czas: 2s) {
            Pojazdy_NS: CZERWONE;
            Pojazdy_WE: CZERWONE_ZOLTE;
            Piesi_NS: CZERWONE;
        }
        krok(czas: 15s) {
            Pojazdy_NS: CZERWONE;
            Pojazdy_WE: ZIELONE;
            Piesi_NS: CZERWONE;
        }
        krok(czas: 3s) {
            Pojazdy_NS: CZERWONE;
            Pojazdy_WE: ZOLTE;
            Piesi_NS: CZERWONE;
        }
        krok(czas: 2s) {
            Pojazdy_NS: CZERWONE_ZOLTE;
            Pojazdy_WE: CZERWONE;
            Piesi_NS: CZERWONE;
        }
    }
}
"""

COLLISION_TRAFFIC_CODE = """
skrzyzowanie "Kolizja" {
    kierunki {
        A: pojazdy;
        B: pojazdy;
    }
    kolizje {
        A <-> B;
    }
    cykl {
        krok(czas: 10s) {
            A: ZIELONE;
            B: ZIELONE;
        }
        krok(czas: 3s) {
            A: ZOLTE;
            B: ZOLTE;
        }
    }
}
"""

class TestDurationParsing(unittest.TestCase):
    def test_ms_parsing(self):
        self.assertEqual(parse_duration_to_ms("500ms"), 500)
        self.assertEqual(parse_duration_to_ms("1200ms"), 1200)

    def test_seconds_parsing(self):
        self.assertEqual(parse_duration_to_ms("3s"), 3000)
        self.assertEqual(parse_duration_to_ms("25s"), 25000)

    def test_minutes_parsing(self):
        self.assertEqual(parse_duration_to_ms("1m"), 60000)
        self.assertEqual(parse_duration_to_ms("2m"), 120000)

class TestSyntaxValidation(unittest.TestCase):
    def test_valid_program_compiles(self):
        res = compile_source_string(VALID_TRAFFIC_CODE)
        self.assertTrue(res["valid"])
        self.assertIsNone(res["error_type"])
        self.assertIsNotNone(res["dfa"])
        self.assertIsNotNone(res["target_code"])

    def test_missing_semicolon_syntax_error(self):
        bad_code = """
        skrzyzowanie "Bad" {
            kierunki {
                NS: pojazdy
            }
        }
        """
        res = compile_source_string(bad_code)
        self.assertFalse(res["valid"])
        self.assertEqual(res["error_type"], "SyntaxError")

class TestSemanticValidation(unittest.TestCase):
    def test_collision_detection(self):
        res = compile_source_string(COLLISION_TRAFFIC_CODE)
        self.assertFalse(res["valid"])
        self.assertEqual(res["error_type"], "CollisionConflictException")
        self.assertIn("wykryto konflikt kolizyjny", res["error_message"])

    def test_undeclared_direction_in_collision(self):
        code = """
        skrzyzowanie "Err" {
            kierunki { A: pojazdy; }
            kolizje { A <-> B; }
            cykl {
                krok(czas: 5s) { A: ZIELONE; }
                krok(czas: 3s) { A: ZOLTE; }
            }
        }
        """
        res = compile_source_string(code)
        self.assertFalse(res["valid"])
        self.assertEqual(res["error_type"], "UndeclaredDirectionError")

    def test_incomplete_step_definition(self):
        code = """
        skrzyzowanie "Err" {
            kierunki { A: pojazdy; B: pojazdy; }
            cykl {
                krok(czas: 5s) { A: ZIELONE; }
                krok(czas: 3s) { A: ZOLTE; B: CZERWONE; }
            }
        }
        """
        res = compile_source_string(code)
        self.assertFalse(res["valid"])
        self.assertEqual(res["error_type"], "IncompleteStepDefinitionError")

    def test_invalid_light_state_for_pedestrian(self):
        code = """
        skrzyzowanie "Err" {
            kierunki { Piesi: piesi; }
            cykl {
                krok(czas: 5s) { Piesi: ZOLTE; }
                krok(czas: 5s) { Piesi: CZERWONE; }
            }
        }
        """
        res = compile_source_string(code)
        self.assertFalse(res["valid"])
        self.assertEqual(res["error_type"], "InvalidLightStateForTypeException")

    def test_forbidden_direct_green_to_red_transition(self):
        code = """
        skrzyzowanie "Err" {
            kierunki { A: pojazdy; }
            cykl {
                krok(czas: 10s) { A: ZIELONE; }
                krok(czas: 10s) { A: CZERWONE; }
            }
        }
        """
        res = compile_source_string(code)
        self.assertFalse(res["valid"])
        self.assertEqual(res["error_type"], "InvalidPhaseTransitionError")
        self.assertIn("Wymagana faza ZOLTE", res["error_message"])

    def test_yellow_phase_too_short(self):
        code = """
        skrzyzowanie "Err" {
            kierunki { A: pojazdy; }
            cykl {
                krok(czas: 10s) { A: ZIELONE; }
                krok(czas: 1s) { A: ZOLTE; }
                krok(czas: 10s) { A: CZERWONE; }
                krok(czas: 2s) { A: CZERWONE_ZOLTE; }
            }
        }
        """
        res = compile_source_string(code)
        self.assertFalse(res["valid"])
        self.assertEqual(res["error_type"], "InvalidTimeDurationError")
        self.assertIn("minimum bezpieczeństwa to 2s", res["error_message"])

    def test_cycle_too_short(self):
        code = """
        skrzyzowanie "Err" {
            kierunki { A: pojazdy; }
            cykl {
                krok(czas: 10s) { A: ZIELONE; }
            }
        }
        """
        res = compile_source_string(code)
        self.assertFalse(res["valid"])
        self.assertEqual(res["error_type"], "CycleTooShortError")

class TestDfaAndCodeGeneration(unittest.TestCase):
    def test_dfa_structure(self):
        res = compile_source_string(VALID_TRAFFIC_CODE)
        dfa = res["dfa"]
        self.assertEqual(dfa["name"], "SkrzyzowanieTestowe")
        self.assertEqual(len(dfa["states"]), 6)
        # Weryfikacja cykliczności automatu Moore'a
        for idx, st in enumerate(dfa["states"]):
            self.assertEqual(st["id"], idx)
            self.assertEqual(st["next_state"], (idx + 1) % 6)
            self.assertIn("Pojazdy_NS", st["outputs"])

    def test_generated_python_code_is_valid_and_executable(self):
        res = compile_source_string(VALID_TRAFFIC_CODE)
        target_code = res["target_code"]
        self.assertIn("class TrafficLightController:", target_code)
        self.assertIn("def main():", target_code)

        # Sprawdzenie czy wygenerowany kod jest poprawny syntaktycznie
        compiled_bytecode = compile(target_code, "<generated_sterownik>", "exec")
        self.assertIsNotNone(compiled_bytecode)

        # Uruchomienie wygenerowanego kodu w izolowanym namespace w trybie dry-run
        namespace = {}
        exec(compiled_bytecode, namespace)
        self.assertIn("TrafficLightController", namespace)
        controller = namespace["TrafficLightController"](
            name=namespace["STATES"][0].get("name", "Test"),
            directions=namespace["DIRECTIONS"],
            states=namespace["STATES"],
            speed=10.0
        )
        # Wywołanie dry-run
        controller.run(dry_run=True)

class TestAllExampleFiles(unittest.TestCase):
    """Regresja dla jedynego przykładu demo — Rondo Autorskie."""

    def test_all_examples_in_directory(self):
        examples_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "examples"))
        expected_results = {
            "rondo_autorskie.traffic": (True, None),
        }

        files = [f for f in os.listdir(examples_dir) if f.endswith(".traffic")]
        self.assertEqual(sorted(files), sorted(expected_results.keys()))

        for filename in files:
            with self.subTest(filename=filename):
                filepath = os.path.join(examples_dir, filename)
                with open(filepath, "r", encoding="utf-8") as fp:
                    code = fp.read()

                res = compile_source_string(code)
                exp_valid, exp_err = expected_results[filename]

                self.assertEqual(
                    res["valid"], exp_valid,
                    f"Plik {filename} zwrócił valid={res['valid']}, oczekiwano {exp_valid}. Błąd: {res.get('error_message')}"
                )

                if not exp_valid:
                    self.assertEqual(
                        res["error_type"], exp_err,
                        f"Plik {filename} zwrócił błąd {res['error_type']}, oczekiwano {exp_err}."
                    )
                else:
                    target_code = res["target_code"]
                    compiled = compile(target_code, f"<test_{filename}>", "exec")
                    ns = {}
                    exec(compiled, ns)
                    controller = ns["TrafficLightController"](
                        name=ns["STATES"][0].get("name", filename),
                        directions=ns["DIRECTIONS"],
                        states=ns["STATES"],
                        speed=100.0
                    )
                    controller.run(dry_run=True)

if __name__ == "__main__":
    unittest.main()
