# Specyfikacja formalna języka TrafficLight DSL

Dokument definiuje specyfikację leksykalną, gramatykę bezkontekstową oraz zestaw reguł semantycznych dla języka sterowania ruchem.

## 1. Analiza leksykalna (tokeny)

### 1.1. Słowa kluczowe
* `skrzyzowanie`: deklaracja węzła komunikacyjnego
* `kierunki`: sekcja definicji sygnalizatorów
* `kolizje`: sekcja definicji par wykluczających się
* `cykl`: sekcja definicji kroków czasowych
* `krok`: pojedynczy stan czasowy
* `czas`: atrybut czasu trwania kroku

### 1.2. Typy sygnalizatorów (`signalType`)
* `samochody` / `pojazdy`: sygnalizatory 3-komorowe ruchu kołowego ogólnego.
* `piesi`: sygnalizatory 2-komorowe przejść dla pieszych.
* `tramwaje`: sygnalizatory torowe tramwajowe (STK).
* `kolej`: sygnalizatory przejazdowe i rogatki kolejowe.
* `rowery`: sygnalizatory przejazdów rowerowych.

### 1.3. Dozwolone stany sygnałów wg typów (`lightState`)

| Typ sygnalizatora | Dopuszczalne stany | Znaczenie sygnału |
| :--- | :--- | :--- |
| `samochody` / `pojazdy` / `rowery` | `CZERWONE` | Zakaz wjazdu za sygnalizator |
| | `CZERWONE_ZOLTE` | Przygotowanie do ruszenia (zakaz wjazdu) |
| | `ZIELONE` | Zezwolenie na wjazd |
| | `ZOLTE` | Zakaz wjazdu z wyjątkiem braku możliwości bezpiecznego zatrzymania (min. 2s) |
| | `ZOLTE_MIGAJACE` | Ostrzeżenie (tryb awaryjny lub nocny) |
| | `WYLACZONE` | Sygnalizator wygaszony |
| `piesi` | `CZERWONE` | Zakaz wejścia na przejście |
| | `ZIELONE` | Zezwolenie na przejście |
| | `ZIELONE_MIGAJACE` | Ostrzeżenie przed zakończeniem fazy zielonej |
| | `WYLACZONE` | Sygnalizator wygaszony |
| `tramwaje` | `TRAM_STOJ` | Pozioma belka: zakaz wjazdu tramwaju |
| | `TRAM_JAZDA` | Pionowa lub ukośna belka: zezwolenie na jazdę |
| | `TRAM_UWAGA` | Kropka: sygnał ostrzegawczy przed zmianą |
| | `WYLACZONE` | Sygnalizator wygaszony |
| `kolej` | `PRZEJAZD_OTWARTY` | Rogatki podniesione, brak pociągu (ruch swobodny) |
| | `PRZEJAZD_OSTRZEZENIE` | Czerwone światła migające, zamykanie rogatek |
| | `PRZEJAZD_ZAMKNIETY` | Rogatki opuszczone, zakaz wjazdu (przejazd pociągu) |

### 1.4. Literały i identyfikatory
* `ID`: `[a-zA-Z_][a-zA-Z0-9_]*`
* `STRING_LITERAL`: `"..."` (ciąg znaków w cudzysłowach)
* `TIME_LITERAL`: `[0-9]+ ('ms' | 's' | 'm')` (np. `500ms`, `3s`, `2m`)

### 1.5. Operatory i separatory
* Klamry: `{`, `}`
* Nawiasy: `(`, `)`
* Dwukropek: `:`
* Średnik: `;`
* Operator kolizji: `<->`

### 1.6. Komentarze i białe znaki
* `// linia`: komentarz jednoliniowy (ignorowany)
* `/* blok */`: komentarz wieloliniowy (ignorowany)
* Spacje, tabulatory i znaki nowej linii są ignorowane.

## 2. Formalna gramatyka bezkontekstowa (EBNF)

Zapis w standardzie ISO/IEC 14977:

```ebnf
Program
    = Skrzyzowanie ;

Skrzyzowanie
    = "skrzyzowanie" STRING_LITERAL "{"
        SekcjaKierunkow
        [ SekcjaKolizji ]
        SekcjaCyklu
      "}" ;

SekcjaKierunkow
    = "kierunki" "{" { DefinicjaKierunku } "}" ;

DefinicjaKierunku
    = ID ":" TypSygnalizatora ";" ;

TypSygnalizatora
    = "pojazdy"
    | "samochody"
    | "piesi"
    | "tramwaje"
    | "kolej"
    | "rowery" ;

SekcjaKolizji
    = "kolizje" "{" { DefinicjaKolizji } "}" ;

DefinicjaKolizji
    = ID "<->" ID ";" ;

SekcjaCyklu
    = "cykl" "{" { DefinicjaKroku } "}" ;

DefinicjaKroku
    = "krok" "(" "czas" ":" TIME_LITERAL ")" "{"
        { PrzypisanieStanu }
      "}" ;

PrzypisanieStanu
    = ID ":" StanSwiatla ";" ;

StanSwiatla
    = "CZERWONE"
    | "CZERWONE_ZOLTE"
    | "ZIELONE"
    | "ZOLTE"
    | "ZOLTE_MIGAJACE"
    | "ZIELONE_MIGAJACE"
    | "TRAM_STOJ"
    | "TRAM_JAZDA"
    | "TRAM_UWAGA"
    | "PRZEJAZD_OTWARTY"
    | "PRZEJAZD_OSTRZEZENIE"
    | "PRZEJAZD_ZAMKNIETY"
    | "WYLACZONE" ;
```

## 3. Semantyczne reguły poprawności

Kompilator po rozbiorze gramatycznym przeprowadza weryfikację semantyczną:

### 3.1. Identyfikatory i spójność deklaracji
1. Unikalność: każdy identyfikator w bloku `kierunki` musi być unikalny.
2. Deklaratywność: każdy kierunek użyty w `kolizje` i `cykl` musi być zadeklarowany w `kierunki` (`UndeclaredDirectionError`).
3. Kompletność kroku: w każdym kroku należy jednoznacznie określić stan dla wszystkich zadeklarowanych kierunków (`IncompleteStepDefinitionError`).

### 3.2. Kontrola typów (Type Checking)
Przypisanie stanu niezgodnego z typem sygnalizatora skutkuje błędem `InvalidLightStateForTypeException`:
* `piesi` mogą przyjmować wyłącznie: `CZERWONE`, `ZIELONE`, `ZIELONE_MIGAJACE`, `WYLACZONE`.
* `tramwaje` mogą przyjmować wyłącznie: `TRAM_STOJ`, `TRAM_JAZDA`, `TRAM_UWAGA`, `WYLACZONE`.
* `kolej` może przyjmować wyłącznie: `PRZEJAZD_OTWARTY`, `PRZEJAZD_OSTRZEZENIE`, `PRZEJAZD_ZAMKNIETY`, `WYLACZONE`.
* `samochody` / `pojazdy` / `rowery` mogą przyjmować: `CZERWONE`, `CZERWONE_ZOLTE`, `ZIELONE`, `ZOLTE`, `ZOLTE_MIGAJACE`, `WYLACZONE`.

### 3.3. Dowód bezkolizyjności
Relacja `A <-> B` oznacza wzajemne wykluczenie zezwolenia na ruch.
Sygnały zezwalające na ruch to:
* pojazdy / samochody / rowery: `ZIELONE`, `CZERWONE_ZOLTE`
* piesi: `ZIELONE`, `ZIELONE_MIGAJACE`
* tramwaje: `TRAM_JAZDA`
* kolej: `PRZEJAZD_ZAMKNIETY` (dla relacji kolizyjnej z ruchem drogowym, gdy pociąg zajmuje przejazd)

W żadnym kroku dwa kolidujące ze sobą kierunki nie mogą jednocześnie posiadać sygnału zezwalającego na ruch. Naruszenie tej zasady generuje wyjątek `CollisionConflictException`.

### 3.4. Bezpieczeństwo sekwencji fazowych i czasy
1. Pojazdy / samochody:
   * Po `ZIELONE` musi nastąpić faza `ZOLTE` o czasie t >= 2s (zakaz bezpośredniego przejścia `ZIELONE -> CZERWONE`).
   * Przed `ZIELONE` po stanie `CZERWONE` wymagana jest faza przygotowawcza `CZERWONE_ZOLTE`.
2. Cykliczność: ostatni krok w bloku `cykl` przechodzi w krok pierwszy, a warunki przejść międzyfazowych są sprawdzane również na granicy cyklu.
3. Czas: czas trwania każdego kroku musi być ściśle dodatni (t > 0).
4. Długość cyklu: cykl musi posiadać co najmniej 2 kroki.
