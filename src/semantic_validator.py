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
    ALLOWED_PEDESTRIAN_STATES = {"CZERWONE", "ZIELONE", "WYLACZONE"}
    ALLOWED_VEHICLE_STATES = {
        "CZERWONE", "CZERWONE_ZOLTE", "ZIELONE", "ZOLTE", "ZOLTE_MIGAJACE", "WYLACZONE"
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
            # Niezadeklarowane kierunki użyte w kroku
            undeclared = assigned - declared
            if undeclared:
                raise UndeclaredDirectionError(
                    f"Krok {idx} (linia {step.line}): użyto niezadeklarowanych kierunków: {undeclared}."
                )
            # Brakujące kierunki w kroku
            missing = declared - assigned
            if missing:
                raise IncompleteStepDefinitionError(
                    f"Krok {idx} (linia {step.line}): nie zdefiniowano stanu dla kierunków: {missing}."
                )

    def _validate_light_states(self, node: IntersectionNode) -> None:
        for idx, step in enumerate(node.steps, start=1):
            for dir_id, state in step.assignments.items():
                sig_type = node.directions[dir_id]
                if sig_type == "piesi":
                    if state not in self.ALLOWED_PEDESTRIAN_STATES:
                        raise InvalidLightStateForTypeException(
                            f"Krok {idx} (linia {step.line}): niedozwolony stan '{state}' dla sygnalizatora pieszych '{dir_id}'. "
                            f"Dozwolone stany dla pieszych: {self.ALLOWED_PEDESTRIAN_STATES}."
                        )
                elif sig_type == "pojazdy":
                    if state not in self.ALLOWED_VEHICLE_STATES:
                        raise InvalidLightStateForTypeException(
                            f"Krok {idx} (linia {step.line}): nieznany stan '{state}' dla pojazdów na kierunku '{dir_id}'."
                        )

    def _is_active_go_state(self, sig_type: str, state: str) -> bool:
        if sig_type == "pojazdy":
            return state in ("ZIELONE", "CZERWONE_ZOLTE")
        elif sig_type == "piesi":
            return state == "ZIELONE"
        return False

    def _validate_collision_safety(self, node: IntersectionNode) -> None:
        # Zbudowanie symetrycznej relacji kolizji
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
                            f"mają jednocześnie sygnał zezwalający na wjazd pomimo zadeklarowanej kolizji."
                        )

    def _validate_transitions(self, node: IntersectionNode) -> None:
        """
        Weryfikuje bezpieczne przejścia fazowe (w tym przejście z ostatniego do pierwszego kroku cyklu):
        - Pojazdy: ZIELONE -> CZERWONE wymaga pośredniego ZOLTE (min 2000 ms)
        - Pojazdy: CZERWONE -> ZIELONE wymaga pośredniego CZERWONE_ZOLTE
        """
        steps = node.steps
        n = len(steps)
        for i in range(n):
            curr_step = steps[i]
            next_step = steps[(i + 1) % n]

            for dir_id, dir_type in node.directions.items():
                if dir_type != "pojazdy":
                    continue

                curr_st = curr_step.assignments[dir_id]
                next_st = next_step.assignments[dir_id]

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

                # Jeśli krok to ZOLTE, sprawdź czy czas trwania to co najmniej 2s (2000ms)
                if curr_st == "ZOLTE" and curr_step.duration_ms < 2000:
                    raise InvalidTimeDurationError(
                        f"Krok {i+1} (linia {curr_step.line}): faza ZOLTE dla '{dir_id}' trwa {curr_step.duration_raw}, "
                        f"podczas gdy wymagane minimum bezpieczeństwa to 2s."
                    )
