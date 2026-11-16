# TrafficLightCompiler: kompilator języka sygnalizacji świetlnej

Język dziedzinowy (DSL) oraz kompilator weryfikujący i generujący kod sterowników sygnalizacji świetlnej dla skrzyżowań, torowisk tramwajowych i przejazdów kolejowych.

## 1. Cel projektu

Ręczne pisanie programów sterowników ruchu w językach niskopoziomowych (C, drabinki PLC) bywa podatne na pomyłki, na przykład jednoczesne zielone światło dla relacji kolizyjnych. W tym projekcie węzeł opisuje się deklaratywnie w prostym języku tekstowym. Kompilator sprawdza brak konfliktów w zdefiniowanym cyklu i generuje tabelę przejść automatu Moore'a do wgrania na sterownik lub do symulatora.

## 2. Zakres języka

Język opisuje elementy węzła komunikacyjnego:
1. Sygnalizatory:
   * `samochody` / `pojazdy`: sygnalizacja 3-komorowa (czerwone, żółte, zielone).
   * `piesi`: sygnalizacja 2-komorowa (czerwone, zielone).
   * `tramwaje`: sygnalizacja torowa STK (stój, pion, kropka).
   * `kolej`: sygnalizatory przejazdowe i rogatki kolejowe (otwarty, ostrzeżenie, zamknięty).
   * `rowery`: sygnalizacja przejazdów rowerowych.
2. Macierz kolizji: relacje wykluczających się kierunków (`A <-> B`).
3. Harmonogram (cykl): kolejne kroki czasowe z określonym czasem trwania (sekundy, milisekundy, minuty) i stanami wyjść.

## 3. Struktura programu

Plik źródłowy ma rozszerzenie `.traffic` i zawiera trzy sekcje:
* `kierunki { ... }`: identyfikatory i typy sygnalizatorów.
* `kolizje { ... }`: pary kierunków o przecinających się torach jazdy.
* `cykl { ... }`: sekwencja kroków czasowych `krok(czas: ...) { ... }`.

### Przykładowy program (`rondo_autorskie.traffic`)

```text
skrzyzowanie "Rondo_Autorskie" {
    kierunki {
        Wlot_Zachod: pojazdy;
        Wlot_Wschod: pojazdy;
        Wlot_Poludnie: pojazdy;
        Wlot_Polnoc: pojazdy;
        Tramwaj_Linia_WE: tramwaje;
        Tramwaj_Linia_NS: tramwaje;
        Piesi_Przejscia: piesi;
    }

    kolizje {
        Wlot_Zachod <-> Wlot_Poludnie;
        Wlot_Zachod <-> Wlot_Polnoc;
        Wlot_Wschod <-> Wlot_Poludnie;
        Wlot_Wschod <-> Wlot_Polnoc;

        Tramwaj_Linia_WE <-> Tramwaj_Linia_NS;
        Tramwaj_Linia_WE <-> Wlot_Poludnie;
        Tramwaj_Linia_WE <-> Wlot_Polnoc;

        Tramwaj_Linia_NS <-> Wlot_Zachod;
        Tramwaj_Linia_NS <-> Wlot_Wschod;

        Piesi_Przejscia <-> Wlot_Zachod;
        Piesi_Przejscia <-> Wlot_Wschod;
        Piesi_Przejscia <-> Wlot_Poludnie;
        Piesi_Przejscia <-> Wlot_Polnoc;
    }

    cykl {
        // Krok 1: Otwarcie osi WE (samochody i tramwaj WE)
        krok(czas: 25s) {
            Wlot_Zachod: ZIELONE;
            Wlot_Wschod: ZIELONE;
            Wlot_Poludnie: CZERWONE;
            Wlot_Polnoc: CZERWONE;
            Tramwaj_Linia_WE: TRAM_JAZDA;
            Tramwaj_Linia_NS: TRAM_STOJ;
            Piesi_Przejscia: CZERWONE;
        }
        // Krok 2: Żółte światło dla osi WE
        krok(czas: 3s) {
            Wlot_Zachod: ZOLTE;
            Wlot_Wschod: ZOLTE;
            Wlot_Poludnie: CZERWONE;
            Wlot_Polnoc: CZERWONE;
            Tramwaj_Linia_WE: TRAM_UWAGA;
            Tramwaj_Linia_NS: TRAM_STOJ;
            Piesi_Przejscia: CZERWONE;
        }
        // Krok 3: Czerwone z żółtym dla osi NS
        krok(czas: 2s) {
            Wlot_Zachod: CZERWONE;
            Wlot_Wschod: CZERWONE;
            Wlot_Poludnie: CZERWONE_ZOLTE;
            Wlot_Polnoc: CZERWONE_ZOLTE;
            Tramwaj_Linia_WE: TRAM_STOJ;
            Tramwaj_Linia_NS: TRAM_STOJ;
            Piesi_Przejscia: CZERWONE;
        }
        // Krok 4: Otwarcie osi NS (samochody i tramwaj NS)
        krok(czas: 22s) {
            Wlot_Zachod: CZERWONE;
            Wlot_Wschod: CZERWONE;
            Wlot_Poludnie: ZIELONE;
            Wlot_Polnoc: ZIELONE;
            Tramwaj_Linia_WE: TRAM_STOJ;
            Tramwaj_Linia_NS: TRAM_JAZDA;
            Piesi_Przejscia: CZERWONE;
        }
        // Krok 5: Żółte światło dla osi NS
        krok(czas: 3s) {
            Wlot_Zachod: CZERWONE;
            Wlot_Wschod: CZERWONE;
            Wlot_Poludnie: ZOLTE;
            Wlot_Polnoc: ZOLTE;
            Tramwaj_Linia_WE: TRAM_STOJ;
            Tramwaj_Linia_NS: TRAM_UWAGA;
            Piesi_Przejscia: CZERWONE;
        }
        // Krok 6: Faza piesza
        krok(czas: 15s) {
            Wlot_Zachod: CZERWONE;
            Wlot_Wschod: CZERWONE;
            Wlot_Poludnie: CZERWONE;
            Wlot_Polnoc: CZERWONE;
            Tramwaj_Linia_WE: TRAM_STOJ;
            Tramwaj_Linia_NS: TRAM_STOJ;
            Piesi_Przejscia: ZIELONE;
        }
        // Krok 7: Przygotowanie do powrotu do kroku 1
        krok(czas: 3s) {
            Wlot_Zachod: CZERWONE_ZOLTE;
            Wlot_Wschod: CZERWONE_ZOLTE;
            Wlot_Poludnie: CZERWONE;
            Wlot_Polnoc: CZERWONE;
            Tramwaj_Linia_WE: TRAM_STOJ;
            Tramwaj_Linia_NS: TRAM_STOJ;
            Piesi_Przejscia: CZERWONE;
        }
    }
}
```

## 4. Dane wyjściowe

Kompilator tworzy trzy rodzaje wyników:

### Status walidacji
* Kod wyjścia `0` (`VALID: YES`): program jest poprawny składniowo, typowo i bezkolizyjny w każdym kroku.
* Kod wyjścia `1` (`VALID: NO`): kompilacja przerwana z informacją o numerze linii, kolumnie i przyczynie błędu (np. `CollisionConflictException`, `InvalidPhaseTransitionError`).

### Kod sterownika Python
Plik `sterownik.py` z klasą `TrafficLightController`, pętlą czasu rzeczywistego opartą na `time.monotonic()` i kolorowym wypisywaniem stanów w terminalu:
```powershell
python compiler.py examples/rondo_autorskie.traffic -o sterownik.py
python sterownik.py --speed 2.0
```

### Tabela stanów automatu Moore'a (IR JSON)
Reprezentacja pośrednia automatu skończonego gotowa do użycia w symulatorze lub sterowniku sprzętowym:
```json
{
  "name": "Rondo_Autorskie",
  "directions": {
    "Wlot_Zachod": "vehicles_3color",
    "Wlot_Wschod": "vehicles_3color",
    "Wlot_Poludnie": "vehicles_3color",
    "Wlot_Polnoc": "vehicles_3color",
    "Tramwaj_Linia_WE": "tram_stk",
    "Tramwaj_Linia_NS": "tram_stk",
    "Piesi_Przejscia": "pedestrians_2color"
  },
  "states": [
    {
      "id": 0,
      "duration_ms": 25000,
      "outputs": {
        "Wlot_Zachod": "GREEN",
        "Wlot_Wschod": "GREEN",
        "Wlot_Poludnie": "RED",
        "Wlot_Polnoc": "RED",
        "Tramwaj_Linia_WE": "TRAM_GO",
        "Tramwaj_Linia_NS": "TRAM_STOP",
        "Piesi_Przejscia": "RED"
      },
      "next_state": 1
    }
  ]
}
```

## 5. Etapy kompilacji

Przetwarzanie kodu przebiega w pięciu krokach:

1. Skanowanie leksykalne (Lexer): podział tekstu na tokeny (słowa kluczowe, czasy, nazwy).
2. Rozbiór składniowy (Parser): budowa drzewa parsowania na podstawie gramatyki ANTLR4.
3. Konstrukcja AST (AstVisitor): przekształcenie drzewa w węzły obiektowe (`IntersectionNode`, `StepNode`).
4. Weryfikacja semantyczna: sprawdzenie deklaracji kierunków, poprawności stanów świateł, minimalnych czasów żółtych i braku kolizji w cyklu.
5. Generacja kodu: zapis modelu automatu do formatu JSON oraz wygenerowanie skryptu `sterownik.py`.

## 6. Interfejs graficzny i symulator 2D

Aplikacja webowa została przygotowana w oparciu o Vite, TypeScript i Konva (`gui/src`). Lokalny serwer Pythona (`run_gui.py`) serwuje zbudowany pakiet produkcyjny oraz API kompilatora:

```powershell
cd gui
npm install
npm run build
cd ..
python run_gui.py
```

W trybie deweloperskim frontendu: `cd gui && npm run dev` (kompilator nadal odpowiada z poziomu `python run_gui.py`).

Funkcje interfejsu (`http://localhost:8000`):
* Edytor kodu z wcięciami Tab, wyborem programu i przywracaniem domyślnego przykładu.
* Kompilacja z poziomu przycisku lub skrótu klawiszowego `F5`.
* Podgląd kolejnych etapów działania kompilatora w oknie logów.
* Symulator 2D z ruchem pojazdów, torowiskiem tramwajowym, rogatkami kolejowymi i przejściami dla pieszych.
* Wskaźniki bieżącego stanu automatu, czasu trwania fazy i liczby ukończonych cykli.
* Ostrzeżenie w postaci czerwonego baneru w przypadku wykrycia kolizji w kodzie.
* Podgląd i pobieranie kodu sterownika `sterownik.py` oraz danych automatu w formacie JSON.

## 7. Dokumentacja

* [docs/specyfikacja_jezyka.md](docs/specyfikacja_jezyka.md): formalna gramatyka EBNF, tokeny i reguły semantyczne.
* [docs/model_automatu.md](docs/model_automatu.md): definicja automatu Moore'a, macierz kolizji i specyfikacja JSON.
* [INSTRUKCJA_OBSLUGI.md](INSTRUKCJA_OBSLUGI.md): instrukcja instalacji, uruchomienia i regeneracji parsera.
