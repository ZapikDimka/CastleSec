from typing import Union, Literal, Annotated, TypeAlias

from pydantic import BaseModel, Field

from .condition_dto import ConditionDto


class ReturnActionArchetypeDto(BaseModel):
    type: Literal["return"]

class MoveActionArchetypeDto(BaseModel):
    type: Literal["move"]
    to: str

class PickUpItemActionArchetypeDto(BaseModel):
    type: Literal["pickup"]
    item: str

class SolveTaskActionArchetypeDto(BaseModel):
    type: Literal["solve_task"]
    name: str

class ConditionalActionArchetypeDto(BaseModel):
    type: Literal["if"]
    condition: ConditionDto
    action: "ActionArchetypeDto"

ActionArchetypeDto: TypeAlias = Annotated[
    Union[ReturnActionArchetypeDto, MoveActionArchetypeDto, PickUpItemActionArchetypeDto, SolveTaskActionArchetypeDto, ConditionalActionArchetypeDto],
    Field(discriminator="type")
]
