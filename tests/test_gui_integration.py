import unittest
import os
import glob
from compiler import compile_source_string

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EXAMPLES_DIR = os.path.join(BASE_DIR, "examples")

KEY_EXAMPLES = [
    "rondo_autorskie.traffic",
]


class TestAllExamplesCompilation(unittest.TestCase):
    def test_all_examples_load_and_validate_correctly(self):
        traffic_files = glob.glob(os.path.join(EXAMPLES_DIR, "*.traffic"))
        filenames = sorted(os.path.basename(f) for f in traffic_files)
        self.assertEqual(filenames, sorted(KEY_EXAMPLES))

        results = {}
        for filepath in traffic_files:
            filename = os.path.basename(filepath)
            with open(filepath, "r", encoding="utf-8") as f:
                code = f.read()

            result = compile_source_string(code)
            results[filename] = result

            self.assertTrue(
                result["valid"],
                f"Przykład '{filename}' nie przeszedł weryfikacji! Błąd: {result.get('error_message')}"
            )
            self.assertIsNotNone(result["target_code"], f"Brak wygenerowanego kodu dla {filename}")
            self.assertIsNotNone(result["dfa"], f"Brak modelu DFA dla {filename}")
            self.assertGreater(len(result["dfa"]["states"]), 0)

        print("\n=== WYNIKI TESTÓW — RONDO AUTORSKIE ===")
        for name, res in results.items():
            print(f"  {name}: OK ({len(res['dfa']['states'])} stanów)")


if __name__ == "__main__":
    unittest.main()
