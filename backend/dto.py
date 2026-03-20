from typing import Optional

from castle_sec_game.game.game import Game
from castle_sec_game.game.types import *
from pydantic import BaseModel

class InventoryItemDto(BaseModel):
    name: str
    image: str
    description: Optional[str] = None

class InventoryDto(BaseModel):
    items: list[InventoryItemDto]

class MapNodeDto(BaseModel):
    id: str
    name: str
    text: str
    image: str
    coords: Coords

class NodeSummaryDto(BaseModel):
    id: str
    name: str
    coords: Coords
    visited: bool

class EdgeDto(BaseModel):
    from_id: str
    to_id: str
    conditional: bool

class ActionDto(BaseModel):
    text: str

class GameStateDto(BaseModel):
    is_solving_task: bool
    node: MapNodeDto
    actions: list[ActionDto]
    inventory: InventoryDto
    message: Optional[str] = None
    task_url: Optional[str] = None
    map_nodes: list[NodeSummaryDto]
    edges: list[EdgeDto]
    ended: bool


def node_to_dto(node: Node) -> MapNodeDto:
    return MapNodeDto(
        id=node.id,
        name=node.name,
        text=node.text,
        image=node.image.root,
        coords=node.coords
    )

def node_to_summary_dto(node: Node, visited: bool) -> NodeSummaryDto:
    return NodeSummaryDto(
        id=node.id,
        name=node.name,
        coords=node.coords,
        visited=visited
    )

def inventory_item_to_dto(item: Item) -> InventoryItemDto:
    return InventoryItemDto(
        name=item.name,
        image=item.image.root,
        description=item.description
    )

def inventory_to_dto(inventory: Inventory, ctx: Context) -> InventoryDto:
    return InventoryDto(
        items=[inventory_item_to_dto(item.resolve(ctx)) for item in inventory.items]
    )

def action_to_dto(action: Action) -> ActionDto:
    return ActionDto(
        text=action.label,
    )

def _extract_edges(from_id: str, functions: list, conditional: bool) -> list[EdgeDto]:
    edges = []
    for function in functions:
        match function.type:
            case "MoveFunction":
                edges.append(EdgeDto(from_id=from_id, to_id=function.to.ref_id, conditional=conditional))
            case "ConditionalFunction":
                edges += _extract_edges(from_id, function.on_success, conditional=True)
                edges += _extract_edges(from_id, function.on_failure, conditional=True)
    return edges

def _node_edges(node: Node) -> list[EdgeDto]:
    edges = []
    for action in node.actions:
        is_conditional = len(action.conditions) > 0
        edges += _extract_edges(node.id, action.functions, conditional=is_conditional)
    return edges

def map_data_to_dto(game: Game) -> tuple[list[NodeSummaryDto], list[EdgeDto]]:
    ctx = game.ctx
    current_map = game.state.current_map.resolve(ctx)
    current_map_node_ids = {node.id for node in current_map.nodes}
    visited_ids = set(game.state.visited_nodes) & current_map_node_ids

    included_ids: set[str] = set()
    edges: list[EdgeDto] = []

    for node_id in visited_ids:
        node = ctx.get_object(node_id, Node)
        node_edges = _node_edges(node)
        edges += node_edges
        for edge in node_edges:
            included_ids.add(edge.to_id)

    included_ids.update(visited_ids)

    nodes = [
        node_to_summary_dto(ctx.get_object(nid, Node), visited=nid in visited_ids)
        for nid in included_ids
    ]

    return nodes, edges

def game_to_dto(game: Game) -> GameStateDto:
    map_nodes, edges = map_data_to_dto(game)
    return GameStateDto(
        is_solving_task=game.is_solving_task,
        node=node_to_dto(game.current_node),
        actions=list(map(action_to_dto, game.actions)),
        inventory=inventory_to_dto(game.inventory, game.ctx),
        message=game.state.message,
        task_url=game.task_url,
        map_nodes=map_nodes,
        edges=edges,
        ended=game.state.ended
    )
