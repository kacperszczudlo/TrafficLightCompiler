import sys
import argparse
from antlr4 import InputStream, FileStream, CommonTokenStream
from antlr4.error.ErrorListener import ErrorListener

from src.generated.TrafficLightLexer import TrafficLightLexer
from src.generated.TrafficLightParser import TrafficLightParser
from src.ast_builder import AstBuilderVisitor
from src.semantic_validator import SemanticValidator, SemanticError
from src.dfa_generator import DfaGenerator
from src.code_generator import PythonCodeGenerator

class CompilerErrorListener(ErrorListener):
    def __init__(self):
        super().__init__()
        self.errors = []

    def syntaxError(self, recognizer, offendingSymbol, line, column, msg, e):
        self.errors.append(f"Błąd składniowy [linia {line}:{column}]: {msg}")

def compile_source_string(source_code: str) -> dict:
    """
    Kompiluje kod źródłowy przekazany jako string.
    Zwraca słownik ze statusem, logami, modelem DFA i wygenerowanym kodem sterownika.
    Używane bezpośrednio przez GUI oraz testy.
    """
    logs = []
    def log(msg: str):
        logs.append(msg)

    log("[1/5] Skanowanie leksykalne (Lexer)...")
    input_stream = InputStream(source_code)
    lexer = TrafficLightLexer(input_stream)
    lexer_error_listener = CompilerErrorListener()
    lexer.removeErrorListeners()
    lexer.addErrorListener(lexer_error_listener)

    stream = CommonTokenStream(lexer)

    log("[2/5] Analiza składniowa (Parser)...")
    parser = TrafficLightParser(stream)
    parser_error_listener = CompilerErrorListener()
    parser.removeErrorListeners()
    parser.addErrorListener(parser_error_listener)

    tree = parser.program()

    all_syntax_errors = lexer_error_listener.errors + parser_error_listener.errors
    if all_syntax_errors:
        for err in all_syntax_errors:
            log(f"[!] {err}")
        log(f"[-] VALID: NO — Błąd składniowy (SyntaxError: {len(all_syntax_errors)} błędów).")
        return {
            "valid": False,
            "error_type": "SyntaxError",
            "error_message": "\n".join(all_syntax_errors),
            "logs": logs,
            "dfa": None,
            "target_code": None
        }

    log("[3/5] Budowa abstrakcyjnego drzewa składniowego (AST)...")
    ast_builder = AstBuilderVisitor()
    ast = ast_builder.visit(tree)
    log(f"      Zbudowano węzeł: '{ast.name}' ({len(ast.directions)} kierunków, {len(ast.steps)} kroków cyklu)")

    log("[4/5] Weryfikacja semantyczna i dowód bezkolizyjności...")
    validator = SemanticValidator()
    is_valid = True
    sem_error_type = None
    sem_error_msg = None

    try:
        validator.validate(ast)
        log("      Weryfikacja zakończona SUKCESEM (brak kolizji, poprawne fazy i czasy).")
    except SemanticError as e:
        is_valid = False
        sem_error_type = e.__class__.__name__
        sem_error_msg = str(e)
        err_msg = f"{sem_error_type}: {sem_error_msg}"
        log(f"[!] BŁĄD SEMANTYCZNY: {err_msg}")
        log(f"[-] VALID: NO — Wykryto naruszenie reguł bezpieczeństwa ({sem_error_type}).")
        log("      [!] Kompilator zablokował wygenerowanie kodu produkcyjnego.")
        log("      [*] Wygenerowano model DFA automatu, aby umożliwić symulację zderzenia/usterki w GUI.")

    log("[5/5] Generowanie modelu automatu Moore'a (IR)...")
    dfa_dict = DfaGenerator.generate(ast)
    target_code = None

    if is_valid:
        target_code = PythonCodeGenerator.generate_from_dfa(dfa_dict)
        log(f"      Wygenerowano automat DFA z {len(dfa_dict.get('states', []))} stanami.")
        log("      Wygenerowano autonomiczny sterownik Python.")
        log("[+] VALID: YES — Program spełnia wszystkie kryteria bezpieczeństwa.")

    return {
        "valid": is_valid,
        "error_type": sem_error_type,
        "error_message": sem_error_msg,
        "logs": logs,
        "dfa": dfa_dict,
        "target_code": target_code
    }

def compile_traffic(source_path: str, output_target_path: str = None, dfa_json_path: str = None, verbose: bool = False):
    print(f"[*] Wczytywanie pliku źródłowego: {source_path}")
    try:
        with open(source_path, "r", encoding="utf-8") as f:
            code = f.read()
    except Exception as e:
        print(f"[!] Błąd odczytu pliku: {e}")
        return False, None

    result = compile_source_string(code)

    for line in result["logs"]:
        print(line)

    if not result["valid"]:
        print(f"\n[-] VALID: NO — KOMPILACJA ZAKOŃCZONA BŁĘDEM: {result['error_type']}")
        print(f"    {result['error_message']}")
        return False, None

    print(f"\n[+] VALID: YES — Program poprawny i bezkolizyjny.")

    # Zapis kodu sterownika
    if output_target_path:
        with open(output_target_path, "w", encoding="utf-8") as f:
            f.write(result["target_code"])
        print(f"\n[+] Pomyślnie wygenerowano kod sterownika Python: {output_target_path}")

    # Zapis IR DFA JSON
    if dfa_json_path:
        import json
        with open(dfa_json_path, "w", encoding="utf-8") as f:
            json.dump(result["dfa"], f, indent=2, ensure_ascii=False)
        print(f"[+] Zapisano model automatu DFA do: {dfa_json_path}")

    if verbose or (not output_target_path and not dfa_json_path):
        import json
        print("\n--- Reprezentacja pośrednia DFA (IR JSON) ---")
        print(json.dumps(result["dfa"], indent=2, ensure_ascii=False))

    return True, result

def main():
    parser = argparse.ArgumentParser(description="TrafficLightCompiler - Kompilator języka sygnalizacji świetlnej")
    parser.add_argument("source", help="Ścieżka do pliku źródłowego .traffic")
    parser.add_argument("-o", "--output", help="Ścieżka do wyjściowego kodu sterownika Python (np. sterownik.py)", default=None)
    parser.add_argument("--dfa-json", help="Ścieżka do zapisu reprezentacji pośredniej IR w formacie JSON", default=None)
    parser.add_argument("-v", "--verbose", help="Wypisz szczegółowe informacje i model DFA na konsolę", action="store_true")

    args = parser.parse_args()
    success, _ = compile_traffic(args.source, args.output, args.dfa_json, args.verbose)
    if not success:
        sys.exit(1)

if __name__ == "__main__":
    main()
