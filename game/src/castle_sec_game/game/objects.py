import typing

from castle_sec_game.game.schemas import SUBTYPE_REGISTRY
from castle_sec_game.game.types import *

if typing.TYPE_CHECKING:
    from castle_sec_game.game.ctx import EngineContext

class Object:
    def __init__(self, obj_type: Type):
        self._type = obj_type

    @property
    def type(self) -> Type:
        return self._type

    @staticmethod
    def null() -> "Atom":
        return Atom.null()

    def as_atom(self, expected_py_type: Optional[type] = None) -> "Atom":
        if not isinstance(self, Atom):
            raise TypeError(f"Expected Atom, got {type(self).__name__}")
        if expected_py_type and not isinstance(self.value, expected_py_type):
            raise TypeError(f"Expected {expected_py_type}, got {type(self.value).__name__}")
        return self

    def as_atom_v[T](self, expected_py_type: type) -> T:
        return self.as_atom(expected_py_type).value

    def as_struct(self, expected_type: Optional["StructType"] = None) -> "Struct":
        if not isinstance(self, Struct):
            raise TypeError(f"Expected Struct, got {type(self).__name__}")
        if expected_type:
            actual_name = self.type.name
            expected_name = expected_type.name
            if actual_name != expected_name:
                valid_subtypes = SUBTYPE_REGISTRY.get(expected_name, set())
                if actual_name not in valid_subtypes:
                    raise TypeError(
                        f"Type error: Expected '{expected_name}' or one of its subtypes, "
                        f"but got '{actual_name}'"
                    )

        return self

    def as_list(self, expected_item_type: Optional[Type] = None) -> "ListObject":
        if not isinstance(self, ListObject):
            raise TypeError(f"Expected ListObject, got {type(self).__name__}")
        if expected_item_type and self.item_type != expected_item_type:
            raise TypeError(f"Expected list of '{expected_item_type}' got list of '{self.item_type}'")
        return self

    def as_list_v[T](self, expected_item_type: Type) -> list[T]:
        return self.as_list(expected_item_type).items

    def as_ref(self) -> "RefObject":
        if not isinstance(self, RefObject):
            raise TypeError(f"Expected RefObject, got {type(self).__name__}")
        return self

    def as_ref_v[T](self, expected_type: Optional["StructType"] = None) -> T:
        res = self.as_ref().resolve()
        if expected_type and res.type != expected_type:
            raise TypeError(f"Expected '{expected_type}' got '{res.type}'")

        return res

    def as_str(self) -> str:
        return self.as_atom(str).value


class Atom(Object):
    def __init__(self, value: Any, obj_type: Type):
        super().__init__(obj_type)
        self._value = value

    @staticmethod
    def null() -> "Atom":
        return Atom(None, Type.of("null"))

    @staticmethod
    def string(value: str) -> "Atom":
        return Atom(value, Type.of("string"))

    @property
    def value(self) -> Any:
        return self._value


class Struct(Object):
    def __init__(self, struct_type: StructType, fields: dict[str, Object] = None):
        super().__init__(struct_type)
        self._fields = fields or {}

    @property
    def type(self) -> StructType:
        return self._type

    def __getitem__(self, item: str) -> Object:


        return self._fields.get(item, Object.null())

    def __setitem__(self, key: str, value: Object):
        expected_type = self.type.schema.get(key)
        actual_type = value.type

        if actual_type == expected_type:
            self._fields[key] = value
            return

        if actual_type.tag == TypeTag.NULL:
            self._fields[key] = value
            return

        if isinstance(expected_type, StructType) and isinstance(actual_type, StructType):
            valid_subtypes = SUBTYPE_REGISTRY.get(expected_type.name, set())
            if actual_type.name in valid_subtypes:
                self._fields[key] = value
                return

        raise TypeError(
            f"Type mismatch on field '{key}'. "
            f"Expected '{expected_type}', got '{actual_type}'."
        )

StructType.new = lambda self, fields: Struct(self, fields)


class ListObject(Object):
    def __init__(self, item_type: Type, items: Optional[list[Object]] = None):
        super().__init__(ListType(item_type))
        self._items = items or []

    @property
    def items(self) -> list[Object]:
        return self._items

    @property
    def item_type(self) -> Type:
        return self._type.item_type


class RefObject(Object):
    def __init__(self, target_type: StructType, ref_id: str, ctx: "EngineContext"):
        super().__init__(RefType(target_type))
        valid_ids = ctx.registered_ids.get(target_type.name, set())
        if ref_id and ref_id not in valid_ids:
            raise ValueError(
                f"Construction Error: '{ref_id}' is not a valid '{target_type}' reference."
            )

        self._target_type = target_type
        self._ref_id = ref_id
        self._ctx = ctx

    @property
    def ref_id(self) -> str:
        return self._ref_id

    def resolve(self) -> Struct:
        obj = self._ctx.get_object(self._target_type.name, self._ref_id)
        if not obj:
            raise RuntimeError(f"Resolution Error: '{self._ref_id}' was registered but never stored in the context!")
        return obj
