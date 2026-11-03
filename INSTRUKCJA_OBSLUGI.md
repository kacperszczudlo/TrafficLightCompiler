# Instrukcja Obsługi i Uruchomienia Kompilatora

Kompilator języka TrafficLight DSL realizowany w ramach przedmiotu **Języki formalne i kompilatory 2**.

---

## 1. Wymagania

* Python 3.10 lub nowszy
* Środowisko wirtualne `.venv` ze zainstalowaną biblioteką `antlr4-python3-runtime`
* Java Runtime Environment (JRE/JDK) — wymagana tylko w przypadku regeneracji parsera z pliku `.g4`

---

## 2. Aktywacja Środowiska

**PowerShell (Windows):**
```powershell
.\.venv\Scripts\Activate.ps1
```

**Wiersz poleceń (CMD Windows):**
```cmd
.\.venv\Scripts\activate.bat
```

---

## 3. Kompilacja i Weryfikacja Plików `.traffic`

### Weryfikacja i podgląd automatu DFA w konsoli:
```powershell
python compiler.py examples/skrzyzowanie_proste.traffic -v
```

### Zapisanie wygenerowanego kodu automatu DFA do pliku JSON:
```powershell
python compiler.py examples/skrzyzowanie_proste.traffic -o automat.json
```

### Test wykrywania kolizji (przykład błędny):
```powershell
python compiler.py examples/skrzyzowanie_kolizja.traffic
```
Kompilator natychmiast przerywa działanie z kodem błędu `1` oraz komunikatem błędu semantycznego `CollisionConflictException`.

---

## 4. Regeneracja Leksera i Parsera (ANTLR4)

W przypadku modyfikacji pliku gramatyki `grammar/TrafficLight.g4`, należy uruchomić skrypt regenerujący kod Pythona w katalogu `src/generated/`:

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

* `compiler.py` — punkt wejściowy CLI (weryfikacja, błędy, generacja wyjścia)
* `grammar/TrafficLight.g4` — formalna gramatyka ANTLR4
* `src/`
  * `ast_nodes.py` — struktury węzłów AST
  * `ast_builder.py` — visitor przekształcający ParseTree w AST
  * `semantic_validator.py` — statyczna weryfikacja kolizji, typów i czasów
  * `dfa_generator.py` — generacja modelu automatu Moore'a (IR / JSON)
  * `generated/` — pliki leksera i parsera wygenerowane przez ANTLR
* `docs/`
  * `specyfikacja_jezyka.md` — formalna gramatyka EBNF, tokeny i reguły
  * `model_automatu.md` — formalny model automatu i dowód bezkolizyjności
* `examples/` — przykładowe pliki źródłowe (`.traffic`)
