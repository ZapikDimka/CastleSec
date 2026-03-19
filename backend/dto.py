from typing import Optional

from castle_sec_game.game.game import Game
from castle_sec_game.game.types import *
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
    message: Optional[str] = None
    task_url: Optional[str] = None


def node_to_dto(node: Node) -> MapNodeDto:
    return MapNodeDto(
        name=node.name,
        text=node.text,
        image=node.image.root
    )

def inventory_item_to_dto(item: Item) -> InventoryItemDto:
    return InventoryItemDto(
        name=item.name,
        image=item.image.root
    )

def inventory_to_dto(inventory: Inventory, ctx: Context) -> InventoryDto:
    return InventoryDto(
        items=[inventory_item_to_dto(item.resolve(ctx)) for item in inventory.items]
    )

def action_to_dto(action: Action) -> ActionDto:
    return ActionDto(
        text=action.label,
    )

def game_to_dto(game: Game) -> GameStateDto:
    return GameStateDto(
        is_solving_task=game.is_solving_task,
        node=node_to_dto(game.current_node),
        actions=list(map(action_to_dto, game.actions)),
        inventory=inventory_to_dto(game.inventory, game.ctx),
        message=game.state.message,
        task_url=game.task_url
    )
