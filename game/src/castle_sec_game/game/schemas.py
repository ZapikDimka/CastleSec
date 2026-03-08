from collections import defaultdict

from castle_sec_game.game.types import *


STRUCT_REGISTRY: dict[str, StructType] = {}
SUBTYPE_REGISTRY: dict[str, set[str]] = defaultdict(set)

def def_struct(name: str, schema: dict[str, Type], base: Optional[StructType] = None) -> StructType:
    struct_type = StructType(name, schema, base)
    STRUCT_REGISTRY[struct_type.name] = struct_type
    if base:
        SUBTYPE_REGISTRY[base.name].add(struct_type.name)

    return struct_type

###

ASSET = def_struct("Asset", {
    "path": Type.of("string")
})

TASK = def_struct("Task", {
    "path": Type.of("string")
})

FUNCTION = def_struct("Function", {})

ACTION = def_struct("Action", {
    "label": Type.of("string"),
    "functions": ListType(FUNCTION)
})

ITEM = def_struct("Item", {
    "name": Type.of("string"),
    "image": RefType(ASSET)
})

INVENTORY = def_struct("Inventory", {
    "items": ListType(RefType(ITEM)),
})

NODE = def_struct("Node", {
    "id": Type.of("string"),
    "name": Type.of("string"),
    "text": Type.of("string"),
    "image": RefType(ASSET),
    "actions": ListType(ACTION)
})

MAP = def_struct("Map", {
    "id": Type.of("string"),
    "items": ListType(ITEM),
    "root": RefType(NODE),
    "nodes": ListType(NODE)
})

GAME_DATA = def_struct("GameData", {
    "items": ListType(ITEM),
    "root": RefType(MAP),
    "maps": ListType(MAP)
})

GAME_STATE = def_struct("GameState", {
    "current_map": RefType(MAP),
    "current_node": RefType(NODE),
    "inventory": INVENTORY
})

###

RETURN_FUNCTION = def_struct("ReturnFunction", {}, base=FUNCTION)

MOVE_FUNCTION = def_struct("MoveFunction", {
    "label": Type.of("string"),
    "to": RefType(NODE)
}, base=FUNCTION)

PICK_UP_ITEM_FUNCTION = def_struct("PickUpItemFunction", {
    "item": RefType(ITEM)
}, base=FUNCTION)

SET_VARIABLE_FUNCTION = def_struct("SetVariableFunction", {
    "label": Type.of("string"),
    "target_node": RefType(NODE),
    "variable_name": Type.of("string"),
    "value": Type.of("string")
}, base=FUNCTION)

