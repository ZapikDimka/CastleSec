from pydantic import BaseModel

from castle_sec_game.item_dto import ItemDto
from castle_sec_game.map_node_dto import MapNodeDto


class MapDto(BaseModel):
    items: dict[str, ItemDto]
    root: str
    nodes: dict[str, MapNodeDto]
