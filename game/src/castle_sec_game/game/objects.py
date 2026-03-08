from typing import Optional, Any

from castle_sec_game.game.types import *


class Object:
    @staticmethod
    def null() -> "Atom":
        return Atom(None)

    def as_atom(self, expected_py_type: Optional[type] = None) -> "Atom":
        if not isinstance(self, Atom):
            raise TypeError(f"Expected Atom, got {type(self).__name__}")
        return self

    def as_composite(self, expected_schema: Optional["Schema"] = None) -> "Composite":
        if not isinstance(self, Composite):
            raise TypeError(f"Expected Composite, got {type(self).__name__}")
        if expected_schema and self.schema.name != expected_schema.name:
            raise TypeError(f"Expected schema '{expected_schema.name}', got '{self.schema.name}'")
        return self

    def as_list(self, expected_item_tag: Optional[TypeTag] = None) -> "ListObject":
        if not isinstance(self, ListObject):
            raise TypeError(f"Expected ListObject, got {type(self).__name__}")
        return self

    def as_str(self) -> str:
        return self.as_atom(str).value


class Atom(Object):
    def __init__(self, value: Any):
        self._value = value

    @property
    def value(self) -> Any:
        return self._value


class Variables:
    def __init__(self, vars_dict: Optional[dict[str, Object]] = None):
        self._vars = vars_dict or {}

    def __getitem__(self, item: str) -> Object:
        return self._vars.get(item, Object.null())

    def __setitem__(self, key: str, value: Object):
        self._vars[key] = value


class Composite(Object):
    def __init__(self, schema: Schema, variables: dict[str, Object] = None):
        self._schema = schema
        self._variables = Variables(variables)

    @property
    def schema(self) -> Schema:
        return self._schema

    def __getitem__(self, item: str) -> Object:
        return self._variables[item]

    def __setitem__(self, key: str, value: Object):
        self._variables[key] = value

Schema.instance = lambda self, variables: Composite(self, variables)


class ListObject(Object):
    def __init__(self, item_type: Type, items: Optional[list[Object]] = None):
        self._item_type = item_type
        self._items = items or []

    @property
    def items(self) -> list[Object]:
        return self._items

    @property
    def item_type(self) -> Type:
        return self._item_type
