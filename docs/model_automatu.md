# Model automatu skończonego i weryfikacja bezpieczeństwa

Kompilator tłumaczy deklaratywny kod źródłowy na deterministyczny automat skończony typu Moore'a. W automacie Moore'a sygnały wyjściowe (stan włączonych świateł na sygnalizatorach) zależą wyłącznie od bieżącego stanu automatu, a nie od sygnałów wejściowych.

## 1. Formalna definicja automatu

Automat sterowania ruchem definiuje szóstka uporządkowana:

$$M = (Q, \Sigma, \Delta, \delta, \lambda, q_0)$$

gdzie:
* $Q = \{q_0, q_1, q_2, \dots, q_{n-1}\}$: skończony zbiór stanów sterownika (odpowiadających kolejnym krokom cyklu oraz stanom awaryjnym/rozruchowym).
* $\Sigma$: alfabet wejściowy, zawierający zdarzenia sterujące:
  * `TICK_TIMEOUT`: sygnał zegarowy oznaczający upływ czasu przypisanego do danego kroku.
  * `ALL_RED_HOLD`: wymuszenie zatrzymania (opcjonalny sygnał bezpieczeństwa).
  * `RESET`: przejście do procedury startowej.
* $\Delta$: alfabet wyjściowy, będący zbiorem wektorów stanu wszystkich sygnalizatorów na skrzyżowaniu.
  Dla skrzyżowania o $k$ kierunkach wyjście ma postać:
  $$Y = (s_1, s_2, \dots, s_k), \quad s_i \in \{\text{CZERWONE}, \text{CZERWONE\_ZOLTE}, \text{ZIELONE}, \text{ZOLTE}, \dots\}$$
* $\delta: Q \times \Sigma \to Q$: funkcja przejścia determinująca kolejny stan po wystąpieniu sygnału zegarowego. W trybie cyklicznym przejście ma charakter pierścieniowy:
  $$\delta(q_i, \text{TICK\_TIMEOUT}) = q_{(i+1) \bmod n}$$
* $\lambda: Q \to \Delta$: funkcja wyjścia przypisująca każdemu stanowi $q \in Q$ wektor załączonych świateł.
* $q_0 \in Q$: stan początkowy (faza rozruchowa, zazwyczaj stan pełnego zatrzymania `ALL_RED` lub migającego żółtego).

---

## 2. Przykładowa tabela stanów (DFA)

Dla skrzyżowania z dwoma kierunkami kolizyjnymi (`NS` oraz `WE`) i przejściem `Pieszy_NS`, tabela przejść przyjmuje następującą postać:

| Stan ($q_i$) | Czas | NS (`pojazdy`) | WE (`pojazdy`) | Pieszy_NS (`piesi`) | Warunek przejścia | Stan następny |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **$q_1$** | 25 s | ZIELONE | CZERWONE | CZERWONE | $t \ge 25\text{ s}$ | $q_2$ |
| **$q_2$** | 3 s | ZOLTE | CZERWONE | CZERWONE | $t \ge 3\text{ s}$ | $q_3$ |
| **$q_3$** | 2 s | CZERWONE | CZERWONE_ZOLTE | CZERWONE | $t \ge 2\text{ s}$ | $q_4$ |
| **$q_4$** | 20 s | CZERWONE | ZIELONE | ZIELONE | $t \ge 20\text{ s}$ | $q_5$ |
| **$q_5$** | 3 s | CZERWONE | ZOLTE | CZERWONE | $t \ge 3\text{ s}$ | $q_6$ |
| **$q_6$** | 2 s | CZERWONE_ZOLTE | CZERWONE | CZERWONE | $t \ge 2\text{ s}$ | $q_1$ |

---

## 3. Matematyczna weryfikacja kolizji (Matryca kolizji)

Relacje kolizji tworzą symetryczną macierz binarną $C \in \{0, 1\}^{k \times k}$:

$$C_{i,j} = \begin{cases} 1 & \text{jeżeli ruch na kierunku } i \text{ koliduje z ruchem na kierunku } j \\ 0 & \text{w przeciwnym wypadku} \end{cases}$$

Z właściwości fizycznych wynika $C_{i,j} = C_{j,i}$ oraz $C_{i,i} = 0$.

Niech $G(q) \subseteq \{1, \dots, k\}$ oznacza zbiór kierunków posiadających sygnał zezwalający na wjazd w stanie $q$ (dla pojazdów: `ZIELONE` lub `CZERWONE_ZOLTE`; dla pieszych: `ZIELONE`).

Kompilator podczas analizy semantycznej dla każdego stanu $q \in Q$ weryfikuje niezmiennik bezpieczeństwa:

$$\forall i, j \in G(q): \quad C_{i, j} = 0$$

W przypadku znalezienia pary $(i, j)$ takiej, że $C_{i, j} = 1$, kompilacja zostaje przerwana z podaniem numeru wiersza i skonfliktowanych kierunków.

---

## 4. Reprezentacja pośrednia (IR) i kod wynikowy

Generator kodu tworzy zoptymalizowaną strukturę danych w formacie JSON, która może zostać załadowana bezpośrednio do symulatora lub firmware'u mikrokontrolera:

```json
{
  "name": "Niepodleglosci_ArmiiKrajowej",
  "directions": {
    "NS": "vehicles_3color",
    "WE": "vehicles_3color",
    "Pieszy_NS": "pedestrians_2color"
  },
  "states": [
    {
      "id": 0,
      "duration_ms": 25000,
      "outputs": {
        "NS": "GREEN",
        "WE": "RED",
        "Pieszy_NS": "RED"
      },
      "next_state": 1
    },
    {
      "id": 1,
      "duration_ms": 3000,
      "outputs": {
        "NS": "YELLOW",
        "WE": "RED",
        "Pieszy_NS": "RED"
      },
      "next_state": 2
    },
    {
      "id": 2,
      "duration_ms": 2000,
      "outputs": {
        "NS": "RED",
        "WE": "RED_YELLOW",
        "Pieszy_NS": "RED"
      },
      "next_state": 3
    },
    {
      "id": 3,
      "duration_ms": 20000,
      "outputs": {
        "NS": "RED",
        "WE": "GREEN",
        "Pieszy_NS": "GREEN"
      },
      "next_state": 4
    },
    {
      "id": 4,
      "duration_ms": 3000,
      "outputs": {
        "NS": "RED",
        "WE": "YELLOW",
        "Pieszy_NS": "RED"
      },
      "next_state": 5
    },
    {
      "id": 5,
      "duration_ms": 2000,
      "outputs": {
        "NS": "RED_YELLOW",
        "WE": "RED",
        "Pieszy_NS": "RED"
      },
      "next_state": 0
    }
  ]
}
```
