# Model matematyczny automatu i weryfikacja bezpieczeństwa

Dokument opisuje teorię automatową sterownika sygnalizacji świetlnej oraz format danych wyjściowych kompilatora.

## 1. Definicja automatu Moore'a

Kompilator tłumaczy kod źródłowy węzła komunikacyjnego na deterministyczny automat skończony typu Moore'a. Wyjścia sygnalizatorów zależą wyłącznie od bieżącego stanu automatu.

Automat definiuje szóstka uporządkowana:

$$M = (Q, \Sigma, \Delta, \delta, \lambda, q_0)$$

gdzie:
* $Q = \{q_0, q_1, \dots, q_{n-1}\}$: skończony zbiór stanów sterownika (kolejne kroki cyklu węzła).
* $\Sigma = \{\text{TICK\_TIMEOUT}, \text{EMERGENCY\_STOP}, \text{RESET}\}$: alfabet zdarzeń wejściowych:
  * $\text{TICK\_TIMEOUT}$: upłynięcie czasu przypisanego do bieżącego kroku,
  * $\text{EMERGENCY\_STOP}$: sygnał awaryjny (np. wymuszenie żółtego migającego),
  * $\text{RESET}$: powrót do stanu początkowego $q_0$.
* $\Delta$: alfabet wyjściowy, zbiór wektorów stanów fizycznych wszystkich sygnalizatorów węzła:
  $$Y = (s_1, s_2, \dots, s_k), \quad s_i \in \text{StanSwiatla}$$
* $\delta: Q \times \Sigma \to Q$: deterministyczna funkcja przejścia. Dla normalnej pracy cyklicznej:
  $$\delta(q_i, \text{TICK\_TIMEOUT}) = q_{(i+1) \bmod n}$$
* $\lambda: Q \to \Delta$: funkcja wyjścia przypisująca stanowi $q \in Q$ wektor sygnałów świetlnych.
* $q_0 \in Q$: stan początkowy (krok rozruchowy węzła).

## 2. Macierz kolizji i warunek bezkolizyjności

Relacje kolizji tworzą binarną, symetryczną macierz $C \in \{0, 1\}^{k \times k}$ o zerowej przekątnej:

$$C_{i,j} = \begin{cases} 1 & \text{jeśli tory kierunku } i \text{ oraz } j \text{ kolidują ze sobą} \\ 0 & \text{w przeciwnym przypadku} \end{cases}$$

Właściwości:
* $C_{i,j} = C_{j,i}$ (symetria relacji kolizyjnej),
* $C_{i,i} = 0$ (kierunek nie koliduje sam ze sobą).

### Niezmiennik bezpieczeństwa
Niech $G(q) \subseteq \{1, \dots, k\}$ oznacza zbiór kierunków posiadających w stanie $q$ sygnał zezwalający na ruch (`ZIELONE`, `CZERWONE_ZOLTE`, `TRAM_JAZDA`, `PRZEJAZD_ZAMKNIETY` dla blokady skrzyżowania).

Kompilator weryfikuje dla każdego stanu $q \in Q$:

$$\forall i, j \in G(q): \quad C_{i, j} = 0$$

W przypadku znalezienia choć jednej pary $(i, j)$ o $C_{i,j} = 1$, kompilacja jest natychmiast przerywana z kodem błędu 1 i wyjątkiem `CollisionConflictException`.

## 3. Format wyjściowy kompilatora

Kompilator generuje dwa poziomy wyjścia:

### 3.1. Werdykt weryfikacji
* Sukces (`YES`): kod wyjścia `0`. Komunikat potwierdzający brak kolizji i poprawność czasów faz.
* Błąd (`NO`): kod wyjścia `1`. Wypisanie klasy błędu, numeru linii, kolumny oraz identyfikatorów konfliktowych sygnałów.

### 3.2. Reprezentacja pośrednia (IR JSON)
Wygenerowany plik JSON stanowi bezpośredni wsad dla sterownika fizycznego lub symulatora ruchu:

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
    },
    {
      "id": 1,
      "duration_ms": 3000,
      "outputs": {
        "Wlot_Zachod": "YELLOW",
        "Wlot_Wschod": "YELLOW",
        "Wlot_Poludnie": "RED",
        "Wlot_Polnoc": "RED",
        "Tramwaj_Linia_WE": "TRAM_ATTENTION",
        "Tramwaj_Linia_NS": "TRAM_STOP",
        "Piesi_Przejscia": "RED"
      },
      "next_state": 2
    }
  ]
}
```
Każdy element tablicy `states` reprezentuje stan $q_i \in Q$, a pole `outputs` określa wartość wektora wyjścia $\lambda(q_i)$.
