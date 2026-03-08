from typing import Any

from castle_sec_game.game.types import Type, RefType, ListType, StructType, TypeTag
from castle_sec_game.game.objects import Object, Atom, RefObject, ListObject, Struct
from castle_sec_game.game.schemas import STRUCT_REGISTRY, SUBTYPE_REGISTRY
from castle_sec_game.game.ctx import EngineContext


def load_from_json(data: Any, expected_type: Type, ctx: EngineContext) -> Object:
    _scan_for_ids(data, expected_type, ctx)

    return _build_objects(data, expected_type, ctx)


def _scan_for_ids(data: Any, expected_type: Type, ctx: EngineContext):
    if data is None:
        return

    if isinstance(expected_type, ListType):
        if isinstance(data, list):
            for item in data:
                _scan_for_ids(item, expected_type.item_type, ctx)

    elif isinstance(expected_type, StructType):
        if isinstance(data, dict):
            actual_type = expected_type

            # Resolve polymorphism
            if "type" in data:
                actual_type = STRUCT_REGISTRY.get(data["type"], expected_type)

            # Identify the object. Since Assets/Tasks are pre-loaded by you,
            # this mostly registers your Nodes, Maps, and Items.
            obj_id = data.get("id") or data.get("name")
            if isinstance(obj_id, str):
                curr_type = actual_type
                while curr_type:
                    ctx.register_id(curr_type, obj_id)
                    curr_type = curr_type.base

            for key, field_type in actual_type.schema.items():
                if key == "type": continue
                _scan_for_ids(data.get(key), field_type, ctx)


def _build_objects(data: Any, expected_type: Type, ctx: EngineContext) -> Object:
    if expected_type.tag == TypeTag.STRING:
        val = str(data) if data is not None else ""
        return Atom(val, expected_type)
    elif expected_type.tag == TypeTag.BOOL:
        val = bool(data)
        return Atom(val, expected_type)

    match expected_type:
        case RefType():
            val = str(data) if data is not None else ""
            return RefObject(expected_type.target_type, val, ctx)
        case ListType():
            if data is None: data = []
            if not isinstance(data, list):
                raise TypeError(f"Expected list for {expected_type.item_type.tag}, got {type(data).__name__}")

            items = [_build_objects(raw_item, expected_type.item_type, ctx) for raw_item in data]
            return ListObject(expected_type.item_type, items)
        case StructType():
            if data is None: data = {}
            if not isinstance(data, dict):
                raise TypeError(f"Expected dict for '{expected_type.name}', got {type(data).__name__}")

            actual_type = expected_type

            # Polymorphism Resolution and Validation
            if "type" in data:
                actual_type_name = data["type"]
                if actual_type_name != expected_type.name:
                    valid_subtypes = SUBTYPE_REGISTRY.get(expected_type.name, set())
                    if actual_type_name not in valid_subtypes:
                        raise TypeError(
                            f"Load Error: '{actual_type_name}' is not a valid subtype of '{expected_type.name}'.")

                    actual_type = STRUCT_REGISTRY.get(actual_type_name)
                    if not actual_type:
                        raise ValueError(f"Load Error: StructType '{actual_type_name}' not found.")

            # Build all children
            fields = {}
            for key, field_type in actual_type.schema.items():
                if key == "type": continue
                fields[key] = _build_objects(data.get(key), field_type, ctx)

            struct_obj = Struct(actual_type, fields)

            # Store in Context so RefObject.resolve() works globally
            obj_id = data.get("id") or data.get("name")
            if isinstance(obj_id, str):
                curr_type = actual_type
                while curr_type:
                    ctx.store_object(curr_type, obj_id, struct_obj)
                    curr_type = curr_type.base

            return struct_obj
        case _:
            raise TypeError(f"Unknown Type encountered: '{expected_type}'")
