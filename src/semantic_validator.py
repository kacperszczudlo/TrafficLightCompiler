from typing import Dict, List, Set, Tuple
from src.ast_nodes import IntersectionNode, StepNode

class SemanticError(Exception):
    """Bazowa klasa błędu semantycznego."""
    pass

class UndeclaredDirectionError(SemanticError):
    pass

class IncompleteStepDefinitionError(SemanticError):
    pass

class InvalidLightStateForTypeException(SemanticError):
    pass

class CollisionConflictException(SemanticError):
    pass

class InvalidPhaseTransitionError(SemanticError):
    pass

class InvalidTimeDurationError(SemanticError):
    pass

class CycleTooShortError(SemanticError):
    pass


class SemanticValidator:
    ALLOWED_STATES_BY_TYPE = {
        "pojazdy": {
            "CZERWONE", "CZERWONE_ZOLTE", "ZIELONE", "ZOLTE", "ZOLTE_MIGAJACE", "WYLACZONE"
        },
        "samochody": {
            "CZERWONE", "CZERWONE_ZOLTE", "ZIELONE", "ZOLTE", "ZOLTE_MIGAJACE", "WYLACZONE"
        },
        "rowery": {
            "CZERWONE", "CZERWONE_ZOLTE", "ZIELONE", "ZOLTE", "ZOLTE_MIGAJACE", "WYLACZONE"
        },
        "piesi": {
            "CZERWONE", "ZIELONE", "ZIELONE_MIGAJACE", "WYLACZONE"
        },
        "tramwaje": {
            "TRAM_STOJ", "TRAM_JAZDA", "TRAM_UWAGA", "WYLACZONE"
        },
        "kolej": {
            "PRZEJAZD_OTWARTY", "PRZEJAZD_OSTRZEZENIE", "PRZEJAZD_ZAMKNIETY", "WYLACZONE"
        }
    }

    def validate(self, node: IntersectionNode) -> None:
        self._validate_directions(node)
        self._validate_collisions(node)
        self._validate_cycle_structure(node)
        self._validate_step_completeness(node)
        self._validate_light_states(node)
        self._validate_collision_safety(node)
        self._validate_transitions(node)

    def _validate_directions(self, node: IntersectionNode) -> None:
        if not node.directions:
            raise SemanticError(f"Skrzyżowanie '{node.name}' nie zawiera żadnych zadeklarowanych kierunków.")

    def _validate_collisions(self, node: IntersectionNode) -> None:
        declared = set(node.directions.keys())
        for u, v in node.collisions:
            if u not in declared:
                raise UndeclaredDirectionError(
                    f"Kierunek '{u}' w sekcji kolizji nie został zadeklarowany w sekcji kierunki."
                )
            if v not in declared:
                raise UndeclaredDirectionError(
                    f"Kierunek '{v}' w sekcji kolizji nie został zadeklarowany w sekcji kierunki."
                )

    def _validate_cycle_structure(self, node: IntersectionNode) -> None:
        if len(node.steps) < 2:
            raise CycleTooShortError(
                f"Cykl musi zawierać co najmniej 2 kroki (znaleziono: {len(node.steps)})."
            )
        for idx, step in enumerate(node.steps, start=1):
            if step.duration_ms <= 0:
                raise InvalidTimeDurationError(
                    f"Krok {idx} (linia {step.line}): czas trwania musi być większy od zera (podano: '{step.duration_raw}')."
                )

    def _validate_step_completeness(self, node: IntersectionNode) -> None:
        declared = set(node.directions.keys())
        for idx, step in enumerate(node.steps, start=1):
            assigned = set(step.assignments.keys())
            undeclared = assigned - declared
            if undeclared:
                raise UndeclaredDirectionError(
                    f"Krok {idx} (linia {step.line}): użyto niezadeklarowanych kierunków: {undeclared}."
                )
            missing = declared - assigned
            if missing:
                raise IncompleteStepDefinitionError(
                    f"Krok {idx} (linia {step.line}): nie zdefiniowano stanu dla kierunków: {missing}."
                )

    def _validate_light_states(self, node: IntersectionNode) -> None:
        for idx, step in enumerate(node.steps, start=1):
            for dir_id, state in step.assignments.items():
                sig_type = node.directions[dir_id]
                allowed = self.ALLOWED_STATES_BY_TYPE.get(sig_type)
                if allowed is None or state not in allowed:
                    raise InvalidLightStateForTypeException(
                        f"Krok {idx} (linia {step.line}): niedozwolony stan '{state}' dla sygnalizatora typu '{sig_type}' na kierunku '{dir_id}'. "
                        f"Dozwolone stany: {sorted(list(allowed)) if allowed else 'brak'}."
                    )

    def _is_active_go_state(self, sig_type: str, state: str) -> bool:
        if sig_type in ("pojazdy", "samochody", "rowery"):
            return state in ("ZIELONE", "CZERWONE_ZOLTE")
        elif sig_type == "piesi":
            return state in ("ZIELONE", "ZIELONE_MIGAJACE")
        elif sig_type == "tramwaje":
            return state == "TRAM_JAZDA"
        elif sig_type == "kolej":
            return state in ("PRZEJAZD_ZAMKNIETY", "PRZEJAZD_OSTRZEZENIE")
        return False

    def _validate_collision_safety(self, node: IntersectionNode) -> None:
        conflict_pairs: Set[Tuple[str, str]] = set()
        for u, v in node.collisions:
            conflict_pairs.add((u, v))
            conflict_pairs.add((v, u))

        for idx, step in enumerate(node.steps, start=1):
            active_directions = [
                d for d, s in step.assignments.items()
                if self._is_active_go_state(node.directions[d], s)
            ]
            for i in range(len(active_directions)):
                for j in range(i + 1, len(active_directions)):
                    d1 = active_directions[i]
                    d2 = active_directions[j]
                    if (d1, d2) in conflict_pairs:
                        raise CollisionConflictException(
                            f"Krok {idx} (linia {step.line}): wykryto konflikt kolizyjny! "
                            f"Kierunki '{d1}' ({step.assignments[d1]}) i '{d2}' ({step.assignments[d2]}) "
                            f"mają jednocześnie sygnał zezwalający na ruch pomimo zadeklarowanej kolizji."
                        )

    def _validate_transitions(self, node: IntersectionNode) -> None:
        """
        Weryfikuje bezpieczne przejścia fazowe w obrębie cyklu:
        - Pojazdy/samochody/rowery: ZIELONE -> CZERWONE wymaga pośredniego ZOLTE (min 2000 ms)
        - Pojazdy/samochody/rowery: CZERWONE -> ZIELONE wymaga pośredniego CZERWONE_ZOLTE
        - Tramwaje: TRAM_JAZDA -> TRAM_STOJ wymaga pośredniego TRAM_UWAGA
        - Kolej: PRZEJAZD_OTWARTY -> PRZEJAZD_ZAMKNIETY wymaga pośredniego PRZEJAZD_OSTRZEZENIE
        """
        steps = node.steps
        n = len(steps)
        for i in range(n):
            curr_step = steps[i]
            next_step = steps[(i + 1) % n]

            for dir_id, dir_type in node.directions.items():
                curr_st = curr_step.assignments[dir_id]
                next_st = next_step.assignments[dir_id]

                if dir_type in ("pojazdy", "samochody", "rowery"):
                    # Zakaz bezpośredniego ZIELONE -> CZERWONE
                    if curr_st == "ZIELONE" and next_st == "CZERWONE":
                        raise InvalidPhaseTransitionError(
                            f"Niedozwolone bezpośrednie przejście ZIELONE -> CZERWONE na kierunku '{dir_id}' "
                            f"pomiędzy krokiem {i+1} a krokiem {(i+1)%n + 1}. Wymagana faza ZOLTE."
                        )

                    # Zakaz bezpośredniego CZERWONE -> ZIELONE bez CZERWONE_ZOLTE
                    if curr_st == "CZERWONE" and next_st == "ZIELONE":
                        raise InvalidPhaseTransitionError(
                            f"Niedozwolone bezpośrednie przejście CZERWONE -> ZIELONE na kierunku '{dir_id}' "
                            f"pomiędzy krokiem {i+1} a krokiem {(i+1)%n + 1}. Wymagana faza CZERWONE_ZOLTE."
                        )

                    # Czas żółtego min. 2s (2000ms)
                    if curr_st == "ZOLTE" and curr_step.duration_ms < 2000:
                        raise InvalidTimeDurationError(
                            f"Krok {i+1} (linia {curr_step.line}): faza ZOLTE dla '{dir_id}' trwa {curr_step.duration_raw}, "
                            f"podczas gdy wymagane minimum bezpieczeństwa to 2s."
                        )

                elif dir_type == "tramwaje":
                    if curr_st == "TRAM_JAZDA" and next_st == "TRAM_STOJ":
                        raise InvalidPhaseTransitionError(
                            f"Niedozwolone bezpośrednie przejście TRAM_JAZDA -> TRAM_STOJ na kierunku tramwajowym '{dir_id}' "
                            f"pomiędzy krokiem {i+1} a krokiem {(i+1)%n + 1}. Wymagana faza ostrzegawcza TRAM_UWAGA."
                        )

                elif dir_type == "kolej":
                    if curr_st == "PRZEJAZD_OTWARTY" and next_st == "PRZEJAZD_ZAMKNIETY":
                        raise InvalidPhaseTransitionError(
                            f"Niedozwolone bezpośrednie przejście PRZEJAZD_OTWARTY -> PRZEJAZD_ZAMKNIETY na kierunku kolejowym '{dir_id}' "
                            f"pomiędzy krokiem {i+1} a krokiem {(i+1)%n + 1}. Wymagana faza ostrzegawcza PRZEJAZD_OSTRZEZENIE."
                        )
