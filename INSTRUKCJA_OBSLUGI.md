# Instrukcja Obsługi i Uruchomienia Kompilatora

Kompilator języka TrafficLight DSL realizowany w ramach przedmiotu **Języki formalne i kompilatory 2**.

---

## 1. Wymagania

* Python 3.10 lub nowszy (dostępny w środowisku `.venv`)
* Biblioteka `antlr4-python3-runtime` (zainstalowana w `.venv`)
* Java 11+ / 21 — wymagana wyłącznie w przypadku edycji pliku gramatyki `.g4` i regeneracji parsera (w repozytorium znajduje się już gotowy `tools/antlr-4.13.2-complete.jar`)

---

## 2. Uruchomienie Interaktywnego GUI i Symulatora 2D

Aplikacja webowa opiera się wyłącznie na standardowej bibliotece Pythona (`http.server`), co oznacza **brak konieczności instalowania jakichkolwiek pakietów GUI/pip**.

Uruchomienie serwera:
```powershell
python run_gui.py
```
Aplikacja automatycznie otworzy przeglądarkę pod adresem:
👉 **`http://localhost:8000`**

### Możliwości GUI:
* **Edytor kodu źródłowego:** Podświetlanie składni, wybór gotowych przykładów z rozwijanej listy.
* **Kompilacja w czasie rzeczywistym:** Klawisz `F5` lub przycisk *Kompiluj* uruchamia pełny pipeline kompilatora.
* **Dziennik logów (5 mikroczynności):** Podgląd faz analizy leksykalnej, składniowej, budowy AST, dowodu bezkolizyjności oraz generacji kodu.
* **Animowany symulator skrzyżowania 2D (Canvas):**
  - Wizualizacja ruchu samochodów (Północ-Południe i Wschód-Zachód),
  - Dynamiczne przejścia dla pieszych z sygnalizacją 2-kolorową,
  - Torowisko tramwajowe z sygnalizacją torową STK,
  - Przejazd kolejowy z animowanymi rogatkami opadającymi przy przejeździe pociągu,
  - Wskaźnik stanu automatu Moore'a z odliczaniem czasu,
  - **Dynamiczny czerwony alert kolizji:** w przypadku wczytania błędnego programu (np. `skrzyzowanie_kolizja.traffic`) symulator podświetla konflikt na czerwono.
* **Eksport kodu sterownika:** Przycisk *Pobierz sterownik.py* pozwala natychmiast zapisać wygenerowany kod wynikowy.

---

## 3. Kompilacja i Generowanie Kodu z Linii Poleceń (CLI)

### Kompilacja do kodu sterownika Python (Target Code Generation):
```powershell
python compiler.py examples/skrzyzowanie_zintegrowane.traffic -o sterownik.py
```
Wygenerowany plik `sterownik.py` jest w 100% samodzielnym programem realizującym automat Moore'a w czasie rzeczywistym.

### Uruchomienie wygenerowanego sterownika:
```powershell
# Uruchomienie standardowe w czasie rzeczywistym
python sterownik.py

# Uruchomienie przyspieszone 2x na 3 pełne cykle
python sterownik.py --speed 2.0 --cycles 3

# Szybki przebieg weryfikacyjny bez czekania
python sterownik.py --dry-run
```

### Zapisanie reprezentacji pośredniej IR (DFA JSON):
```powershell
python compiler.py examples/skrzyzowanie_zintegrowane.traffic --dfa-json automat.json
```

### Test wykrywania kolizji (przykład błędny):
```powershell
python compiler.py examples/skrzyzowanie_kolizja.traffic
```
Kompilator natychmiast przerywa działanie z kodem wyjścia `1` i błędem:
`CollisionConflictException: Krok 2 (linia 22): wykryto konflikt kolizyjny! Kierunki 'NS' i 'WE' mają jednocześnie zielone światło`.

---

## 4. Regeneracja Leksera i Parsera (ANTLR4)

W przypadku modyfikacji pliku gramatyki `grammar/TrafficLight.g4`, należy uruchomić skrypt generujący:

**PowerShell:**
```powershell
.\generate_parser.ps1
```

**CMD:**
```cmd
generate_parser.bat
```

---

## 5. Układ Katalogów Projektu

* `compiler.py` — główny program kompilatora CLI
* `run_gui.py` — lokalny serwer GUI i symulatora (standardowy `http.server`)
* `gui/` — pliki interfejsu webowego (`index.html`, `styles.css`, `app.js`)
* `grammar/TrafficLight.g4` — formalna gramatyka ANTLR4
* `src/`
  * `ast_nodes.py` — struktury węzłów AST
  * `ast_builder.py` — visitor przekształcający ParseTree w AST
  * `semantic_validator.py` — statyczna weryfikacja kolizji, typów i czasów
  * `dfa_generator.py` — generacja modelu automatu Moore'a (IR JSON)
  * `code_generator.py` — generator kodu docelowego Python (`sterownik.py`)
  * `generated/` — pliki leksera i parsera wygenerowane przez ANTLR
* `docs/`
  * `specyfikacja_jezyka.md` — formalna gramatyka EBNF, tokeny i reguły
  * `model_automatu.md` — formalny model automatu i dowód bezkolizyjności
* `examples/` — przykładowe pliki źródłowe (`.traffic`)
* `tools/` — biblioteka `antlr-4.13.2-complete.jar`
