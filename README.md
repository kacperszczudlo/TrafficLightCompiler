# TrafficLightCompiler — Kompilator Języka Sygnalizacji Świetlnej

Dedykowany język dziedzinowy (DSL) oraz deterministyczny kompilator weryfikujący i generujący kod sterowników sygnalizacji świetlnej dla węzłów drogowych, tramwajowych i kolejowych.

---

## 1. Wizja i Cel Projektu

* **Problem:** Sterowniki ruchu drogowego i kolejowego są tradycyjnie programowane w niskopoziomowych językach (C, drabinki PLC), co rodzi ryzyko krytycznych błędów ludzkich (jednoczesne zielone światła, kolizje z pieszymi lub tramwajem).
* **Cel:** Zastąpienie podatnego na błędy ręcznego kodowania deklaratywnym, formalnym językiem DSL.
* **Rozwiązanie:** Kompilator w czasie kompilacji wykonuje **statyczny dowód bezkolizyjności** oraz generuje gotową, zweryfikowaną tabelę stanów automatu Moore'a do wgrania na fizyczny sterownik lub do symulatora.

---

## 2. Co Opisuje Język (Domena)

Język modeluje pełną strukturę węzła komunikacyjnego:
1. **Topologię i sygnalizatory:**
   * `samochody` / `pojazdy` — sygnalizacja 3-komorowa (czerwone, żółte, zielone).
   * `piesi` — sygnalizacja 2-komorowa (czerwone, zielone).
   * `tramwaje` — sygnalizacja torowa STK (stój / pion / kropka).
   * `kolej` — sygnalizatory przejazdowe i rogatki kolejowe (otwarty / ostrzeżenie / zamknięty).
   * `rowery` — sygnalizacja przejazdów rowerowych.
2. **Macierz kolizji:** Graf wzajemnych wykluczeń relacji ruchowych (`A <-> B`).
3. **Harmonogram czasowy (Cykl):** Dyskretne kroki czasowe z precyzyjnym czasem trwania (sekundy, milisekundy, minuty) i stanami wyjść.

---

## 3. Co Zapisuje Użytkownik

Użytkownik tworzy plik tekstowy z rozszerzeniem `.traffic`. Składa się on z 3 głównych bloków:
* `kierunki { ... }` — definicja identyfikatorów i typów sygnalizatorów.
* `kolizje { ... }` — lista par kierunków, których tory jazdy przecinają się.
* `cykl { ... }` — sekwencja kroków (`krok(czas: ...) { ... }`) z przypisaniem stanów.

### Przykładowy program (`skrzyzowanie_zintegrowane.traffic`):
```text
skrzyzowanie "Wezel_Glowny" {
    kierunki {
        Pojazdy_NS: samochody;
        Pojazdy_WE: samochody;
        Pieszy_NS: piesi;
        Tramwaj_T1: tramwaje;
        Przejazd_PKP: kolej;
    }

    kolizje {
        Pojazdy_NS <-> Pojazdy_WE;
        Pojazdy_WE <-> Pieszy_NS;
        Pojazdy_WE <-> Tramwaj_T1;
        Pojazdy_NS <-> Przejazd_PKP;
    }

    cykl {
        // Krok 1: Faza A - Ruch glowny NS i pieszy NS
        krok(czas: 25s) {
            Pojazdy_NS: ZIELONE;
            Pojazdy_WE: CZERWONE;
            Pieszy_NS: ZIELONE;
            Tramwaj_T1: TRAM_STOJ;
            Przejazd_PKP: PRZEJAZD_OTWARTY;
        }
        // Krok 2: Ostrzezenie dla kierunku NS
        krok(czas: 3s) {
            Pojazdy_NS: ZOLTE;
            Pojazdy_WE: CZERWONE;
            Pieszy_NS: CZERWONE;
            Tramwaj_T1: TRAM_STOJ;
            Przejazd_PKP: PRZEJAZD_OTWARTY;
        }
        // Krok 3: Przygotowanie kierunku WE
        krok(czas: 2s) {
            Pojazdy_NS: CZERWONE;
            Pojazdy_WE: CZERWONE_ZOLTE;
            Pieszy_NS: CZERWONE;
            Tramwaj_T1: TRAM_STOJ;
            Przejazd_PKP: PRZEJAZD_OTWARTY;
        }
        // Krok 4: Faza B - Ruch poprzeczny WE
        krok(czas: 20s) {
            Pojazdy_NS: CZERWONE;
            Pojazdy_WE: ZIELONE;
            Pieszy_NS: CZERWONE;
            Tramwaj_T1: TRAM_STOJ;
            Przejazd_PKP: PRZEJAZD_OTWARTY;
        }
        // Krok 5: Ostrzezenie dla kierunku WE
        krok(czas: 3s) {
            Pojazdy_NS: CZERWONE;
            Pojazdy_WE: ZOLTE;
            Pieszy_NS: CZERWONE;
            Tramwaj_T1: TRAM_STOJ;
            Przejazd_PKP: PRZEJAZD_OTWARTY;
        }
        // Krok 6: Faza C - Wydzielona faza tramwajowa
        krok(czas: 15s) {
            Pojazdy_NS: CZERWONE;
            Pojazdy_WE: CZERWONE;
            Pieszy_NS: CZERWONE;
            Tramwaj_T1: TRAM_JAZDA;
            Przejazd_PKP: PRZEJAZD_OTWARTY;
        }
        // Krok 7: Ostrzezenie dla tramwaju
        krok(czas: 3s) {
            Pojazdy_NS: CZERWONE;
            Pojazdy_WE: CZERWONE;
            Pieszy_NS: CZERWONE;
            Tramwaj_T1: TRAM_UWAGA;
            Przejazd_PKP: PRZEJAZD_OTWARTY;
        }
        // Krok 8: Przygotowanie powrotu do ruchu NS
        krok(czas: 2s) {
            Pojazdy_NS: CZERWONE_ZOLTE;
            Pojazdy_WE: CZERWONE;
            Pieszy_NS: CZERWONE;
            Tramwaj_T1: TRAM_STOJ;
            Przejazd_PKP: PRZEJAZD_OTWARTY;
        }
    }
}
```

---

## 4. Co Otrzymujemy na Wyjściu (Output)

Kompilator generuje dwa poziomy wyjścia:

### Poziom 1: Werdykt Poprawności (Status Validacji)
* `VALID: YES` (kod wyjścia `0`): Program jest poprawny składniowo, typowo i w 100% bezpieczny kolizyjnie.
* `VALID: NO` (kod wyjścia `1`): Program odrzucony z precyzyjnym wskazaniem numeru linii, kolumny i reguły (np. `CollisionConflictException`, `InvalidPhaseTransitionError`).

### Poziom 2: Tabela Przejść Automatu Moore'a (IR / JSON)
Deterministyczny model automatu skończonego gotowy do wgrania na mikrokontroler lub do symulatora:
```json
{
  "name": "Wezel_Glowny",
  "directions": {
    "Pojazdy_NS": "samochody",
    "Pojazdy_WE": "samochody",
    "Pieszy_NS": "piesi",
    "Tramwaj_T1": "tramwaje",
    "Przejazd_PKP": "kolej"
  },
  "states": [
    {
      "id": 0,
      "duration_ms": 25000,
      "outputs": {
        "Pojazdy_NS": "ZIELONE",
        "Pojazdy_WE": "CZERWONE",
        "Pieszy_NS": "CZERWONE",
        "Tramwaj_T1": "TRAM_STOJ",
        "Przejazd_PKP": "PRZEJAZD_OTWARTY"
      },
      "next_state": 1
    }
  ]
}
```

---

## 5. Spis Mikroczynności Kompilatora (Pipeline)

Przetwarzanie kodu odbywa się w 5 deterministycznych fazach:

```
[ Kod źródłowy .traffic ]
          │
          ▼
1. Skanowanie leksykalne (Lexer)       --> Strumień tokenów (słowa kluczowe, czasy, identyfikatory)
          │
          ▼
2. Rozbiór składniowy (Parser)         --> Drzewo parsowania (ParseTree wg ANTLR4)
          │
          ▼
3. Konstrukcja AST (AstVisitor)        --> Zunifikowane węzły obiektowe (IntersectionNode, StepNode)
          │
          ▼
4. Weryfikacja semantyczna (Validator) --> Statyczny dowód bezpieczeństwa:
                                           * Poprawność deklaracji kierunków
                                           * Zgodność typów świateł z sygnalizatorami
                                           * Weryfikacja macierzy kolizji dla każdego kroku
                                           * Weryfikacja sekwencji fazowych i czasów ewakuacji
          │
          ▼
5. Generacja kodu DFA (IR Generator)   --> Zserializowany deterministyczny automat Moore'a (JSON)
```

---

## 6. Co Jest Poprawne, a Co Nie (Przykłady)

| Sytuacja | Werdykt | Przyczyna |
| :--- | :---: | :--- |
| Bezkolizyjne fazy zielone z zachowaniem czasów żółtych $\ge 2\text{s}$ | **TAK (YES)** | Zgodne z regułami ruchu i brakiem konfliktów w macierzy. |
| Jednoczesne `ZIELONE` dla kierunków zadeklarowanych w `kolizje` | **NIE (NO)** | Błąd `CollisionConflictException`. Wykryto ryzyko zderzenia. |
| Przejście `ZIELONE` $\to$ `CZERWONE` dla samochodów bez fazy `ZOLTE` | **NIE (NO)** | Błąd `InvalidPhaseTransitionError`. Wymagana faza ostrzegawcza. |
| Przypisanie stanu `ZOLTE` dla sygnalizatora typu `piesi` | **NIE (NO)** | Błąd `InvalidLightStateForTypeException`. Piesi mają tylko czerwone/zielone. |
| Faza `ZOLTE` o czasie krótszym niż $2\text{s}$ (np. $1\text{s}$) | **NIE (NO)** | Błąd `InvalidTimeDurationError`. Niedotrzymanie minimalnego czasu bezpieczeństwa. |
| Pominięcie stanu któregoś kierunku w definicji kroku | **NIE (NO)** | Błąd `IncompleteStepDefinitionError`. Stan każdego sygnalizatora musi być jednoznaczny. |

---

## 7. Nawigacja po Dokumentacji

* [docs/specyfikacja_jezyka.md](docs/specyfikacja_jezyka.md) — Kompletna formalna gramatyka EBNF, tokeny, typy i reguły.
* [docs/model_automatu.md](docs/model_automatu.md) — Formalny aparat matematyczny automatu Moore'a, macierz kolizji oraz specyfikacja wyjściowego JSON.
* [INSTRUKCJA_OBSLUGI.md](INSTRUKCJA_OBSLUGI.md) — Instrukcja instalacji, uruchomienia kompilatora i regeneracji parsera.
