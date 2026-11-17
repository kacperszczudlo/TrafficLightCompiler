"""
Pokaz działania parsera wygenerowanego przez ANTLR z grammar/TrafficLight.g4.

Dla każdego zdania (pliku .traffic) wypisuje:
  1. WEJŚCIE - tekst zdania,
  2. LEKSER  - strumień tokenów,
  3. PARSER  - drzewo rozbioru,
  4. WYNIK   - czy zdanie należy do języka, a jeśli tak, to czy przechodzi analizę semantyczną.

Użycie:
  python demo/pokaz_parsera.py                       # wszystkie zdania z demo/zdania/, po kolei
  python demo/pokaz_parsera.py moj_plik.traffic      # wybrane pliki
  python demo/pokaz_parsera.py --lisp                # dodatkowo surowe drzewo z ANTLR (toStringTree)
"""
import os
import sys
import glob
import argparse

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
sys.path.insert(0, ROOT)

from antlr4 import InputStream, CommonTokenStream, Token
from antlr4.tree.Tree import TerminalNode, ErrorNode

from compiler import CompilerErrorListener
from src.generated.TrafficLightLexer import TrafficLightLexer
from src.generated.TrafficLightParser import TrafficLightParser
from src.ast_builder import AstBuilderVisitor
from src.semantic_validator import SemanticValidator, SemanticError

ZDANIA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "zdania")

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

USE_COLOR = sys.stdout.isatty()
if USE_COLOR and os.name == "nt":
    os.system("")  # włącza kody ANSI w konsoli Windows

RED, GREEN, YELLOW, CYAN, DIM = "91", "92", "93", "96", "2"

def c(text: str, code: str) -> str:
    return f"\033[{code}m{text}\033[0m" if USE_COLOR else text

def header(title: str):
    print()
    print(c(f"── {title} " + "─" * max(0, 70 - len(title)), YELLOW))

def token_name(token_type: int) -> str:
    """Nazwa typu tokenu: ID, TIME_LITERAL... albo literał z gramatyki, np. 'kierunki'."""
    if token_type == Token.EOF:
        return "EOF"
    symbolic = TrafficLightParser.symbolicNames[token_type]
    if symbolic != "<INVALID>":
        return symbolic
    return TrafficLightParser.literalNames[token_type]

def token_label(tok) -> str:
    if tok.type == Token.EOF:
        return "<EOF>"
    name = token_name(tok.type)
    # słowa kluczowe i symbole są swoją własną nazwą, pozostałe tokeny pokazujemy z tekstem
    return name if name.startswith("'") else f"{name}({tok.text})"

def rule_name(node) -> str:
    return TrafficLightParser.ruleNames[node.getRuleIndex()]

def is_leaf_like(node) -> bool:
    """Token albo reguła z jednym tokenem (np. signalType -> 'pojazdy')."""
    if isinstance(node, TerminalNode):
        return True
    children = list(node.getChildren())
    return len(children) == 1 and isinstance(children[0], TerminalNode)

def leaf_label(node) -> str:
    if isinstance(node, ErrorNode):
        return c(f"✗{node.getText()}", RED)
    if isinstance(node, TerminalNode):
        return token_label(node.getSymbol())
    return f"{rule_name(node)}({leaf_label(node.getChild(0))})"

def print_tree(node, prefix: str = "", last: bool = True, root: bool = True):
    branch = "" if root else prefix + ("└── " if last else "├── ")
    child_prefix = "" if root else prefix + ("    " if last else "│   ")

    label = c(rule_name(node), CYAN)
    if node.exception is not None:
        label += c("  ✗ (reguła niedokończona)", RED)

    children = list(node.getChildren())
    if children and all(is_leaf_like(ch) for ch in children):
        print(branch + label + " ── " + "  ".join(leaf_label(ch) for ch in children))
        return
    print(branch + label)

    # kolejne tokeny obok siebie łączymy w jedną linię, żeby drzewo mieściło się na ekranie
    groups = []
    for ch in children:
        if is_leaf_like(ch):
            if groups and isinstance(groups[-1], list):
                groups[-1].append(ch)
            else:
                groups.append([ch])
        else:
            groups.append(ch)

    for i, g in enumerate(groups):
        is_last = i == len(groups) - 1
        if isinstance(g, list):
            print(child_prefix + ("└── " if is_last else "├── ") + "  ".join(leaf_label(n) for n in g))
        else:
            print_tree(g, child_prefix, is_last, root=False)

def show_sentence(path: str, show_lisp: bool):
    with open(path, "r", encoding="utf-8") as f:
        source = f.read()

    print()
    print(c("═" * 74, YELLOW))
    print(c(f" ZDANIE: {os.path.relpath(path, ROOT)}", YELLOW))
    print(c("═" * 74, YELLOW))

    header("1. WEJŚCIE (tekst, który podajemy parserowi)")
    for nr, line in enumerate(source.splitlines(), start=1):
        print(c(f"{nr:>3} │ ", DIM) + line)

    header("2. LEKSER → strumień tokenów")
    lexer = TrafficLightLexer(InputStream(source))
    lexer_listener = CompilerErrorListener()
    lexer.removeErrorListeners()
    lexer.addErrorListener(lexer_listener)
    stream = CommonTokenStream(lexer)
    stream.fill()

    by_line = {}
    for tok in stream.tokens:
        by_line.setdefault(tok.line, []).append(tok)
    for line, toks in by_line.items():
        print(c(f"  linia {line:>3}: ", DIM) + "  ".join(token_label(t) for t in toks))
    print(c(f"  Liczba tokenów: {len(stream.tokens)} (białe znaki i komentarze lekser pomija).", DIM))
    for err in lexer_listener.errors:
        print(c(f"  ✗ {err}", RED))

    header("3. PARSER → drzewo rozbioru (reguła startowa: program)")
    parser = TrafficLightParser(stream)
    parser_listener = CompilerErrorListener()
    parser.removeErrorListeners()
    parser.addErrorListener(parser_listener)
    tree = parser.program()

    print_tree(tree)
    if show_lisp:
        print()
        print(c("  Surowe drzewo z ANTLR (toStringTree):", DIM))
        print("  " + tree.toStringTree(recog=parser))
    for err in parser_listener.errors:
        print(c(f"  ✗ {err}", RED))

    header("4. WYNIK")
    errors = lexer_listener.errors + parser_listener.errors
    if errors:
        print(c(f"  ✗ ZDANIE NIEPOPRAWNE: nie należy do języka (błędów składniowych: {len(errors)}).", RED))
        print(c("    Analiza semantyczna pominięta, bo nie ma poprawnego drzewa.", DIM))
        return False, None

    print(c("  ✓ ZDANIE POPRAWNE SKŁADNIOWO: należy do języka generowanego przez gramatykę.", GREEN))

    ast = AstBuilderVisitor().visit(tree)
    print(c(f"    AST: skrzyżowanie '{ast.name}', kierunków: {len(ast.directions)}, "
            f"kolizji: {len(ast.collisions)}, kroków cyklu: {len(ast.steps)}.", DIM))
    try:
        SemanticValidator().validate(ast)
        print(c("  ✓ Analiza semantyczna (już poza parserem): program poprawny i bezpieczny.", GREEN))
        return True, None
    except SemanticError as e:
        print(c(f"  ✗ Analiza semantyczna (już poza parserem): {e.__class__.__name__}", RED))
        print(c(f"    {e}", RED))
        return True, e.__class__.__name__

def main():
    argp = argparse.ArgumentParser(description="Pokaz działania parsera TrafficLight DSL")
    argp.add_argument("pliki", nargs="*", help="Pliki .traffic (domyślnie wszystkie z demo/zdania/)")
    argp.add_argument("--lisp", action="store_true", help="Wypisz też surowe drzewo z ANTLR (toStringTree)")
    argp.add_argument("--bez-pauzy", action="store_true", help="Nie czekaj na Enter między zdaniami")
    args = argp.parse_args()

    paths = args.pliki or sorted(glob.glob(os.path.join(ZDANIA_DIR, "*.traffic")))
    pause = not args.pliki and not args.bez_pauzy and sys.stdin.isatty()

    results = []
    for i, path in enumerate(paths):
        if i > 0 and pause:
            input(c("\n[Enter] następne zdanie...", DIM))
        results.append((path, *show_sentence(path, args.lisp)))

    if len(results) > 1:
        header("PODSUMOWANIE")
        for path, syntax_ok, sem_error in results:
            parser_col = c("✓ parser akceptuje", GREEN) if syntax_ok else c("✗ parser odrzuca  ", RED)
            if not syntax_ok:
                sem_col = c("-", DIM)
            elif sem_error:
                sem_col = c(f"✗ semantyka: {sem_error}", RED)
            else:
                sem_col = c("✓ semantyka OK", GREEN)
            print(f"  {os.path.basename(path):<46} {parser_col}   {sem_col}")

if __name__ == "__main__":
    main()
