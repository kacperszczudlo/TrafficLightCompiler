# TrafficLightCompiler

Język dziedzinowy (DSL) oraz kompilator sterownika sygnalizacji świetlnej na skrzyżowaniach drogowych, realizowany w ramach przedmiotu **Języki formalne i kompilatory 2**.

## 1. Cel i zakres projektu

Celem projektu jest zaprojektowanie formalnego języka opisu skrzyżowań drogowych oraz implementacja kompilatora, który:
1. Weryfikuje poprawność składniową i leksykalną pliku konfiguracyjnego.
2. Przeprowadza statyczną analizę semantyczną pod kątem bezpieczeństwa ruchu (detekcja kolizji faz zielonych, brak zdefiniowanych czasów ewakuacji, nieprawidłowe przejścia między stanami).
3. Tłumaczy deklaratywny kod źródłowy na deterministyczny automat skończony (DFA) w formacie instrukcji sterownika lub pliku pośredniego (JSON/IR) dla symulatora ruchu.

## 2. Zawartość dokumentacji

* [Specyfikacja języka i gramatyka EBNF](docs/specyfikacja_jezyka.md): pełna definicja tokenów, gramatyka bezkontekstowa, reguły leksykalne i semantyczne.
* [Model automatu i bezpieczeństwo](docs/model_automatu.md): formalny opis automatu Moore'a, macierz kolizji oraz weryfikowane niezmienniki.
* [Przykłady kodu](examples/):
  * `skrzyzowanie_proste.traffic`: poprawne skrzyżowanie czterowlotowe z pieszymi.
  * `skrzyzowanie_kolizja.traffic`: przykład programu odrzucanego przez analizator semantyczny z powodu konfliktu kierunków.

## 3. Przykładowy kod w projektowanym DSL

```text
skrzyzowanie "Niepodleglosci_ArmiiKrajowej" {
    kierunki {
        NS: pojazdy;
        WE: pojazdy;
        Pieszy_NS: piesi;
    }

    kolizje {
        NS <-> WE;
        WE <-> Pieszy_NS;
    }

    cykl {
        krok(czas: 25s) {
            NS: ZIELONE;
            WE: CZERWONE;
            Pieszy_NS: CZERWONE;
        }
        krok(czas: 3s) {
            NS: ZOLTE;
            WE: CZERWONE;
            Pieszy_NS: CZERWONE;
        }
        krok(czas: 2s) {
            NS: CZERWONE;
            WE: CZERWONE_ZOLTE;
            Pieszy_NS: CZERWONE;
        }
        krok(czas: 20s) {
            NS: CZERWONE;
            WE: ZIELONE;
            Pieszy_NS: ZIELONE;
        }
        krok(czas: 3s) {
            NS: CZERWONE;
            WE: ZOLTE;
            Pieszy_NS: CZERWONE;
        }
        krok(czas: 2s) {
            NS: CZERWONE_ZOLTE;
            WE: CZERWONE;
            Pieszy_NS: CZERWONE;
        }
    }
}
```

## 4. Architektura kompilatora

```
[ Plik .traffic ]
       │
       ▼
 ┌───────────┐
 │   Lexer   │  ──> Strumień tokenów
 └───────────┘
       │
       ▼
 ┌───────────┐
 │  Parser   │  ──> Drzewo rozbioru (AST)
 └───────────┘
       │
       ▼
 ┌──────────────────────┐
 │ Semantic Validator   │  ──> Weryfikacja kolizji, typów i czasów
 └──────────────────────┘
       │
       ▼
 ┌──────────────────────┐
 │ Generator kodu / IR  │  ──> Tabela przejść DFA (JSON) / Bytecode sterownika
 └──────────────────────┘
```
