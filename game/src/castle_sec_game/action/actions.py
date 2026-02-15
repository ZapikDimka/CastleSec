from dataclasses import dataclass

from .action import Action
from castle_sec_game.action_archetype import ActionArchetype
from castle_sec_game.inventory.inventory_item import InventoryItem
from castle_sec_game.map.map_node import MapNode


@dataclass
class MoveAction(Action):
    _map_node: MapNode

    def __init__(self, archetype: ActionArchetype, map_node: MapNode, text: str | None = None):
        super().__init__(archetype, text or f"Move to '{map_node.name}'")
        self._map_node = map_node

    @property
    def map_node(self):
        return self._map_node


@dataclass
class SolveTaskAction(Action):
    _task_name: str

    def __init__(self, archetype: ActionArchetype, task_name: str):
        super().__init__(archetype, "Solve a task")
        self._task_name = task_name

    @property
    def task_name(self):
        return self._task_name


@dataclass
class PickUpItemAction(Action):
    def __init__(self, archetype: ActionArchetype, item: InventoryItem, text: str | None = None):
        super().__init__(archetype, text or f"Pick up '{item.name}'")
        self.item = item
