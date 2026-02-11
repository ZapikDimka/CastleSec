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

class HasItemConditionDto(BaseModel):
    type: Literal["has_item"]
    item: str

ConditionDto = Annotated[
    Union[HasItemConditionDto],
    Field(discriminator="type")
]

class ConditionalActionArchetypeDto(BaseModel):
    type: Literal["if"]
    condition: ConditionDto
    action: "ActionArchetypeDto"

ActionArchetypeDto = Annotated[
    Union[ReturnActionArchetypeDto, MoveActionArchetypeDto, PickUpItemActionArchetypeDto, ConditionalActionArchetypeDto],
    Field(discriminator="type")
]
