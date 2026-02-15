from pydantic import BaseModel

from .item_dto import ItemDto
from .map_node_dto import MapNodeDto


class MapDto(BaseModel):
    items: dict[str, ItemDto]
    root: str
    nodes: dict[str, MapNodeDto]
