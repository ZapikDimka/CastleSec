from typing import List

from castle_sec_game.action_archetype import ActionArchetype
from castle_sec_game.action_archetype_dto import ActionArchetypeDto, ReturnActionArchetypeDto, MoveActionArchetypeDto
from castle_sec_game.action_archetypes import MoveActionArchetype, ReturnActionArchetype
from castle_sec_game.map_dto import MapDto
from castle_sec_game.map_node import MapNode
from castle_sec_game.map_node_dto import MapNodeDto


class FileReader:
    _filename: str
    _map_nodes: dict[str, MapNode] = {}

    def __init__(self, filename: str):
        self._filename = filename

    def read_file(self) -> MapNode:
        with open(self._filename, "r") as file:
            map_dto = MapDto.model_validate_json(file.read())
            return self._build_map(map_dto)

    def _build_map(self, dto: MapDto) -> MapNode:
        # TODO: Check if empty

        for id, node_dto in dto.nodes.items():
            map_node = self._build_map_node(node_dto)
            self._map_nodes[id] = map_node # TODO: Verify not duplicated

        for id, node in dto.nodes.items():
            actions = self._build_actions(node.actions)
            self._map_nodes[id]._actions = actions # TODO

        return self._map_nodes[dto.root]

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
            case _:
                raise NotImplementedError(f"Unknown action {action}")

    def _find_map_node(self, id: str):
        map_node = self._map_nodes.get(id, None)
        # TODO: Verify not None
        return map_node