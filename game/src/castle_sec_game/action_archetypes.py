from castle_sec_game.action_archetype import ActionArchetype
from castle_sec_game.inventory_item import InventoryItem
from castle_sec_game.map_node import MapNode


class ReturnActionArchetype(ActionArchetype):
    pass

class MoveActionArchetype(ActionArchetype):
    _map_node: MapNode

    def __init__(self, map_node: MapNode):
        self._map_node = map_node

    @property
    def map_node(self) -> MapNode:
        return self._map_node


class SolveTaskActionArchetype(ActionArchetype):
    pass


class PickUpItemActionArchetype(ActionArchetype):
    _item: InventoryItem

    def __init__(self, item: InventoryItem):
        self._item = item

    @property
    def item(self) -> InventoryItem:
        return self._item
