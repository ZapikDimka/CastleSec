from castle_sec_game.action import Action
from castle_sec_game.action_archetype import ActionArchetype
from castle_sec_game.inventory_item import InventoryItem
from castle_sec_game.map_node import MapNode


class MoveAction(Action):
    _map_node: MapNode

    def __init__(self, archetype: ActionArchetype, map_node: MapNode, text: str | None = None):
        super().__init__(archetype, text or f"Move to '{map_node.name}'")
        self._map_node = map_node

    @property
    def map_node(self):
        return self._map_node


class SolveTaskAction(Action):
    def __init__(self, archetype: ActionArchetype):
        super().__init__(archetype, "Solve a task")


class PickUpItemAction(Action):
    def __init__(self, archetype: ActionArchetype, item: InventoryItem, text: str | None = None):
        super().__init__(archetype, text or f"Pick up '{item.name}'")
        self.item = item
