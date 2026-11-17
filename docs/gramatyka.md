# Gramatyka i sprawdzanie poprawności TrafficLight DSL

Ten dokument zbiera w jednym miejscu trzy rzeczy:

1. **gramatykę języka**, czyli leksykę i składnię z [grammar/TrafficLight.g4](../grammar/TrafficLight.g4),
2. **sprawdzanie poprawności składniowej**: jak kompilator stwierdza, że tekst pasuje do gramatyki,
3. **sprawdzanie poprawności semantycznej**: jak stwierdza, że program ma sens i jest bezpieczny.

Wszystkie komunikaty błędów w tym dokumencie pochodzą z rzeczywistych uruchomień kompilatora.

---

## 0. Droga programu przez kompilator

```text
plik .traffic
   │
   ▼ [1/5] Lekser   (src/generated/TrafficLightLexer.py)  → tokeny          ┐ poprawność
   ▼ [2/5] Parser   (src/generated/TrafficLightParser.py) → drzewo rozbioru ┘ składniowa
   ▼ [3/5] AstBuilderVisitor (src/ast_builder.py)         → IntersectionNode (AST)
   ▼ [4/5] SemanticValidator (src/semantic_validator.py)  → TAK / NIE         poprawność semantyczna
   ▼ [5/5] DfaGenerator + PythonCodeGenerator             → automat Moore'a (JSON) + sterownik.py
```

Całość spina funkcja `compile_source_string` w [compiler.py](../compiler.py). Z niej korzystają CLI, GUI i testy.

**Dlaczego dwa poziomy?** Gramatyka bezkontekstowa opisuje tylko *kształt* tekstu. Nie wyrazi reguły „każdy kierunek zadeklarowany w `kierunki` musi dostać stan w każdym kroku”, bo do tego trzeba pamiętać wcześniej zadeklarowane nazwy, a to zależność kontekstowa. Takie reguły sprawdza osobny walidator na drzewie AST.

---

## 1. Leksyka (tokeny)

### 1.1. Tokeny nazwane

| Token | Wzorzec | Przykłady | Uwagi |
| :--- | :--- | :--- | :--- |
| `TIME_LITERAL` | `[0-9]+ ('ms' \| 's' \| 'm')` | `500ms`, `3s`, `2m` | `m` to **minuty**. Bez jednostki lub ze spacją (`10 s`) nie jest tokenem. |
| `STRING_LITERAL` | `'"' (~["\\] \| '\\' .)* '"'` | `"Rondo_Autorskie"` | Używany tylko jako nazwa skrzyżowania. Polskie znaki są dozwolone. |
| `ID` | `[a-zA-Z_][a-zA-Z0-9_]*` | `Wlot_Zachod`, `NS` | Tylko ASCII, polskie litery są niedozwolone. |
| `COMMENT_LINE` | `'//' ~[\r\n]*` | `// komentarz` | Pomijany (`-> skip`). |
| `COMMENT_BLOCK` | `'/*' .*? '*/'` | `/* blok */` | Pomijany, nie zagnieżdża się. |
| `WS` | `[ \t\r\n]+` | | Pomijany. |

### 1.2. Słowa zarezerwowane i symbole

Każdy literał w cudzysłowie użyty w regułach parsera ANTLR zamienia na **niejawny token**. W efekcie zarezerwowane są:

* **słowa kluczowe:** `skrzyzowanie`, `kierunki`, `kolizje`, `cykl`, `krok`, `czas`,
* **typy sygnalizatorów:** `pojazdy`, `samochody`, `piesi`, `tramwaje`, `kolej`, `rowery`,
* **stany świateł:** `CZERWONE`, `CZERWONE_ZOLTE`, `ZIELONE`, `ZOLTE`, `ZOLTE_MIGAJACE`, `WYLACZONE`, `ZIELONE_MIGAJACE`, `TRAM_STOJ`, `TRAM_JAZDA`, `TRAM_UWAGA`, `PRZEJAZD_OTWARTY`, `PRZEJAZD_OSTRZEZENIE`, `PRZEJAZD_ZAMKNIETY`,
* **symbole:** `{` `}` `(` `)` `:` `;` `<->`.

Z tego wynikają trzy reguły:

* **Słowo zarezerwowane nie może być nazwą kierunku.** Tekst `piesi` pasuje i do słowa kluczowego, i do `ID`, przy tej samej długości. ANTLR wybiera wtedy regułę zdefiniowaną wcześniej, a niejawne tokeny są zawsze przed regułami leksera. Dlatego `piesi: pojazdy;` daje `mismatched input 'piesi' expecting {'}', ID}`.
* **Wielkość liter ma znaczenie.** `KIERUNKI` to zwykły `ID`, a nie słowo kluczowe.
* **Najdłuższe dopasowanie.** `500ms` to jeden token `TIME_LITERAL` (jednostka `ms`), a nie `500m` i osobne `s`.

---

## 2. Składnia (reguły parsera)

### 2.1. Reguły

Gramatyka ma 11 reguł parsera:

```antlr
program            : intersection EOF ;

intersection       : 'skrzyzowanie' STRING_LITERAL '{'
                         directionsSection
                         collisionsSection?
                         cycleSection
                     '}' ;

directionsSection  : 'kierunki' '{' directionDef* '}' ;
directionDef       : ID ':' signalType ';' ;
signalType         : 'pojazdy' | 'samochody' | 'piesi' | 'tramwaje' | 'kolej' | 'rowery' ;

collisionsSection  : 'kolizje' '{' collisionDef* '}' ;
collisionDef       : ID '<->' ID ';' ;

cycleSection       : 'cykl' '{' stepDef* '}' ;
stepDef            : 'krok' '(' 'czas' ':' TIME_LITERAL ')' '{' stateAssignment* '}' ;
stateAssignment    : ID ':' lightState ';' ;

lightState         : 'CZERWONE' | 'CZERWONE_ZOLTE' | 'ZIELONE' | 'ZOLTE' | 'ZOLTE_MIGAJACE'
                   | 'WYLACZONE' | 'ZIELONE_MIGAJACE'
                   | 'TRAM_STOJ' | 'TRAM_JAZDA' | 'TRAM_UWAGA'
                   | 'PRZEJAZD_OTWARTY' | 'PRZEJAZD_OSTRZEZENIE' | 'PRZEJAZD_ZAMKNIETY' ;
```

Ten sam zapis w notacji EBNF (ISO/IEC 14977) jest w [specyfikacja_jezyka.md](specyfikacja_jezyka.md#2-formalna-gramatyka-bezkontekstowa-ebnf).

### 2.2. Co wynika z gramatyki

* **Jeden plik to dokładnie jedno skrzyżowanie.** Po zamykającej klamrze może być tylko `EOF` (albo komentarze).
* **Kolejność sekcji jest sztywna:** `kierunki`, potem opcjonalnie `kolizje`, potem `cykl`. Zamiana kolejności to błąd składniowy.
* **Sekcja `kolizje` jest opcjonalna** (`?`). Sekcje `kierunki` i `cykl` są obowiązkowe, ale **mogą być puste** (`*` oznacza zero lub więcej). Puste sekcje odrzuca dopiero semantyka (punkt 5).
* **Każda definicja i każde przypisanie kończy się średnikiem.**
* **Gramatyka nie sprawdza zgodności typów.** Parser przyjmie `piesi` z sygnałem `TRAM_JAZDA`, bo `lightState` to jedna wspólna lista stanów. Dopasowanie stanu do typu sprawdza walidator.

### 2.3. Własności formalne

* **LL(1).** W każdym punkcie wyboru wystarcza jeden token podglądu. Po `directionsSection` parser widzi `kolizje` albo `cykl`. W pętlach `*` widzi `ID` (lub `krok`) albo `}`. Alternatywy w `signalType` i `lightState` to różne literały.
* **Brak rekurencji.** Żadna reguła nie odwołuje się do siebie ani bezpośrednio, ani pośrednio, a zagnieżdżenie klamer ma stałą głębokość (najwyżej 3: `skrzyzowanie { cykl { krok { … } } }`). Formalnie generowany język jest więc nawet regularny. Zapis bezkontekstowy daje czytelną strukturę i drzewo rozbioru, na którym pracuje budowa AST.

### 2.4. Przykład: program i jego drzewo rozbioru

```text
skrzyzowanie "Proste" {
    kierunki { NS: samochody; WE: samochody; }
    kolizje  { NS <-> WE; }
    cykl {
        krok(czas: 20s) { NS: ZIELONE;        WE: CZERWONE;       }
        krok(czas: 3s)  { NS: ZOLTE;          WE: CZERWONE;       }
        krok(czas: 2s)  { NS: CZERWONE;       WE: CZERWONE_ZOLTE; }
        krok(czas: 20s) { NS: CZERWONE;       WE: ZIELONE;        }
        krok(czas: 3s)  { NS: CZERWONE;       WE: ZOLTE;          }
        krok(czas: 2s)  { NS: CZERWONE_ZOLTE; WE: CZERWONE;       }
    }
}
```

```text
program
├── intersection
│   ├── 'skrzyzowanie'  STRING_LITERAL("Proste")  '{'
│   ├── directionsSection
│   │   ├── 'kierunki' '{'
│   │   ├── directionDef ── ID(NS) ':' signalType('samochody') ';'
│   │   ├── directionDef ── ID(WE) ':' signalType('samochody') ';'
│   │   └── '}'
│   ├── collisionsSection
│   │   ├── 'kolizje' '{'
│   │   ├── collisionDef ── ID(NS) '<->' ID(WE) ';'
│   │   └── '}'
│   ├── cycleSection
│   │   ├── 'cykl' '{'
│   │   ├── stepDef ── 'krok' '(' 'czas' ':' TIME_LITERAL(20s) ')' '{'
│   │   │             ├── stateAssignment ── ID(NS) ':' lightState('ZIELONE') ';'
│   │   │             ├── stateAssignment ── ID(WE) ':' lightState('CZERWONE') ';'
│   │   │             └── '}'
│   │   ├── stepDef ── … (5 kolejnych kroków)
│   │   └── '}'
│   └── '}'
└── EOF
```

---

## 3. Sprawdzanie poprawności składniowej

### 3.1. Mechanizm

Etapy 1 i 2 w `compile_source_string` ([compiler.py:31-59](../compiler.py#L31-L59)):

1. Lekser i parser dostają własny `CompilerErrorListener` ([compiler.py:13-19](../compiler.py#L13-L19)) zamiast domyślnego, który pisze na konsolę. Listener zbiera błędy do listy.
2. Wywołanie `parser.program()` buduje drzewo rozbioru od reguły startowej.
3. Domyślna strategia ANTLR (`DefaultErrorStrategy`) **naprawia błąd i parsuje dalej**: wstawia brakujący token, pomija nadmiarowy albo synchronizuje się do najbliższego pasującego tokenu. Dzięki temu w jednym przebiegu zgłaszane są **wszystkie** błędy składniowe, a nie tylko pierwszy.
4. Jeśli lista błędów leksera i parsera nie jest pusta, kompilacja kończy się wynikiem `valid=False`, `error_type="SyntaxError"`, a komunikaty są łączone znakiem nowej linii. **AST, walidacja, automat i kod nie powstają** (`dfa=None`).

Format komunikatu: `Błąd składniowy [linia L:K]: <komunikat ANTLR>`. Linie liczone są od 1, kolumny od 0.

### 3.2. Typowe błędy składniowe

| Błąd w kodzie | Komunikat |
| :--- | :--- |
| Brak średnika: `A: pojazdy B: pojazdy;` | `missing ';' at 'B'` |
| Literówka w stanie: `A: CZERWNE;` | `mismatched input 'CZERWNE' expecting {'CZERWONE', 'CZERWONE_ZOLTE', …}` |
| Nieznany typ: `A: auta;` | `mismatched input 'auta' expecting {'pojazdy', 'samochody', 'piesi', 'tramwaje', 'kolej', 'rowery'}` |
| Słowo zarezerwowane jako nazwa: `piesi: pojazdy;` | `mismatched input 'piesi' expecting {'}', ID}` |
| Wielkie litery w słowie kluczowym: `KIERUNKI { … }` | `mismatched input 'KIERUNKI' expecting 'kierunki'` |
| Brak nazwy skrzyżowania | `missing STRING_LITERAL at '{'` |
| Brak sekcji `cykl` | `mismatched input '}' expecting {'kolizje', 'cykl'}` |
| Sekcje w złej kolejności (`kolizje` po `cykl`) | `mismatched input 'kolizje' expecting '}'` |
| Brak `czas:` w kroku: `krok(5s)` | `mismatched input '5s' expecting 'czas'` |
| Brak zamykającej klamry | `missing '}' at '<EOF>'` |
| Tekst po zamykającej klamrze | `extraneous input 'cykl' expecting <EOF>` |
| Czas bez jednostki: `czas: 10` | `token recognition error at: '10)'` (błąd leksera) |
| Czas ze spacją: `czas: 10 s` | `token recognition error at: '10 '` (błąd leksera) |
| Zły operator kolizji: `A <> B;` | `token recognition error at: '<>'`, a potem `missing '<->' at 'B'` |
| Polskie litery w nazwie: `Wlot_Łódź` | `token recognition error at: 'Ł'` (i dla kolejnych liter) |
| Niedozwolony znak, np. `@` | `token recognition error at: '@'` |

**Wskazówka:** przy błędzie leksera (`token recognition error`) parser często zgłasza dalsze błędy, które są jego skutkiem. Zawsze poprawiaj od pierwszego komunikatu.

---

## 4. Budowa AST

`AstBuilderVisitor` ([src/ast_builder.py](../src/ast_builder.py)) przechodzi drzewo rozbioru i buduje dwie klasy z [src/ast_nodes.py](../src/ast_nodes.py):

| Węzeł | Pole | Typ | Zawartość |
| :--- | :--- | :--- | :--- |
| `IntersectionNode` | `name` | `str` | Nazwa bez cudzysłowów (`strip('"')`). Sekwencje `\"` nie są interpretowane. |
| | `directions` | `dict[str, str]` | kierunek → typ sygnalizatora |
| | `collisions` | `list[tuple[str, str]]` | pary z sekcji `kolizje` (pusta lista, gdy sekcji brak) |
| | `steps` | `list[StepNode]` | kroki w kolejności z pliku |
| `StepNode` | `duration_ms` | `int` | czas w milisekundach (`parse_duration_to_ms`: `ms`×1, `s`×1000, `m`×60000) |
| | `duration_raw` | `str` | czas w oryginalnym zapisie, do komunikatów |
| | `assignments` | `dict[str, str]` | kierunek → stan w tym kroku |
| | `line` | `int` | numer linii, do komunikatów |

`directions` i `assignments` to słowniki, więc **powtórzona nazwa nadpisuje poprzednią** bez żadnego błędu (zob. punkt 6).

---

## 5. Sprawdzanie poprawności semantycznej

### 5.1. Kolejność sprawdzeń

`SemanticValidator.validate` ([src/semantic_validator.py:52-59](../src/semantic_validator.py#L52-L59)) uruchamia 7 sprawdzeń po kolei. **Pierwszy błąd przerywa walidację** (rzucany jest wyjątek), więc zgłaszany jest zawsze tylko jeden błąd semantyczny.

| # | Metoda | Reguła | Wyjątek |
| :-: | :--- | :--- | :--- |
| 1 | `_validate_directions` | Sekcja `kierunki` zawiera co najmniej jeden kierunek. | `SemanticError` |
| 2 | `_validate_collisions` | Obie strony każdej pary `A <-> B` są zadeklarowane w `kierunki`. | `UndeclaredDirectionError` |
| 3 | `_validate_cycle_structure` | Cykl ma co najmniej 2 kroki. | `CycleTooShortError` |
| | | Czas każdego kroku jest > 0 (np. `0s` jest błędem). | `InvalidTimeDurationError` |
| 4 | `_validate_step_completeness` | Krok używa tylko zadeklarowanych kierunków... | `UndeclaredDirectionError` |
| | | ...i ustawia stan **każdego** zadeklarowanego kierunku. | `IncompleteStepDefinitionError` |
| 5 | `_validate_light_states` | Stan pasuje do typu sygnalizatora (tabela 5.2). | `InvalidLightStateForTypeException` |
| 6 | `_validate_collision_safety` | Kolidujące kierunki nie mają jednocześnie stanu „jazda” (tabela 5.3). | `CollisionConflictException` |
| 7 | `_validate_transitions` | Przejścia między kolejnymi krokami są bezpieczne (tabela 5.4). | `InvalidPhaseTransitionError` |
| | | Faza `ZOLTE` trwa co najmniej 2 s. | `InvalidTimeDurationError` |

Wszystkie wyjątki dziedziczą po `SemanticError`.

**Kolejność ma znaczenie.** Sprawdzenia 5–7 odwołują się do `node.directions[...]` i `step.assignments[...]` bez zabezpieczeń, więc działają tylko dzięki temu, że wcześniej przeszło sprawdzenie 4. Kolejność decyduje też o tym, który błąd zobaczysz: program z jednym krokiem, w którym dwa kolidujące kierunki mają zielone, zgłosi `CycleTooShortError` (sprawdzenie 3), a nie kolizję (sprawdzenie 6).

### 5.2. Stany dozwolone dla typów (sprawdzenie 5)

Źródło: `ALLOWED_STATES_BY_TYPE` ([src/semantic_validator.py:31-50](../src/semantic_validator.py#L31-L50)).

| Typ | Dozwolone stany |
| :--- | :--- |
| `pojazdy`, `samochody`, `rowery` | `CZERWONE`, `CZERWONE_ZOLTE`, `ZIELONE`, `ZOLTE`, `ZOLTE_MIGAJACE`, `WYLACZONE` |
| `piesi` | `CZERWONE`, `ZIELONE`, `ZIELONE_MIGAJACE`, `WYLACZONE` |
| `tramwaje` | `TRAM_STOJ`, `TRAM_JAZDA`, `TRAM_UWAGA`, `WYLACZONE` |
| `kolej` | `PRZEJAZD_OTWARTY`, `PRZEJAZD_OSTRZEZENIE`, `PRZEJAZD_ZAMKNIETY`, `WYLACZONE` |

### 5.3. Stany „jazda” i bezkolizyjność (sprawdzenie 6)

Relacja `A <-> B` jest **symetryczna**: walidator dodaje do zbioru zarówno `(A, B)`, jak i `(B, A)`. Dla każdego kroku wybiera kierunki w stanie „jazda” i sprawdza, czy żadna para z nich nie należy do relacji kolizji.

Stany „jazda” definiuje `_is_active_go_state` ([src/semantic_validator.py:114-123](../src/semantic_validator.py#L114-L123)):

| Typ | Stany „jazda” | Uzasadnienie |
| :--- | :--- | :--- |
| `pojazdy`, `samochody`, `rowery` | `ZIELONE`, `CZERWONE_ZOLTE` | `CZERWONE_ZOLTE` liczony ostrożnie, bo kierowcy już ruszają. |
| `piesi` | `ZIELONE`, `ZIELONE_MIGAJACE` | Na migającym zielonym piesi wciąż są na przejściu. |
| `tramwaje` | `TRAM_JAZDA` | |
| `kolej` | `PRZEJAZD_OSTRZEZENIE`, `PRZEJAZD_ZAMKNIETY` | Pociąg zbliża się do przejazdu albo go zajmuje. |

Przykładowy komunikat:

```text
CollisionConflictException: Krok 1 (linia 2): wykryto konflikt kolizyjny! Kierunki 'K' (PRZEJAZD_OSTRZEZENIE)
i 'B' (CZERWONE_ZOLTE) mają jednocześnie sygnał zezwalający na ruch pomimo zadeklarowanej kolizji.
```

### 5.4. Bezpieczne przejścia fazowe (sprawdzenie 7)

Dla każdej pary kolejnych kroków `i → i+1` **oraz dla przejścia z ostatniego kroku do pierwszego** (cykl się zamyka, indeks `(i + 1) % n`) walidator sprawdza każdy kierunek:

| Typ | Zakazane przejście bezpośrednie | Wymagany stan pośredni |
| :--- | :--- | :--- |
| `pojazdy`, `samochody`, `rowery` | `ZIELONE → CZERWONE` | `ZOLTE` |
| `pojazdy`, `samochody`, `rowery` | `CZERWONE → ZIELONE` | `CZERWONE_ZOLTE` |
| `tramwaje` | `TRAM_JAZDA → TRAM_STOJ` | `TRAM_UWAGA` |
| `kolej` | `PRZEJAZD_OTWARTY → PRZEJAZD_ZAMKNIETY` | `PRZEJAZD_OSTRZEZENIE` |

Dodatkowo dla pojazdów, samochodów i rowerów: krok, w którym kierunek ma `ZOLTE`, musi trwać **co najmniej 2000 ms**. Na przykład `1999ms` daje błąd:

```text
InvalidTimeDurationError: Krok 2 (linia 3): faza ZOLTE dla 'A' trwa 1999ms, podczas gdy wymagane minimum bezpieczeństwa to 2s.
```

### 5.5. Wynik po błędzie semantycznym

* `valid=False`, `error_type` to nazwa klasy wyjątku, `error_message` to jego treść.
* **Model automatu (DFA) mimo to jest generowany**, żeby GUI mogło zasymulować skutki błędu, np. zderzenie. **Kod sterownika nie powstaje** (`target_code=None`).
* W CLI ([compiler.py](../compiler.py)) kompilacja kończy się kodem wyjścia `1`.

---

## 6. Czego weryfikacja obecnie nie wyłapuje

Każdy przypadek poniżej został sprawdzony uruchomieniem kompilatora.

### 6.1. Luki w walidacji

| Przypadek | Obecne zachowanie |
| :--- | :--- |
| Ten sam kierunek zadeklarowany dwa razy (`A: pojazdy; … A: piesi;`) | Bez błędu: ostatnia deklaracja nadpisuje poprzednią. Potem może się pojawić **mylący** błąd typu, np. `niedozwolony stan 'ZOLTE' dla sygnalizatora typu 'piesi'`. |
| Ten sam kierunek dwa razy w jednym kroku | Bez błędu, obowiązuje ostatnie przypisanie. |
| Kolizja kierunku z samym sobą (`A <-> A;`) | Akceptowana i nic nie robi. |
| Piesi: `ZIELONE → CZERWONE` bez `ZIELONE_MIGAJACE` | Akceptowane. |
| Pojazdy: `ZOLTE → ZIELONE` (powrót do zielonego bez czerwonego) | Akceptowane. |

### 6.2. Rozbieżności z [specyfikacja_jezyka.md](specyfikacja_jezyka.md)

| Specyfikacja | Kod |
| :--- | :--- |
| §3.1: identyfikatory w `kierunki` muszą być unikalne. | Unikalność nie jest sprawdzana (zob. 6.1). |
| §3.3: dla kolei stanem „jazda” jest tylko `PRZEJAZD_ZAMKNIETY`. | Także `PRZEJAZD_OSTRZEZENIE`. |
| §3.4: reguły przejść tylko dla pojazdów. | Są też reguły dla tramwajów (`TRAM_UWAGA`) i kolei (`PRZEJAZD_OSTRZEZENIE`), a reguły pojazdów obejmują też rowery. |

---

## 7. Jak to sprawdzić samemu

Kompilacja pliku (kod wyjścia `0` oznacza TAK, `1` oznacza NIE):

```bash
python compiler.py examples/rondo_autorskie.traffic
python compiler.py moj_program.traffic -o sterownik.py --dfa-json automat.json
```

Testy: 15 testów, w tym po jednym przypadku dla błędu składniowego i dla każdej klasy błędu semantycznego oprócz pustej sekcji `kierunki`:

```bash
python -m unittest tests.test_compiler
```

Po zmianie [grammar/TrafficLight.g4](../grammar/TrafficLight.g4) trzeba ponownie wygenerować lekser i parser w `src/generated/` (wymaga Javy i `tools/antlr-4.13.2-complete.jar`):

```powershell
./generate_parser.ps1     # albo generate_parser.bat
```
