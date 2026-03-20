from typing import Literal, Annotated, Union, Optional
from pydantic import BaseModel, Field, PrivateAttr, RootModel

from castle_sec_game.game.context import Context

class Ref[T](RootModel[T]):
    root: str
    _resolved_target: Optional[T] = PrivateAttr(default=None)

    @property
    def ref_id(self) -> str:
        return self.root

    def resolve(self, ctx: Context) -> T:
        if self._resolved_target is None:
            self._resolved_target = ctx.get_object(self.ref_id)
        return self._resolved_target

class Asset(BaseModel):
    path: str

class Task(BaseModel):
    path: str

class Item(BaseModel):
    id: str
    name: str
    image: Ref[Asset]
    description: Optional[str] = None

class Coords(BaseModel):
    x: float
    y: float

class Node(BaseModel):
    id: str
    name: str
    text: str
    image: Ref[Asset]
    actions: list["Action"]
    coords: Coords
    state: Optional[str] = None

class Map(BaseModel):
    id: str
    root: Ref[Node]
    nodes: list[Node]

class Inventory(BaseModel):
    items: list[Ref[Item]]

class GameData(BaseModel):
    items: list[Item]
    root: Ref[Map]
    maps: list[Map]

class GameState(BaseModel):
    current_map: Ref[Map]
    current_node: Ref[Node]
    prev_node: Optional[Ref[Node]] = None
    inventory: Inventory
    message: Optional[str] = None
    visited_nodes: list[str] = Field(default_factory=list)
    variables: dict[str, str] = Field(default_factory=dict)
    ended: bool = False

class BaseFunction(BaseModel):
    pass

class MoveFunction(BaseFunction):
    type: Literal["MoveFunction"] = "MoveFunction"
    to: Ref[Node]

class PickUpItemFunction(BaseFunction):
    type: Literal["PickUpItemFunction"] = "PickUpItemFunction"
    item: Ref[Item]

class SolveTaskFunction(BaseFunction):
    type: Literal["SolveTaskFunction"] = "SolveTaskFunction"
    task: Ref[Task]
    on_success: list["FunctionType"] = Field(default_factory=list)
    on_failure: list["FunctionType"] = Field(default_factory=list)
    remove_on_success: bool = True

class RemoveItemFunction(BaseFunction):
    type: Literal["RemoveItemFunction"] = "RemoveItemFunction"
    item: Ref[Item]

class SetNodeStateFunction(BaseFunction):
    type: Literal["SetNodeStateFunction"] = "SetNodeStateFunction"
    target_node: Optional[Ref[Node]] = None
    value: Optional[str] = None

class SetGameVariableFunction(BaseFunction):
    type: Literal["SetGameVariableFunction"] = "SetGameVariableFunction"
    key: str
    value: Optional[str] = None

class IncrementGameVariableFunction(BaseFunction):
    type: Literal["IncrementGameVariableFunction"] = "IncrementGameVariableFunction"
    key: str
    amount: int = 1

class SetTextFunction(BaseFunction):
    type: Literal["SetTextFunction"] = "SetTextFunction"
    target_node: Optional[Ref[Node]] = None
    variable: str
    value: str

class SetImageFunction(BaseFunction):
    type: Literal["SetImageFunction"] = "SetImageFunction"
    target_node: Optional[Ref[Node]] = None
    value: Ref[Asset]

class BaseCondition(BaseModel):
    negate: Optional[bool] = None

class HasItemCondition(BaseCondition):
    type: Literal["HasItemCondition"] = "HasItemCondition"
    item: Ref[Item]

class NodeStateCondition(BaseCondition):
    type: Literal["NodeStateCondition"] = "NodeStateCondition"
    target_node: Optional[Ref[Node]] = None
    value: Optional[str] = None

class GameVariableCondition(BaseCondition):
    type: Literal["GameVariableCondition"] = "GameVariableCondition"
    key: str
    value: Optional[str] = None
    operator: Literal["eq", "gt", "gte", "lt", "lte"] = "eq"

class AnyCondition(BaseCondition):
    type: Literal["AnyCondition"] = "AnyCondition"
    conditions: list["ConditionType"]

class AllCondition(BaseCondition):
    type: Literal["AllCondition"] = "AllCondition"
    conditions: list["ConditionType"]

ConditionType = Annotated[Union[HasItemCondition, NodeStateCondition, GameVariableCondition, AnyCondition, AllCondition], Field(discriminator="type")]

class RandomBranch(BaseModel):
    weight: float = Field(gt=0)
    functions: list["FunctionType"]
    once: bool = False

class RandomFunction(BaseFunction):
    type: Literal["RandomFunction"] = "RandomFunction"
    branches: list[RandomBranch]

class ChangeMapFunction(BaseFunction):
    type: Literal["ChangeMapFunction"] = "ChangeMapFunction"
    map: Ref[Map]
    node: Ref[Node]

class EndGameFunction(BaseFunction):
    type: Literal["EndGameFunction"] = "EndGameFunction"
    message: Optional[str] = None

class ShowMessageFunction(BaseFunction):
    type: Literal["ShowMessageFunction"] = "ShowMessageFunction"
    message: str

class ConditionalFunction(BaseFunction):
    type: Literal["ConditionalFunction"] = "ConditionalFunction"
    condition: ConditionType
    on_success: list["FunctionType"] = Field(default_factory=list)
    on_failure: list["FunctionType"] = Field(default_factory=list)

FunctionType = Annotated[Union[MoveFunction, PickUpItemFunction, RemoveItemFunction, SetNodeStateFunction, SetGameVariableFunction, IncrementGameVariableFunction, SetTextFunction, SetImageFunction, SolveTaskFunction, ChangeMapFunction, EndGameFunction, ShowMessageFunction, ConditionalFunction, RandomFunction], Field(discriminator="type")]

class Action(BaseModel):
    label: str
    functions: list[FunctionType]
    once: Optional[bool] = None
    conditions: list[ConditionType] = Field(default_factory=list)

Node.model_rebuild()
ConditionalFunction.model_rebuild()
RandomBranch.model_rebuild()
AnyCondition.model_rebuild()
AllCondition.model_rebuild()
