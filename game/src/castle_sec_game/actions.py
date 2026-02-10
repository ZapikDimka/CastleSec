from castle_sec_game.action import Action
from castle_sec_game.map_node import MapNode


class MoveAction(Action):
    _map_node: MapNode

    def __init__(self, map_node: MapNode, text: str | None = None):
        super().__init__(text or f"Move to {map_node.name}")
        self._map_node = map_node

    @property
    def map_node(self):
        return self._map_node
