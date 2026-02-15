from dataclasses import dataclass

from .condition import Condition
from castle_sec_game.action_archetype import ActionArchetype
from castle_sec_game.inventory import InventoryItem
from castle_sec_game.map import MapNode


@dataclass
class ReturnActionArchetype(ActionArchetype):
    pass


@dataclass
class MoveActionArchetype(ActionArchetype):
    _map_node: MapNode

    def __init__(self, map_node: MapNode):
        self._map_node = map_node

    @property
    def map_node(self) -> MapNode:
        return self._map_node


@dataclass
class SolveTaskActionArchetype(ActionArchetype):
    _task_name: str

    def __init__(self, task_name: str):
        self._task_name = task_name

    @property
    def task_name(self) -> str:
        return self._task_name


@dataclass
class PickUpItemActionArchetype(ActionArchetype):
    _item: InventoryItem

    def __init__(self, item: InventoryItem):
        self._item = item

    @property
    def item(self) -> InventoryItem:
        return self._item


@dataclass
class ConditionalActionArchetype(ActionArchetype):
    _condition: Condition
    _action: ActionArchetype

    def __init__(self, condition: Condition, action: ActionArchetype):
        self._condition = condition
        self._action = action

    @property
    def condition(self) -> Condition:
        return self._condition

    @property
    def action(self) -> ActionArchetype:
        return self._action
