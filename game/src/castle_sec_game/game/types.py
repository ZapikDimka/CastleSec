from dataclasses import dataclass, field
from enum import StrEnum
from typing import Literal, Self, Any, Optional


class TypeTag(StrEnum):
    NULL = "null"
    STRING = "string"
    BOOL = "bool"

    REF = "ref"
    LIST = "list"
    STRUCT = "struct"

@dataclass(frozen=True)
class Type:
    tag: TypeTag

    @classmethod
    def of(cls, value: Literal["null", "string", "bool"]) -> Self:
        return cls(TypeTag(value))

    def __str__(self):
        return f"Atom<{self.tag.value}>"


@dataclass(frozen=True)
class StructType(Type):
    name: str
    schema: dict[str, Type] = field(hash=False)
    base: Optional[Self] = field(default=None, hash=False)

    tag: TypeTag = field(default=TypeTag.STRUCT, init=False)

    def __str__(self) -> str:
        return f"Struct<{self.name}>"

@dataclass(frozen=True)
class RefType(Type):
    target_type: StructType
    tag: TypeTag = field(default=TypeTag.REF, init=False)

    def __str__(self):
        return f"Ref<{self.target_type.name}>"

@dataclass(frozen=True)
class ListType(Type):
    item_type: Type
    tag: TypeTag = field(default=TypeTag.LIST, init=False)

    def __str__(self) -> str:
        return f"List<{self.item_type}>"
