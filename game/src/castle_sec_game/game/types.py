from enum import StrEnum
from typing import Literal, Self, Any, Optional


class TypeTag(StrEnum):
    NULL = "null"
    STRING = "string"

    REF = "ref"
    LIST = "list"
    STRUCT = "struct"

class Type:
    _tag: TypeTag

    @classmethod
    def of(cls, value: Literal["null", "string"]) -> Self:
        ty = cls()
        ty._tag = TypeTag(value)
        return ty

    @property
    def tag(self) -> TypeTag:
        return self._tag

    def __eq__(self, other: Any) -> bool:
        if not isinstance(other, Type):
            return False

        return self.tag == other.tag

    def __hash__(self) -> int:
        return hash(self.tag)

    def __str__(self):
        return f"Atom<{self._tag}>"


class StructType(Type):
    def __init__(self, name: str, schema: dict[str, Type], base: Optional[Self] = None):
        self._tag = TypeTag.STRUCT
        self._name = name
        self._schema = schema
        self._base = base

    @property
    def name(self) -> str:
        return self._name

    @property
    def schema(self) -> dict[str, Type]:
        return self._schema

    @property
    def base(self) -> Optional[Self]:
        return self._base

    def __eq__(self, other: Any) -> bool:
        if not isinstance(other, StructType):
            return False

        return self.schema == other.schema

    def __hash__(self) -> int:
        return hash(self.name)

    def __str__(self):
        return f"Struct<{self.name}>"


class RefType(Type):
    _target_type: StructType

    def __init__(self, target_type: StructType):
        self._tag = TypeTag.REF
        self._target_type = target_type

    @property
    def target_type(self) -> StructType:
        return self._target_type

    def __eq__(self, other: Any) -> bool:
        if not isinstance(other, RefType):
            return False

        return self.target_type == other.target_type

    def __hash__(self) -> int:
        return hash(self.target_type)

    def __str__(self):
        return f"Ref<{self.target_type.name}>"

class ListType(Type):
    _item_type: Type

    def __init__(self, item_type: Type):
        self._tag = TypeTag.LIST
        self._item_type = item_type

    @property
    def item_type(self) -> Type:
        return self._item_type

    def __eq__(self, other: Any) -> bool:
        if not isinstance(other, ListType):
            return False

        return self.item_type == other.item_type

    def __hash__(self) -> int:
        return hash(self.item_type)

    def __str__(self):
        return f"List<{self.item_type}>"
