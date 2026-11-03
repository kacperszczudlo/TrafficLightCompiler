import json
from typing import Dict, Any
from src.ast_nodes import IntersectionNode

STATE_MAP = {
    "CZERWONE": "RED",
    "CZERWONE_ZOLTE": "RED_YELLOW",
    "ZIELONE": "GREEN",
    "ZOLTE": "YELLOW",
    "ZOLTE_MIGAJACE": "YELLOW_FLASHING",
    "WYLACZONE": "OFF"
}

TYPE_MAP = {
    "pojazdy": "vehicles_3color",
    "piesi": "pedestrians_2color"
}

class DfaGenerator:
    @staticmethod
    def generate(node: IntersectionNode) -> Dict[str, Any]:
        directions_output = {
            d: TYPE_MAP.get(t, t) for d, t in node.directions.items()
        }

        states_output = []
        n = len(node.steps)
        for idx, step in enumerate(node.steps):
            outputs = {
                d: STATE_MAP.get(s, s) for d, s in step.assignments.items()
            }
            states_output.append({
                "id": idx,
                "duration_ms": step.duration_ms,
                "outputs": outputs,
                "next_state": (idx + 1) % n
            })

        return {
            "name": node.name,
            "directions": directions_output,
            "states": states_output
        }

    @staticmethod
    def to_json(node: IntersectionNode, indent: int = 2) -> str:
        data = DfaGenerator.generate(node)
        return json.dumps(data, indent=indent, ensure_ascii=False)
