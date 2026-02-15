from typing import List

from pydantic import BaseModel

from .action_archetype_dto import ActionArchetypeDto


class MapNodeDto(BaseModel):
    name: str
    text: str
    actions: List[ActionArchetypeDto]
