from castle_sec_game.game.parser import ValidationContext, load_from_json
from castle_sec_game.game.objects import *
from castle_sec_game.game.schemas import *


class Game:
    def __init__(self, raw_json_map: dict, available_images: set[str], available_tasks: set[str]):
        valid_nodes = {node["id"] for node in raw_json_map.get("nodes", [])}
        ctx = ValidationContext(valid_nodes, available_images, available_tasks)

        self.map_nodes = {}
        for node_data in raw_json_map.get("nodes", []):
            engine_node = load_from_json(node_data, node_schema, ctx)
            self.map_nodes[engine_node["id"].as_str()] = engine_node

        starting_node_id = raw_json_map.get("starting_node")

        self._variables = Variables({
            "current_node_id": Atom(starting_node_id),
            "inventory": inventory_schema.instance({
                "items": ListObject(Type.of("item"), [item_schema.instance({
                    "name": Atom("Test"),
                    "image": Atom("TEST")
                })])
            })
        })

    def get_current_node(self) -> Composite:
        return self.map_nodes[self._variables["current_node_id"].as_str()]

    @property
    def inventory(self) -> list:
        # Unpacks atoms to standard strings for the UI to read easily
        return [item.as_composite()["name"].as_str() for item in self._variables["inventory"].as_composite(inventory_schema)["items"].as_list().items]

    @property
    def is_solving_task(self) -> bool:
        return False  # Mocked for UI compatibility

    def act(self, action_index: int):
        node = self.get_current_node()
        actions = node["actions"].as_list().items

        action = actions[action_index].as_composite()

        match action.schema.name:
            case move_action_schema.name:
                self._variables["current_node_id"] = Atom(action["to"].as_str())
            case set_variable_action_schema.name:
                target_id = action["target_node_id"].as_str()
                var_name = action["variable_name"].as_str()
                self.map_nodes[target_id][var_name] = Atom(action["new_value"].as_str())

