from castle_sec_game.action import Action
from castle_sec_game.game import Game
from castle_sec_game.inventory import Inventory, InventoryItem
from castle_sec_game.map import MapNode
from pydantic import BaseModel

class InventoryItemDto(BaseModel):
    name: str
    image: str

class InventoryDto(BaseModel):
    items: list[InventoryItemDto]

class MapNodeDto(BaseModel):
    name: str
    text: str
    image: str

class ActionDto(BaseModel):
    text: str

class GameStateDto(BaseModel):
    is_solving_task: bool
    node: MapNodeDto
    actions: list[ActionDto]
    inventory: InventoryDto


def node_to_dto(node: MapNode) -> MapNodeDto:
    return MapNodeDto(
        name=node.name,
        text=node.text,
        image=node.image
    )

def inventory_item_to_dto(item: InventoryItem) -> InventoryItemDto:
    return InventoryItemDto(
        name=item.name,
        image=item.image
    )

def inventory_to_dto(inventory: Inventory) -> InventoryDto:
    return InventoryDto(
        items=list(map(inventory_item_to_dto, inventory))
    )

def action_to_dto(action: Action) -> ActionDto:
    return ActionDto(
        text=action.text,
    )

def game_to_dto(game: Game) -> GameStateDto:
    return GameStateDto(
        is_solving_task=game.is_solving_task,
        node=node_to_dto(game.current_node),
        actions=list(map(action_to_dto, game.actions)),
        inventory=inventory_to_dto(game.inventory)
    )
