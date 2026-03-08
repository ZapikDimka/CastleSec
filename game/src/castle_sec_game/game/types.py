from enum import StrEnum
from typing import Literal, Self


class TypeTag(StrEnum):
    NULL = "null"
    STRING = "string"

    LIST = "list"
    REF = "ref"

    TASK = "task"
    IMAGE = "image"

    ITEM = "item"
    ACTION = "action"
    NODE = "node"
    MAP = "map"


class Type:
    _tag: TypeTag

    @classmethod
    def of(cls, value: Literal["null", "string", "image", "action", "item", "node", "list", "map"]) -> Self:
        ty = cls()
        ty._tag = TypeTag(value)
        return ty

    @property
    def tag(self) -> TypeTag:
        return self._tag


class ListType(Type):
    _item_type: Type

    def __init__(self, item_type: Type):
        self._tag = TypeTag.LIST
        self._item_type = item_type

    @property
    def item_type(self) -> Type:
        return self._item_type


class RefType(Type):
    _target_type: Type

    def __init__(self, target_type: Type):
        self._tag = TypeTag.REF
        self._target_type = target_type

    @property
    def target_type(self) -> Type:
        return self._target_type


class Schema:
    def __init__(self, name: str, schema: dict[str, Type]):
        self._name = name
        self._schema = schema

    @property
    def name(self) -> str:
        return self._name

    @property
    def schema(self) -> dict[str, Type]:
        return self._schema
