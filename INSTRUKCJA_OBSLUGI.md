# Instrukcja obsługi i uruchomienia kompilatora

Kompilator języka TrafficLight DSL realizowany w ramach przedmiotu Języki formalne i kompilatory 2.

## 1. Wymagania

* Python 3.10 lub nowszy (dostępny w środowisku `.venv`).
* Biblioteka `antlr4-python3-runtime` (zainstalowana w `.venv`).
* Java 11+ lub 21: wymagana wyłącznie przy modyfikacji gramatyki `.g4` i regeneracji parsera (w katalogu `tools/` znajduje się archiwum `antlr-4.13.2-complete.jar`).

## 2. Uruchomienie interfejsu graficznego i symulatora 2D

Serwer aplikacji korzysta z biblioteki standardowej Pythona (`http.server`), więc nie wymaga instalowania dodatkowych pakietów z pip.

Uruchomienie serwera:
```powershell
python run_gui.py
```
Aplikacja otwiera przeglądarkę pod adresem:
`http://localhost:8000`

Możliwości interfejsu:
* Edytor kodu źródłowego z obsługą wcięć Tab, wyborem programu z listy i przyciskiem przywracania oryginalnego kodu.
* Kompilacja w czasie rzeczywistym klawiszem F5 lub przyciskiem w nagłówku.
* Dziennik etapów kompilacji z podglądem analizy leksykalnej, składniowej, budowy AST, weryfikacji semantycznej i generacji kodu.
* Symulator ronda 2D (Konva) z ruchem pojazdów, torowiskiem tramwajowym, rogatkami kolejowymi i przejściami dla pieszych.
* Wskaźniki automatu Moore'a z odliczaniem czasu kroku i licznikiem cykli.
* Czerwony baner ostrzegawczy w przypadku wykrycia kolizji lub błędu semantycznego w cyklu.
* Kopiowanie i pobieranie wygenerowanego kodu `sterownik.py` oraz danych automatu w formacie JSON.

## 3. Kompilacja z linii poleceń (CLI)

Kompilacja do kodu sterownika Python:
```powershell
python compiler.py examples/rondo_autorskie.traffic -o sterownik.py
```
Plik `sterownik.py` realizuje automat Moore'a w czasie rzeczywistym.

Uruchomienie wygenerowanego sterownika:
```powershell
# Uruchomienie standardowe w czasie rzeczywistym
python sterownik.py

# Uruchomienie przyspieszone 2x na 3 pełne cykle
python sterownik.py --speed 2.0 --cycles 3

# Szybki przebieg weryfikacyjny bez czekania
python sterownik.py --dry-run
```

Zapisanie reprezentacji pośredniej IR (DFA JSON):
```powershell
python compiler.py examples/rondo_autorskie.traffic --dfa-json automat.json
```

Weryfikacja wykrywania kolizji:
Jeśli w programie dwa kolidujące kierunki otrzymają jednocześnie zezwolenie na ruch, kompilator zakończy działanie z kodem błędu 1 i komunikatem:
`CollisionConflictException: Krok X (linia Y): wykryto konflikt kolizyjny! Kierunki 'A' i 'B' mają jednocześnie zielone światło`.

## 4. Regeneracja leksera i parsera (ANTLR4)

W przypadku edycji pliku gramatyki `grammar/TrafficLight.g4` należy uruchomić skrypt generujący:

PowerShell:
```powershell
.\generate_parser.ps1
```

CMD:
```cmd
generate_parser.bat
```

## 5. Układ katalogów projektu

* `compiler.py`: główny program kompilatora CLI.
* `run_gui.py`: lokalny serwer interfejsu webowego (Python `http.server`).
* `gui/`: aplikacja webowa Vite, TypeScript i Konva (`src/`, `index.html`, produkcyjny `dist/`).
* `grammar/TrafficLight.g4`: gramatyka ANTLR4.
* `src/`:
  * `ast_nodes.py`: struktury węzłów AST.
  * `ast_builder.py`: visitor przekształcający ParseTree w AST.
  * `semantic_validator.py`: sprawdzanie kolizji, typów i czasów.
  * `dfa_generator.py`: generowanie modelu automatu Moore'a (IR JSON).
  * `code_generator.py`: generator kodu sterownika Python (`sterownik.py`).
  * `generated/`: kod leksera i parsera wygenerowany przez ANTLR.
* `docs/`:
  * `specyfikacja_jezyka.md`: gramatyka EBNF, tokeny i reguły.
  * `model_automatu.md`: model automatu i dowód bezkolizyjności.
* `examples/`: przykładowe pliki źródłowe (`.traffic`).
* `tools/`: biblioteka `antlr-4.13.2-complete.jar`.
