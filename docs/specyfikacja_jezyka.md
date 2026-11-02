# Specyfikacja języka i gramatyka EBNF

Dokument zawiera formalną specyfikację składniową i leksykalną języka opisu sygnalizacji świetlnej (TrafficLight DSL).

## 1. Analiza leksykalna (Tokeny)

### 1.1. Słowa kluczowe
* `skrzyzowanie`
* `kierunki`
* `kolizje`
* `cykl`
* `krok`
* `czas`
* `pojazdy`
* `piesi`

### 1.2. Identyfikatory stanów świateł
* Sygnalizatory trójkomorowe (`pojazdy`):
  * `CZERWONE`
  * `CZERWONE_ZOLTE`
  * `ZIELONE`
  * `ZOLTE`
  * `WYLACZONE`
  * `ZOLTE_MIGAJACE`
* Sygnalizatory dwukomorowe (`piesi`):
  * `CZERWONE`
  * `ZIELONE`
  * `WYLACZONE`

### 1.3. Literały i identyfikatory
* `IDENTYFIKATOR`: `[a-zA-Z_][a-zA-Z0-9_]*`
* `LITERAL_TEKSTOWY`: `\"([^\"\\]|\\.)*\"`
* `CZAS`: `[0-9]+("ms"|"s"|"m")` (np. `500ms`, `15s`, `2m`)
* `LICZBA`: `[0-9]+`

### 1.4. Operatory i znaki podziału
* Nawiasy klamrowe: `{`, `}`
* Nawiasy okrągłe: `(`, `)`
* Dwukropek: `:`
* Średnik: `;`
* Przecinek: `,`
* Operator kolizji: `<->`

### 1.5. Komentarze i białe znaki
* Komentarze jednolinijkowe: `// .*$`
* Komentarze wielolinijkowe: `/* (?s).*? */`
* Białe znaki (`\s`, `\t`, `\r`, `\n`) są ignorowane przez analizator leksykalny poza literałami tekstowymi.

---

## 2. Gramatyka bezkontekstowa (EBNF)

Notacja stosuje konwencję ISO/IEC 14977:
* Symbole nieterminalne zapisano w stylu `CamelCase`.
* Symbole terminalne (słowa kluczowe i znaki) ujęto w cudzysłowy `"..."`.
* Nawiasy kwadratowe `[...]` oznaczają element opcjonalny.
* Nawiasy klamrowe `{...}` oznaczają powtórzenie 0 lub więcej razy.
* Pionowa kreska `|` oznacza alternatywę.

```ebnf
Program
    = DefinicjaSkrzyzowania ;

DefinicjaSkrzyzowania
    = "skrzyzowanie" LITERAL_TEKSTOWY "{"
        SekcjaKierunkow
        [ SekcjaKolizji ]
        SekcjaCyklu
      "}" ;

SekcjaKierunkow
    = "kierunki" "{" { DeklaracjaKierunku } "}" ;

DeklaracjaKierunku
    = IDENTYFIKATOR ":" TypSygnalizatora ";" ;

TypSygnalizatora
    = "pojazdy" | "piesi" ;

SekcjaKolizji
    = "kolizje" "{" { DeklaracjaKolizji } "}" ;

DeklaracjaKolizji
    = IDENTYFIKATOR "<->" IDENTYFIKATOR ";" ;

SekcjaCyklu
    = "cykl" "{" { DefinicjaKroku } "}" ;

DefinicjaKroku
    = "krok" "(" "czas" ":" CZAS ")" "{"
        { PrzypisanieStanu }
      "}" ;

PrzypisanieStanu
    = IDENTYFIKATOR ":" StanSwiatla ";" ;

StanSwiatla
    = "CZERWONE"
    | "CZERWONE_ZOLTE"
    | "ZIELONE"
    | "ZOLTE"
    | "ZOLTE_MIGAJACE"
    | "WYLACZONE" ;
```

---

## 3. Reguły semantyczne (statyczna weryfikacja poprawności)

Parser po zbudowaniu abstrakcyjnego drzewa składniowego (AST) przekazuje dane do modułu analizy semantycznej. Kompilator weryfikuje następujące warunki przed generowaniem kodu wynikowego:

### 3.1. Poprawność identyfikatorów
1. Każdy identyfikator kierunku musi być unikalny w obrębie bloku `kierunki`.
2. Każdy kierunek użyty w blokach `kolizje` oraz `krok` musi zostać uprzednio zadeklarowany w bloku `kierunki`. Błąd: `UndeclaredDirectionError`.
3. Każdy krok musi określać stan dla wszystkich zadeklarowanych kierunków. Jeżeli kierunek zostanie pominięty, kompilator zgłasza błąd `IncompleteStepDefinitionError` (lub przyjmuje bezpieczny stan domyślny `CZERWONE`, zależnie od flagi kompilatora).

### 3.2. Zgodność typów świateł
1. Sygnalizatory typu `piesi` mogą przyjmować wyłącznie stany `CZERWONE`, `ZIELONE` lub `WYLACZONE`. Użycie `ZOLTE` lub `CZERWONE_ZOLTE` dla pieszego generuje błąd: `InvalidLightStateForTypeException`.
2. Sygnalizatory typu `pojazdy` obsługują pełny zestaw stanów.

### 3.3. Bezpieczeństwo i brak kolizji
1. Relacja kolizji `A <-> B` jest symetryczna: jeżeli w danym kroku kierunek `A` ma stan `ZIELONE` (lub `CZERWONE_ZOLTE`), kierunek `B` nie może jednocześnie znajdować się w stanie `ZIELONE` ani `CZERWONE_ZOLTE`. Naruszenie generuje błąd: `CollisionConflictException`.
2. Zakaz natychmiastowego przejścia `ZIELONE -> CZERWONE` dla pojazdów. Pomiędzy fazą zieloną a czerwoną kompilator wymaga wystąpienia kroku z fazą `ZOLTE` trwającą co najmniej wymaganą wartość minimalną (np. 2s).
3. Zakaz bezpośredniego przejścia `CZERWONE -> ZIELONE` dla pojazdów bez fazy przygotowawczej `CZERWONE_ZOLTE` (zgodnie z przepisami ruchu drogowego w Polsce).

### 3.4. Czas i cykliczność
1. Wartość czasu w każdym kroku musi być większa od zera (`czas > 0`).
2. Sekwencja w bloku `cykl` musi zawierać co najmniej dwa kroki.
3. Stan końcowy cyklu (ostatni krok) musi umożliwiać bezpieczne przejście do kroku pierwszego, zachowując te same reguły przejść międzyfazowych.
