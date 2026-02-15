import logging
from typing import List

from .item_dto import ItemDto
from .map_dto import MapDto
from .map_node_dto import MapNodeDto
from .action_archetype_dto import *
from castle_sec_game.action_archetype import *
from castle_sec_game.map import MapNode
from castle_sec_game.inventory import InventoryItem


class FileReader:
    _filename: str
    _map_nodes: dict[str, MapNode] = {}
    _items: dict[str, InventoryItem] = {}

    def __init__(self, filename: str):
        self._filename = filename

    def __str__(self):
        return f"FileReader({self._filename})"

    def read_file(self) -> MapNode:
        logging.info(f"[{self}] Reading file")
        with open(self._filename, "r") as file:
            map_dto = MapDto.model_validate_json(file.read())
            return self._build_map(map_dto)

    def _build_map(self, dto: MapDto) -> MapNode:
        # TODO: Check if empty

        logging.debug(f"[{self}] Loading items")
        self._build_items(dto)

        logging.debug(f"[{self}] Loading map nodes")
        for id, node_dto in dto.nodes.items():
            map_node = self._build_map_node(node_dto)
            self._map_nodes[id] = map_node # TODO: Verify not duplicated

        logging.debug(f"[{self}] Loading map nodes' actions")
        for id, node in dto.nodes.items():
            actions = self._build_actions(node.actions)
            self._map_nodes[id]._actions = actions # TODO

        logging.debug(f"[{self}] Returning map root node")
        return self._map_nodes[dto.root]

    def _build_items(self, dto: MapDto):
        self._items = {}
        for id, item in dto.items.items():
            self._items[id] = self._build_item(item) # TODO: Verify not duplicated

    def _build_item(self, dto: ItemDto) -> InventoryItem:
        return InventoryItem(name=dto.name)

    def _build_map_node(self, dto: MapNodeDto) -> MapNode:
        return MapNode(name=dto.name, text=dto.text, actions=[]) #self._build_actions(dto.actions))

    def _build_actions(self, actions: List[ActionArchetypeDto]) -> list[ActionArchetype]:
        return [self._build_action(action) for action in actions]

    # TODO: Add ids to actions for further programming in the assets
    def _build_action(self, action: ActionArchetypeDto) -> ActionArchetype:
        match action:
            case ReturnActionArchetypeDto():
                return ReturnActionArchetype()
            case MoveActionArchetypeDto():
                return MoveActionArchetype(self._find_map_node(action.to))
            case PickUpItemActionArchetypeDto():
                return PickUpItemActionArchetype(self._find_inventory_item(action.item))
            case SolveTaskActionArchetypeDto():
                return SolveTaskActionArchetype(action.name) # TODO: Validate task exists
            case ConditionalActionArchetypeDto():
                return ConditionalActionArchetype(self._build_condition(action.condition), self._build_action(action.action))
            case _:
                raise NotImplementedError(f"Unknown action {action}")

    def _build_condition(self, condition: ConditionDto) -> Condition:
        match condition:
            case HasItemConditionDto():
                return HasItemCondition(self._find_inventory_item(condition.item))
            case _:
                raise NotImplementedError(f"Unknown condition {condition}")

    def _find_map_node(self, id: str) -> MapNode | None:
        map_node = self._map_nodes.get(id, None)
        # TODO: Verify not None
        return map_node


    def _find_inventory_item(self, id: str) -> InventoryItem | None:
        item = self._items.get(id, None)
        # TODO: Verify not None
        return item
