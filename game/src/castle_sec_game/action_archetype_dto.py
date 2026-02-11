from typing import Union, Literal, Annotated

from pydantic import BaseModel, Field


class ReturnActionArchetypeDto(BaseModel):
    type: Literal["return"]

class MoveActionArchetypeDto(BaseModel):
    type: Literal["move"]
    to: str

class PickUpItemActionArchetypeDto(BaseModel):
    type: Literal["pickup"]
    item: str

ActionArchetypeDto = Annotated[
    Union[ReturnActionArchetypeDto, MoveActionArchetypeDto, PickUpItemActionArchetypeDto],
    Field(discriminator="type")
]
