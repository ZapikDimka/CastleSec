from castle_sec_game.game.types import *

# TODO: One actions contains multiple.. smth

return_action_schema = Schema("ReturnAction", {})

move_action_schema = Schema("MoveAction", {
    "label": Type.of("string"),
    "to": RefType(Type.of("node"))
})

pick_up_item_action_schema = Schema("PickUpItemAction", {
    "item": RefType(Type.of("item"))
})

set_variable_action_schema = Schema("SetVariableAction", {
    "label": Type.of("string"),
    "target_node_id": Type.of("string"),
    "variable_name": Type.of("string"),
    "new_value": Type.of("string")
})

item_schema = Schema("Item", {
    "name": Type.of("string"),
    "image": RefType(Type.of("image"))
})

inventory_schema = Schema("Inventory", {
    "items": ListType(Type.of("item")),
})

node_schema = Schema("Node", {
    "id": Type.of("string"),
    "name": Type.of("string"),
    "text": Type.of("string"),
    "image": RefType(Type.of("image")),
    "actions": ListType(Type.of("action")),
})

map_schema = Schema("Map", {
    "id": Type.of("string"),
    "items": ListType(Type.of("item")),
    "root": RefType(Type.of("node")),
    "nodes": ListType(Type.of("node"))
})

game_data_schema = Schema("GameData", {
    "items": ListType(Type.of("item")),
    "root": RefType(Type.of("map")),
    "maps": ListType(Type.of("map"))
})

ACTION_SCHEMAS = {
    "MoveAction": move_action_schema,
    "SetVariableAction": set_variable_action_schema,
}
