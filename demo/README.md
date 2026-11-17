# Pokaz parsera: ściąga

## Co prowadzący chce zobaczyć

| Prośba prowadzącego | Co pokazujesz |
| :--- | :--- |
| „ANTLR-em generujemy parser” | Plik [grammar/TrafficLight.g4](../grammar/TrafficLight.g4) i wygenerowane z niego pliki w [src/generated/](../src/generated/). |
| „Co wchodzi przez parser” | Zdanie, czyli tekst programu `.traffic` (sekcja **1. WEJŚCIE**). |
| „Co otrzymujemy” | Tokeny z leksera (**2. LEKSER**) i drzewo rozbioru z parsera (**3. PARSER**). |
| „Zdania poprawne i niepoprawne” | Zestaw w [zdania/](zdania/): 3 zdania akceptowane, 5 odrzucanych (**4. WYNIK** i podsumowanie). |

## Uruchomienie

Wszystkie zdania po kolei (Enter przechodzi do następnego):

```bash
python demo/pokaz_parsera.py
```

Jedno zdanie:

```bash
python demo/pokaz_parsera.py demo/zdania/04_bledne_brak_srednika.traffic
```

Opcja `--lisp` dodatkowo wypisuje surowe drzewo w formacie ANTLR (`toStringTree`). Jeśli prowadzący zaproponuje własne zdanie, zmień dowolny plik albo utwórz nowy i uruchom skrypt na nim.

## Zdania

| Plik | Parser | Co pokazuje |
| :--- | :-: | :--- |
| `01_poprawne_przejscie` | ✓ | Pełne poprawne zdanie i jego drzewo. Semantyka też OK. |
| `02_poprawne_najkrotsze` | ✓ | Najkrótsze zdanie języka (puste sekcje). Gramatyka to dopuszcza, odrzuca je dopiero semantyka. |
| `03_poprawne_skladniowo_kolizja` | ✓ | Składniowo poprawne, ale niebezpieczne (zielone dla aut i pieszych). Parser nie sprawdza sensu. |
| `04_bledne_brak_srednika` | ✗ | Parser sam wstawia brakujący token `<missing ';'>` i parsuje dalej. |
| `05_bledne_kolejnosc_sekcji` | ✗ | Gramatyka wymusza kolejność `kierunki`, `kolizje`, `cykl`. |
| `06_bledne_literowka_stanu` | ✗ | `ZIELNE` lekser przepuszcza jako `ID`, ale parser oczekuje jednego z 13 stanów. |
| `07_bledne_czas_bez_jednostki` | ✗ | Błąd już w lekserze: `20` bez `s` nie jest żadnym tokenem. |
| `08_bledne_slowo_kluczowe_jako_nazwa` | ✗ | `krok` to słowo kluczowe, więc nie może być nazwą kierunku. |

## Co powiedzieć

1. **Gramatyka i ANTLR.** „W pliku `.g4` jest gramatyka: reguły parsera (małe litery, np. `program`, `stepDef`) i reguły leksera (wielkie litery, np. `ID`, `TIME_LITERAL`). ANTLR generuje z niej lekser i parser w Pythonie. Nie piszemy ich ręcznie.” Komenda generująca: `generate_parser.ps1`, czyli `java -jar antlr-4.13.2-complete.jar -Dlanguage=Python3 -visitor -o src/generated grammar/TrafficLight.g4`.
2. **Lekser.** „Lekser tnie tekst na tokeny i wyrzuca białe znaki oraz komentarze. Słowa kluczowe i symbole są osobnymi tokenami, nazwy to `ID`, czasy to `TIME_LITERAL`.”
3. **Parser.** „Parser sprawdza, czy ciąg tokenów da się wyprowadzić z reguły startowej `program`. Jeśli się da, zdanie należy do języka, a wynikiem jest drzewo rozbioru. Każdy węzeł drzewa to jedna reguła z `.g4`.”
4. **Zdanie niepoprawne.** „Jeśli się nie da, parser zgłasza błąd z linią i kolumną. ANTLR nie zatrzymuje się na pierwszym błędzie: wstawia brakujący token albo pomija nadmiarowe i parsuje dalej, więc zgłasza wszystkie błędy naraz.”
5. **Granica parsera.** „Parser sprawdza tylko formę. Zdanie 03 jest składniowo poprawne, ale niebezpieczne. To wyłapuje dopiero analiza semantyczna, która działa na drzewie po parserze.”

## Możliwe pytania

* **Jaka to gramatyka?** Bezkontekstowa i LL(1): jeden token podglądu wystarcza do wyboru reguły. Nie ma w niej rekurencji.
* **Skąd parser wie, że `ZIELNE` to błąd?** Lekser zrobił z tego `ID`, a reguła `lightState` dopuszcza tylko 13 konkretnych słów.
* **Dlaczego `krok` nie może być nazwą?** Słowa z gramatyki mają w lekserze pierwszeństwo przed `ID`.
* **Dlaczego nie sprawdzacie kolizji w gramatyce?** Bo wymaga to pamiętania zadeklarowanych nazw, a to zależność kontekstowa. Gramatyka bezkontekstowa tego nie wyrazi.

Więcej szczegółów: [docs/gramatyka.md](../docs/gramatyka.md).
