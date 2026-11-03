from dataclasses import dataclass, field
from typing import Dict, List, Tuple

def parse_duration_to_ms(duration_str: str) -> int:
    """Konwertuje literał czasu (np. '25s', '500ms', '2m') na milisekundy."""
    duration_str = duration_str.strip()
    if duration_str.endswith("ms"):
        return int(duration_str[:-2])
    elif duration_str.endswith("s"):
        return int(duration_str[:-1]) * 1000
    elif duration_str.endswith("m"):
        return int(duration_str[:-1]) * 60 * 1000
    else:
        # domyslnie w sekundach jesli brak jednostki
        return int(duration_str) * 1000

@dataclass
class StepNode:
    duration_ms: int
    duration_raw: str
    assignments: Dict[str, str] = field(default_factory=dict)
    line: int = 0

@dataclass
class IntersectionNode:
    name: str
    directions: Dict[str, str] = field(default_factory=dict)  # identyfikator -> 'pojazdy' | 'piesi'
    collisions: List[Tuple[str, str]] = field(default_factory=list)  # [(A, B), ...]
    steps: List[StepNode] = field(default_factory=list)
    line: int = 1
