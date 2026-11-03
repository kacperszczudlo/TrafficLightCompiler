# Instrukcja uruchomienia

Kompilator języka TrafficLight DSL realizowany w ramach przedmiotu Języki formalne i kompilatory 2.

## Zasada działania

Program wczytuje plik konfiguracyjny `.traffic` opisujący skrzyżowanie, analizuje go za pomocą parsera ANTLR4, sprawdza reguły bezpieczeństwa (brak kolizji, minimalne czasy żółtego światła, poprawne sekwencje barw) i generuje tabelę przejść automatu skończonego w formacie JSON.

## Uruchomienie

Przed uruchomieniem aktywuj środowisko wirtualne z wymaganą biblioteką `antlr4-python3-runtime`:

PowerShell:
```powershell
.\.venv\Scripts\Activate.ps1
```

Wiersz poleceń (CMD):
```cmd
.\.venv\Scripts\activate.bat
```

### Kompilacja poprawnego przykładu

Wypisanie tabeli stanów automatu na ekran:
```powershell
python compiler.py examples/skrzyzowanie_proste.traffic -v
```

Zapisanie wyniku do pliku JSON:
```powershell
python compiler.py examples/skrzyzowanie_proste.traffic -o automat.json
```

### Test wykrywania kolizji

Sprawdzenie zachowania na błędnej konfiguracji:
```powershell
python compiler.py examples/skrzyzowanie_kolizja.traffic
```
W tym przypadku kompilator przerwie działanie z błędem `CollisionConflictException`, wskazując numer wiersza i kierunki, które otrzymały zielone światło w tym samym kroku.

## Regeneracja parsera

W razie edycji pliku `grammar/TrafficLight.g4` kod klas w `src/generated/` można zaktualizować za pomocą skryptu:

PowerShell:
```powershell
.\generate_parser.ps1
```

CMD:
```cmd
generate_parser.bat
```

Skrypt uruchamia `tools/antlr-4.13.2-complete.jar` z parametrami `-Dlanguage=Python3 -visitor`.

## Układ plików w projekcie

* `compiler.py` - punkt wejściowy kompilatora, obsługuje parametry wiersza poleceń
* `grammar/TrafficLight.g4` - plik źródłowy gramatyki ANTLR4
* `src/generated/` - wygenerowany przez ANTLR kod leksera i parsera
* `src/ast_nodes.py` - klasy reprezentujące węzły drzewa AST
* `src/ast_builder.py` - implementacja visitora budującego AST z drzewa rozbioru
* `src/semantic_validator.py` - moduł sprawdzający kolizje i poprawność przejść fazowych
* `src/dfa_generator.py` - generator wynikowej struktury JSON automatu Moore'a
* `examples/` - przykładowe pliki źródłowe
