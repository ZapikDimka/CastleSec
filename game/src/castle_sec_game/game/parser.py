from dataclasses import dataclass

from castle_sec_game.game.schemas import ACTION_SCHEMAS
from castle_sec_game.game.types import *
from castle_sec_game.game.objects import *


@dataclass
class ValidationContext:
    valid_nodes: set[str]
    valid_images: set[str]
    valid_tasks: set[str]


def load_from_json(data: Any, expected_type: Type | Schema, ctx: ValidationContext) -> Object:
    """Recursively parses JSON and strictly validates foreign key references."""

    # 1. Parse References (Foreign Keys)
    if isinstance(expected_type, RefType):
        val = str(data) if data is not None else ""

        # Cross-reference the parsed string with our known context
        if expected_type.target_type == "node" and val not in ctx.valid_nodes:
            raise ValueError(f"Load Error: Reference to unknown node '{val}'")

        if expected_type.target_type == "image" and val and val not in ctx.valid_images:
            raise ValueError(f"Load Error: Reference to unknown image '{val}'")

        if expected_type.target_type == "task" and val not in ctx.valid_tasks:
            raise ValueError(f"Load Error: Reference to unknown task '{val}'")

        # Return as a standard Atom string for the engine
        return Atom(val)

    # 2. Parse Primitives
    if isinstance(expected_type, Type) and expected_type.tag == TypeTag.STRING:
        return Atom(str(data) if data is not None else "")

    # 3. Parse Lists
    if isinstance(expected_type, ListType):
        items = []
        for raw_item in (data or []):
            if expected_type.item_type.tag == TypeTag.ACTION:
                action_type = raw_item.get("type")
                schema = ACTION_SCHEMAS.get(action_type)
                if not schema:
                    raise ValueError(f"Unknown action type in JSON: {action_type}")
                items.append(load_from_json(raw_item, schema, ctx))
            else:
                items.append(load_from_json(raw_item, expected_type.item_type, ctx))
        return ListObject(expected_type.item_type, items)

    # 4. Parse Composites
    if isinstance(expected_type, Schema):
        variables_dict = {}
        for key, field_type in expected_type.schema.items():
            raw_value = data.get(key)
            variables_dict[key] = load_from_json(raw_value, field_type, ctx)
        return Composite(expected_type, variables_dict)

    raise TypeError(f"Expected {expected_type.__name__}, got {type(data).__name__}")
