# TrafficLight DSL: wizja projektu, język formalny i wyjście kompilatora

Dokument odpowiada na pytania projektowe: jaki problem rozwiązujemy, co ma opisywać język, jak wygląda jego gramatyka, jak sprawdzamy poprawność programu i co otrzymujemy na wyjściu.

---

## 1. Jaki problem rozwiązujemy?

Sterownik sygnalizacji świetlnej to program, który w pętli zmienia stany świateł na skrzyżowaniu. Dziś pisze się go zwykle ręcznie: w C, w drabinkach PLC albo jako tabelę w arkuszu. Jedna pomyłka w takim programie, na przykład zielone dla dwóch przecinających się kierunków albo przejście z zielonego od razu na czerwone bez żółtego, oznacza realne ryzyko wypadku. Taki błąd wychodzi na jaw dopiero w trakcie testów albo na ulicy.

**Problem:** nie ma prostego, formalnego sposobu zapisu programu sygnalizacji, który da się automatycznie sprawdzić, *zanim* trafi na sterownik.

## 2. Co chcemy osiągnąć? (cel i wizja)

**Cel:** zaprojektować własny język formalny (DSL) do opisu sygnalizacji oraz kompilator, który:

1. sprawdza, czy program jest zapisany zgodnie z gramatyką (poprawność składniowa),
2. dowodzi, że program jest bezpieczny: w żadnym kroku nie ma kolizji, fazy następują w dozwolonej kolejności, czasy są poprawne (poprawność semantyczna),
3. tylko dla poprawnego programu generuje kod sterownika.

**Wizja:** inżynier ruchu opisuje skrzyżowanie w pliku tekstowym `.traffic`, w języku zbliżonym do tego, jak sam myśli o sygnalizacji („kierunek NS ma zielone przez 20 sekund, WE stoi”). Kompilator działa jak kompilator C, który nie zbuduje programu z błędem typów: **nie wygeneruje sterownika, w którym dwa kolidujące kierunki dostają jednocześnie zielone**. Niebezpieczny program nigdy nie trafia na skrzyżowanie.

```
  inżynier ruchu                 kompilator                          sterownik / symulator
 ┌──────────────┐     ┌──────────────────────────────┐     ┌──────────────────────────┐
 │ plik.traffic │ ──► │ składnia? semantyka? kolizje?│ ──► │ sterownik.py + automat   │
 └──────────────┘     └──────────────┬───────────────┘     │ Moore'a (JSON)           │
                                     │ NIE                 └──────────────────────────┘
                                     ▼
                      błąd z numerem linii, brak kodu
```

## 3. Co język ma opisywać? Mikroczynności

> *„Co język ma opisywać, gramatyka to mikroczynności?”*
> *„Język ma opisywać mikroczynności.”*

To dwa różne pojęcia:

* **Język opisuje mikroczynności**, czyli najmniejsze, niepodzielne czynności sterownika. W naszym języku mikroczynnością jest **krok**: *„przez czas t ustaw każdy sygnalizator w określony stan”*. Cały program sygnalizacji to uporządkowany ciąg takich kroków, powtarzany w pętli (cykl).
* **Gramatyka nie jest mikroczynnością.** Gramatyka to zbiór reguł mówiących, *jak wolno zapisać* mikroczynności (i resztę programu), żeby tekst był poprawnym programem.

Przykład jednej mikroczynności zapisanej w języku:

```text
krok(czas: 3s) { NS: ZOLTE; WE: CZERWONE; Piesi: CZERWONE; }
```

czyli: *przez 3 sekundy kierunek NS ma żółte, WE ma czerwone, piesi mają czerwone*.

Rozkład całego programu na mikroczynności dla przykładowego skrzyżowania z rozdziału 7:

| Mikroczynność (krok) | Czas | Co się dzieje |
| :---: | :---: | :--- |
| 1 | 20 s | NS jedzie, piesi idą, WE stoi |
| 2 | 3 s | NS dostaje żółte (ostrzeżenie) |
| 3 | 2 s | WE dostaje czerwone z żółtym (przygotowanie) |
| 4 | 20 s | WE jedzie, NS i piesi stoją |
| 5 | 3 s | WE dostaje żółte |
| 6 | 2 s | NS dostaje czerwone z żółtym, po czym wracamy do kroku 1 |

> Uwaga: w [README.md](../README.md) i w GUI jako „etapy” lub „mikroczynności kompilatora” występuje też 5 faz kompilacji (lekser, parser, AST, walidacja, generacja). To mikroczynności *kompilatora*, a nie te, które opisuje *język*.

## 4. Co ten język ma zapisywać?

Program w języku składa się z trzech sekcji:

| Sekcja | Co zapisuje | Przykład |
| :--- | :--- | :--- |
| `kierunki` | jakie sygnalizatory są na skrzyżowaniu i jakiego są typu | `NS: samochody;` `Piesi: piesi;` |
| `kolizje` | które kierunki przecinają się i **nie mogą** mieć jednocześnie ruchu | `NS <-> WE;` |
| `cykl` | ciąg mikroczynności (kroków) z czasem trwania i stanem każdego sygnalizatora | `krok(czas: 20s) { ... }` |

Typy sygnalizatorów i ich dozwolone stany:

| Typ | Dozwolone stany |
| :--- | :--- |
| `samochody` / `pojazdy` / `rowery` | `CZERWONE`, `CZERWONE_ZOLTE`, `ZIELONE`, `ZOLTE`, `ZOLTE_MIGAJACE`, `WYLACZONE` |
| `piesi` | `CZERWONE`, `ZIELONE`, `ZIELONE_MIGAJACE`, `WYLACZONE` |
| `tramwaje` | `TRAM_STOJ`, `TRAM_JAZDA`, `TRAM_UWAGA`, `WYLACZONE` |
| `kolej` | `PRZEJAZD_OTWARTY`, `PRZEJAZD_OSTRZEZENIE`, `PRZEJAZD_ZAMKNIETY`, `WYLACZONE` |

Czas zapisujemy w milisekundach, sekundach lub minutach: `500ms`, `3s`, `2m`.

## 5. Zamiana na język formalny

### 5.1. Od opisu słownego do zapisu w języku

| Świat rzeczywisty (opis słowny) | Zapis w języku |
| :--- | :--- |
| „Na skrzyżowaniu jest wlot północ–południe dla samochodów” | `NS: samochody;` |
| „Tory jazdy NS i WE się przecinają” | `NS <-> WE;` |
| „Przez 20 s NS ma zielone, WE czerwone, piesi idą” | `krok(czas: 20s) { NS: ZIELONE; WE: CZERWONE; Piesi: ZIELONE; }` |
| „Po ostatniej fazie wracamy do pierwszej” | blok `cykl { ... }` (zawsze cykliczny) |

### 5.2. Definicja formalna gramatyki

Język definiujemy gramatyką bezkontekstową **G = (N, T, P, S)**:

* **N** (symbole nieterminalne, 11 reguł): `program`, `intersection`, `directionsSection`, `directionDef`, `signalType`, `collisionsSection`, `collisionDef`, `cycleSection`, `stepDef`, `stateAssignment`, `lightState`
* **T** (symbole terminalne, czyli tokeny):
  * słowa kluczowe: `skrzyzowanie`, `kierunki`, `kolizje`, `cykl`, `krok`, `czas`
  * typy sygnalizatorów: `pojazdy`, `samochody`, `piesi`, `tramwaje`, `kolej`, `rowery`
  * stany świateł (13): `CZERWONE`, `CZERWONE_ZOLTE`, `ZIELONE`, `ZOLTE`, …
  * separatory: `{` `}` `(` `)` `:` `;` `<->`
  * tokeny definiowane wyrażeniami regularnymi: `ID`, `STRING_LITERAL`, `TIME_LITERAL`
* **P** (reguły produkcji): gramatyka w punkcie 5.3
* **S** (symbol startowy): `program`

Poziomy języka w hierarchii Chomsky'ego:

| Poziom | Klasa języka | Kto sprawdza |
| :--- | :--- | :--- |
| Tokeny (`ID`, `TIME_LITERAL`, …) | regularny (typ 3) | lekser wygenerowany przez ANTLR (automat skończony) |
| Struktura programu (sekcje, kroki) | bezkontekstowy (typ 2) | parser wygenerowany przez ANTLR |
| Reguły bezpieczeństwa (kierunek zadeklarowany, brak kolizji, kolejność faz) | zależne od kontekstu | walidator semantyczny na drzewie AST |

Trzeci wiersz wynika z teorii. Gramatyka bezkontekstowa nie potrafi wyrazić warunku *„każdy kierunek użyty w kroku musi być wcześniej zadeklarowany”* ani *„dwa kierunki z sekcji `kolizje` nie mogą mieć jednocześnie zielonego”*. Dlatego te reguły sprawdza osobna faza semantyczna.

### 5.3. Gramatyka w ANTLR4

Plik: [grammar/TrafficLight.g4](../grammar/TrafficLight.g4)

```antlr
grammar TrafficLight;

// ---------- reguły parsera (składnia, typ 2) ----------
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
stepDef            : 'krok' '(' 'czas' ':' TIME_LITERAL ')' '{' stateAssignment* '}' ;   // mikroczynność
stateAssignment    : ID ':' lightState ';' ;
lightState         : 'CZERWONE' | 'CZERWONE_ZOLTE' | 'ZIELONE' | 'ZOLTE' | 'ZOLTE_MIGAJACE'
                   | 'WYLACZONE' | 'ZIELONE_MIGAJACE'
                   | 'TRAM_STOJ' | 'TRAM_JAZDA' | 'TRAM_UWAGA'
                   | 'PRZEJAZD_OTWARTY' | 'PRZEJAZD_OSTRZEZENIE' | 'PRZEJAZD_ZAMKNIETY' ;

// ---------- reguły leksera (tokeny, typ 3) ----------
TIME_LITERAL   : [0-9]+ ('ms' | 's' | 'm') ;
STRING_LITERAL : '"' (~["\\] | '\\' .)* '"' ;
ID             : [a-zA-Z_][a-zA-Z0-9_]* ;
COMMENT_LINE   : '//' ~[\r\n]* -> skip ;
COMMENT_BLOCK  : '/*' .*? '*/' -> skip ;
WS             : [ \t\r\n]+ -> skip ;
```

Zapis tej samej gramatyki w notacji EBNF jest w [docs/specyfikacja_jezyka.md](specyfikacja_jezyka.md).

### 5.4. Co generuje ANTLR

ANTLR na podstawie gramatyki **generuje kod analizatora** w Pythonie:

```bash
java -jar antlr-4.13.2-complete.jar -Dlanguage=Python3 -visitor -o src/generated grammar/TrafficLight.g4
```

| Plik wygenerowany przez ANTLR | Rola |
| :--- | :--- |
| `src/generated/TrafficLightLexer.py` | lekser: zamienia tekst na strumień tokenów |
| `src/generated/TrafficLightParser.py` | parser: buduje drzewo rozbioru zgodnie z regułami gramatyki |
| `src/generated/TrafficLightVisitor.py` | szkielet wizytora do przechodzenia po drzewie |
| `src/generated/TrafficLightListener.py` | alternatywny szkielet (listener) |

Kompilator korzysta z tych klas: [src/ast_builder.py](../src/ast_builder.py) dziedziczy po wygenerowanym `TrafficLightVisitor` i zamienia drzewo rozbioru na drzewo AST.

Drzewo rozbioru zbudowane przez parser ANTLR dla małego programu:

```text
(program
  (intersection skrzyzowanie "Demo" {
    (directionsSection kierunki {
      (directionDef NS : (signalType samochody) ;)
      (directionDef P : (signalType piesi) ;) })
    (collisionsSection kolizje { (collisionDef NS <-> P ;) })
    (cycleSection cykl {
      (stepDef krok ( czas : 20s ) {
        (stateAssignment NS : (lightState ZIELONE) ;)
        (stateAssignment P : (lightState CZERWONE) ;) }) }) })
  <EOF>)
```

## 6. Czy to, co zapiszemy, jest poprawne?

Poprawność sprawdzamy na dwóch poziomach. Kompilator zatrzymuje się na **pierwszym** znalezionym błędzie i podaje jego przyczynę oraz miejsce w kodzie.

### 6.1. Poprawność składniowa (ANTLR)

Program musi dać się wyprowadzić z gramatyki G. Brak średnika, literówka w słowie kluczowym czy stan spoza listy kończą się błędem `SyntaxError` z numerem linii i kolumny.

### 6.2. Poprawność semantyczna (walidator)

Plik: [src/semantic_validator.py](../src/semantic_validator.py)

| Reguła | Błąd przy naruszeniu |
| :--- | :--- |
| Każdy kierunek użyty w `kolizje` i w krokach musi być zadeklarowany w `kierunki` | `UndeclaredDirectionError` |
| Każdy krok musi ustawić stan **każdego** zadeklarowanego kierunku | `IncompleteStepDefinitionError` |
| Stan musi pasować do typu sygnalizatora (np. piesi nie mają żółtego) | `InvalidLightStateForTypeException` |
| **Dowód bezkolizyjności:** dwa kierunki z sekcji `kolizje` nie mogą w tym samym kroku jednocześnie mieć sygnału zezwalającego na ruch | `CollisionConflictException` |
| Samochody: `ZIELONE → CZERWONE` tylko przez `ZOLTE`; `CZERWONE → ZIELONE` tylko przez `CZERWONE_ZOLTE` | `InvalidPhaseTransitionError` |
| Tramwaje: `TRAM_JAZDA → TRAM_STOJ` tylko przez `TRAM_UWAGA` | `InvalidPhaseTransitionError` |
| Kolej: `PRZEJAZD_OTWARTY → PRZEJAZD_ZAMKNIETY` tylko przez `PRZEJAZD_OSTRZEZENIE` | `InvalidPhaseTransitionError` |
| Żółte trwa co najmniej 2 s; każdy krok trwa dłużej niż 0 | `InvalidTimeDurationError` |
| Cykl ma co najmniej 2 kroki | `CycleTooShortError` |

Przejścia między fazami sprawdzamy również **na granicy cyklu**, czyli między ostatnim a pierwszym krokiem.

Sygnały uznawane za „zezwalające na ruch” przy sprawdzaniu kolizji:

* samochody / pojazdy / rowery: `ZIELONE`, `CZERWONE_ZOLTE`
* piesi: `ZIELONE`, `ZIELONE_MIGAJACE`
* tramwaje: `TRAM_JAZDA`
* kolej: `PRZEJAZD_OSTRZEZENIE`, `PRZEJAZD_ZAMKNIETY` (przejazd zajęty przez pociąg)

## 7. Przykłady

### 7.1. Program poprawny

Proste skrzyżowanie: dwa kierunki samochodowe (NS i WE) i przejście dla pieszych przez jezdnię WE.

```text
skrzyzowanie "Proste" {
    kierunki {
        NS: samochody;
        WE: samochody;
        Piesi: piesi;
    }
    kolizje {
        NS <-> WE;
        WE <-> Piesi;
    }
    cykl {
        krok(czas: 20s) { NS: ZIELONE;        WE: CZERWONE;       Piesi: ZIELONE;  }
        krok(czas: 3s)  { NS: ZOLTE;          WE: CZERWONE;       Piesi: CZERWONE; }
        krok(czas: 2s)  { NS: CZERWONE;       WE: CZERWONE_ZOLTE; Piesi: CZERWONE; }
        krok(czas: 20s) { NS: CZERWONE;       WE: ZIELONE;        Piesi: CZERWONE; }
        krok(czas: 3s)  { NS: CZERWONE;       WE: ZOLTE;          Piesi: CZERWONE; }
        krok(czas: 2s)  { NS: CZERWONE_ZOLTE; WE: CZERWONE;       Piesi: CZERWONE; }
    }
}
```

Wynik kompilacji (`python compiler.py proste.traffic -o sterownik.py`), kod wyjścia **0**:

```text
[1/5] Skanowanie leksykalne (Lexer)...
[2/5] Analiza składniowa (Parser)...
[3/5] Budowa abstrakcyjnego drzewa składniowego (AST)...
      Zbudowano węzeł: 'Proste' (3 kierunków, 6 kroków cyklu)
[4/5] Weryfikacja semantyczna i dowód bezkolizyjności...
      Weryfikacja zakończona SUKCESEM (brak kolizji, poprawne fazy i czasy).
[5/5] Generowanie modelu automatu Moore'a (IR)...
      Wygenerowano automat DFA z 6 stanami.
      Wygenerowano autonomiczny sterownik Python.

[+] Pomyślnie wygenerowano kod sterownika Python: sterownik.py
```

Większy poprawny przykład (rondo z dwiema liniami tramwajowymi i fazą pieszą) jest w [examples/rondo_autorskie.traffic](../examples/rondo_autorskie.traffic): 7 kierunków, 7 kroków, wynik **TAK**.

### 7.2. Programy błędne

Każdy przykład powstał przez zmianę **jednej linii** programu z punktu 7.1. Kroki cyklu zajmują w nim linie 12–17. Wszystkie kończą się kodem wyjścia **1** i nie generują kodu sterownika.

| # | Co zmieniono | Komunikat kompilatora |
| :---: | :--- | :--- |
| 1 | brak średnika: `NS: ZIELONE WE: CZERWONE;` | `SyntaxError`: Błąd składniowy [linia 12:46]: missing ';' at 'WE' |
| 2 | w kroku 1 `WE: ZIELONE` (NS też ma zielone) | `CollisionConflictException`: Krok 1 (linia 12): wykryto konflikt kolizyjny! Kierunki 'NS' (ZIELONE) i 'WE' (ZIELONE) mają jednocześnie sygnał zezwalający na ruch pomimo zadeklarowanej kolizji. |
| 3 | usunięty krok z żółtym dla NS | `InvalidPhaseTransitionError`: Niedozwolone bezpośrednie przejście ZIELONE -> CZERWONE na kierunku 'NS' pomiędzy krokiem 1 a krokiem 2. Wymagana faza ZOLTE. |
| 4 | żółte trwa `1s` zamiast `3s` | `InvalidTimeDurationError`: Krok 2 (linia 13): faza ZOLTE dla 'NS' trwa 1s, podczas gdy wymagane minimum bezpieczeństwa to 2s. |
| 5 | `Piesi: ZOLTE;` | `InvalidLightStateForTypeException`: Krok 2 (linia 13): niedozwolony stan 'ZOLTE' dla sygnalizatora typu 'piesi' na kierunku 'Piesi'. Dozwolone stany: ['CZERWONE', 'WYLACZONE', 'ZIELONE', 'ZIELONE_MIGAJACE']. |
| 6 | w kroku 3 pominięto `Piesi` | `IncompleteStepDefinitionError`: Krok 3 (linia 14): nie zdefiniowano stanu dla kierunków: {'Piesi'}. |
| 7 | w kroku 4 dopisano `Rower: ZIELONE;` bez deklaracji | `UndeclaredDirectionError`: Krok 4 (linia 15): użyto niezadeklarowanych kierunków: {'Rower'}. |

Przykład 1 odrzuca parser wygenerowany przez ANTLR (poziom składni). Przykłady 2–7 są składniowo poprawne, ale odrzuca je walidator semantyczny.

## 8. Co jest na wyjściu: TAK/NIE czy generowanie kodu?

**Jedno i drugie, w tej kolejności:** najpierw werdykt TAK/NIE, a generowanie kodu następuje **tylko przy TAK**.

```
                ┌────────────────────┐
 plik.traffic ─►│ 1. Lekser (ANTLR)  │
                │ 2. Parser (ANTLR)  │── błąd składni ──────────┐
                │ 3. Budowa AST      │                          │
                │ 4. Walidacja       │── błąd semantyczny ──────┤
                └─────────┬──────────┘                          ▼
                          │ TAK                         NIE: kod wyjścia 1,
                          ▼                             nazwa błędu + linia,
                ┌────────────────────┐                  brak sterownika
                │ 5. Generacja       │
                │  • sterownik.py    │
                │  • automat (JSON)  │
                └────────────────────┘
                   kod wyjścia 0
```

### 8.1. Werdykt TAK / NIE

| Werdykt | Kod wyjścia | Co wypisuje kompilator |
| :--- | :---: | :--- |
| **TAK**: program poprawny i bezpieczny | `0` | `Weryfikacja zakończona SUKCESEM (brak kolizji, poprawne fazy i czasy).` |
| **NIE**: program odrzucony | `1` | `KOMPILACJA ZAKOŃCZONA BŁĘDEM: <nazwa błędu>` + opis z numerem linii |

Przy błędzie semantycznym GUI dostaje mimo to model automatu, żeby symulator mógł pokazać, *gdzie* doszłoby do kolizji (czerwony baner). Kodu sterownika kompilator wtedy nie generuje.

### 8.2. Wygenerowany kod (tylko przy TAK)

**a) Automat Moore'a w formacie JSON** (`--dfa-json automat.json`), czyli reprezentacja pośrednia. Każdy krok (mikroczynność) staje się stanem automatu `q_i` z czasem trwania i wektorem wyjść:

```json
{
  "name": "Proste",
  "directions": { "NS": "vehicles_3color", "WE": "vehicles_3color", "Piesi": "pedestrians_2color" },
  "states": [
    { "id": 0, "duration_ms": 20000, "outputs": { "NS": "GREEN",  "WE": "RED", "Piesi": "GREEN" }, "next_state": 1 },
    { "id": 1, "duration_ms": 3000,  "outputs": { "NS": "YELLOW", "WE": "RED", "Piesi": "RED"   }, "next_state": 2 }
  ]
}
```

Formalnie: **M = (Q, Σ, Δ, δ, λ, q₀)**, gdzie `Q` to kroki cyklu, `δ(qᵢ, upływ czasu) = q₍ᵢ₊₁₎ mod n`, a `λ(qᵢ)` to wektor stanów sygnalizatorów (pole `outputs`). Pełny opis jest w [docs/model_automatu.md](model_automatu.md).

**b) Samodzielny program sterownika** `sterownik.py` (`-o sterownik.py`). Zawiera tablice `DIRECTIONS` i `STATES` oraz klasę `TrafficLightController`, która w pętli czasu rzeczywistego przełącza stany:

```text
$ python sterownik.py --dry-run
[*] Uruchamianie sterownika sygnalizacji: Proste
[*] Liczba stanow w cyklu: 6

Stan q0 (Krok 1/6) | Czas: 20.0s -> Nastepny: q1
  • NS     (vehicles_3color   ): GREEN
  • WE     (vehicles_3color   ): RED
  • Piesi  (pedestrians_2color): GREEN

Stan q1 (Krok 2/6) | Czas: 3.0s -> Nastepny: q2
  • NS     (vehicles_3color   ): YELLOW
  ...
```

Opcje: `--speed 2.0` (przyspieszenie), `--cycles 3` (liczba cykli), `--dry-run` (jeden cykl bez czekania).

## 9. Podsumowanie

| Pytanie | Odpowiedź |
| :--- | :--- |
| Jaki problem rozwiązujemy? | Ręcznie pisane programy sygnalizacji mogą zawierać niebezpieczne błędy, które wychodzą na jaw dopiero po wdrożeniu. |
| Co chcemy osiągnąć? | Formalny język + kompilator, który przed wdrożeniem dowodzi bezpieczeństwa programu. |
| Co język opisuje? | Mikroczynności sterownika: kroki „przez czas t sygnalizatory są w stanach X”, ułożone w cykl. |
| Co język zapisuje? | Kierunki (sygnalizatory i ich typy), kolizje (pary wykluczające się), cykl kroków z czasami. |
| Jaka jest gramatyka? | Bezkontekstowa gramatyka ANTLR4 (`grammar/TrafficLight.g4`): 11 reguł parsera + reguły leksera. |
| Co robi ANTLR? | Z gramatyki generuje lekser i parser w Pythonie (`src/generated/`). |
| Czy zapis jest poprawny? | Sprawdzają to dwa poziomy: składnia (parser ANTLR) i semantyka (kolizje, typy, kolejność faz, czasy). |
| Co jest na wyjściu? | Werdykt TAK/NIE; przy TAK dodatkowo automat Moore'a (JSON) i gotowy program `sterownik.py`. |

### Jak samodzielnie sprawdzić przykłady

```bash
pip install -r requirements.txt
python compiler.py examples/rondo_autorskie.traffic -o sterownik.py --dfa-json automat.json
python sterownik.py --dry-run
```
