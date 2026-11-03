import sys
import argparse
from antlr4 import FileStream, CommonTokenStream
from antlr4.error.ErrorListener import ErrorListener

from src.generated.TrafficLightLexer import TrafficLightLexer
from src.generated.TrafficLightParser import TrafficLightParser
from src.ast_builder import AstBuilderVisitor
from src.semantic_validator import SemanticValidator, SemanticError
from src.dfa_generator import DfaGenerator

class CompilerErrorListener(ErrorListener):
    def __init__(self):
        super().__init__()
        self.errors = []

    def syntaxError(self, recognizer, offendingSymbol, line, column, msg, e):
        self.errors.append(f"Błąd składniowy [linia {line}:{column}]: {msg}")

def compile_traffic(source_path: str, output_path: str = None, verbose: bool = False):
    print(f"[*] Wczytywanie pliku: {source_path}")
    input_stream = FileStream(source_path, encoding='utf-8')

    # 1. Analiza leksykalna
    lexer = TrafficLightLexer(input_stream)
    lexer_error_listener = CompilerErrorListener()
    lexer.removeErrorListeners()
    lexer.addErrorListener(lexer_error_listener)

    stream = CommonTokenStream(lexer)

    # 2. Analiza składniowa
    parser = TrafficLightParser(stream)
    parser_error_listener = CompilerErrorListener()
    parser.removeErrorListeners()
    parser.addErrorListener(parser_error_listener)

    tree = parser.program()

    all_syntax_errors = lexer_error_listener.errors + parser_error_listener.errors
    if all_syntax_errors:
        print("[!] BŁĘDY SKŁADNIOWE:")
        for err in all_syntax_errors:
            print(f"    - {err}")
        return False, None

    # 3. Budowa AST
    ast_builder = AstBuilderVisitor()
    ast = ast_builder.visit(tree)

    # 4. Weryfikacja semantyczna
    validator = SemanticValidator()
    try:
        validator.validate(ast)
        print("[+] Weryfikacja semantyczna zakończona SUKCESEM (brak kolizji, poprawne fazy).")
    except SemanticError as e:
        print(f"[!] BŁĄD SEMANTYCZNY: {e.__class__.__name__}")
        print(f"    Treść: {e}")
        return False, None

    # 5. Generacja kodu DFA (IR / JSON)
    dfa_json = DfaGenerator.to_json(ast)

    if output_path:
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(dfa_json)
        print(f"[+] Zapisano model automatu DFA do: {output_path}")

    if verbose or not output_path:
        print("\n--- Wygenerowany automat skończony DFA (IR) ---")
        print(dfa_json)

    return True, dfa_json

def main():
    parser = argparse.ArgumentParser(description="TrafficLightCompiler - Kompilator języka sygnalizacji świetlnej")
    parser.add_argument("source", help="Ścieżka do pliku źródłowego .traffic")
    parser.add_argument("-o", "--output", help="Ścieżka do wynikowego pliku JSON DFA", default=None)
    parser.add_argument("-v", "--verbose", help="Wypisz wygenerowany kod DFA na konsolę", action="store_true")

    args = parser.parse_args()
    success, _ = compile_traffic(args.source, args.output, args.verbose)
    if not success:
        sys.exit(1)

if __name__ == "__main__":
    main()
