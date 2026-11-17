# TrafficLight DSL: streszczenie

**Problem.** Programy sterowników sygnalizacji świetlnej pisze się ręcznie, więc łatwo o niebezpieczny błąd: zielone dla dwóch kolidujących kierunków albo brak fazy żółtej. Taki błąd wychodzi na jaw dopiero po wdrożeniu.

**Cel i wizja.** Własny język formalny do opisu sygnalizacji i kompilator, który *przed wdrożeniem* sprawdza, czy program jest bezpieczny. Niebezpiecznego programu kompilator po prostu nie skompiluje.

**Co opisuje język.** Mikroczynności sterownika. Jedna mikroczynność to **krok**: *„przez czas t każdy sygnalizator jest w stanie X”*. Program to cykl takich kroków. Gramatyka nie jest mikroczynnością, tylko regułami ich zapisu.

**Co zapisuje użytkownik.** Trzy sekcje: `kierunki` (sygnalizatory i ich typy), `kolizje` (pary kierunków, które nie mogą jechać jednocześnie) i `cykl` (kroki z czasem i stanami świateł).

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

**Gramatyka.** Bezkontekstowa gramatyka ANTLR4 ([grammar/TrafficLight.g4](../grammar/TrafficLight.g4)): 11 reguł parsera i reguły leksera dla tokenów. Z tej gramatyki ANTLR generuje lekser i parser w Pythonie (`src/generated/`).

**Czy program jest poprawny?** Sprawdzamy to na dwóch poziomach:
1. **Składnia:** parser ANTLR sprawdza, czy tekst pasuje do gramatyki (np. brak średnika to `SyntaxError`).
2. **Semantyka:** walidator sprawdza, czy:
   - kolidujące kierunki nie mają jednocześnie zielonego,
   - przejście z zielonego na czerwone idzie przez żółte, które trwa co najmniej 2 s,
   - stan pasuje do typu sygnalizatora,
   - każdy kierunek jest zadeklarowany i ustawiony w każdym kroku.

**Co jest na wyjściu.** Najpierw werdykt **TAK/NIE**:
* **NIE:** kod wyjścia 1, nazwa błędu i numer linii; kod nie jest generowany.
* **TAK:** kod wyjścia 0 i **generowanie kodu**: automat Moore'a (JSON, każdy krok to stan) oraz gotowy program sterownika `sterownik.py`.

**W jednym zdaniu:** opisujemy skrzyżowanie jako cykl mikroczynności w formalnym języku z gramatyką ANTLR, a kompilator mówi TAK lub NIE i tylko dla TAK generuje bezpieczny kod sterownika.

Szczegóły: [wizja_projektu.md](wizja_projektu.md).
