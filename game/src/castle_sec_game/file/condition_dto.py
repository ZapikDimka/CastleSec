from typing import Literal, TypeAlias, Annotated, Union

from pydantic import BaseModel, Field


class HasItemConditionDto(BaseModel):
    type: Literal["has_item"]
    item: str

ConditionDto: TypeAlias = Annotated[
    Union[HasItemConditionDto],
    Field(discriminator="type")
]
