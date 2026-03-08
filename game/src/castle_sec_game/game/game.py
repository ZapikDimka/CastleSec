from castle_sec_game.game.asset_loader import AssetLoader
from castle_sec_game.game.parser import load_from_json
from castle_sec_game.game.objects import *
from castle_sec_game.game.schemas import *
from castle_sec_game.game.ctx import EngineContext


class Game:
    def __init__(self, raw_json: dict, images_dir: str, tasks_dir: str):
        ctx = EngineContext()
        loader = AssetLoader(ctx)
        loader.load_all(images_dir=images_dir, tasks_dir=tasks_dir)

        self._game_data = load_from_json(raw_json, GAME_DATA, ctx)

        self._state = GAME_STATE.new({
            "current_map": self._game_data.as_struct()["root"],
        })
        self._state["current_node"] = self._state["current_map"].as_ref_v()["root"]
        self._state["inventory"] = INVENTORY.new({
            "items": ListObject(RefType(ITEM), [])
        })

    def get_current_node(self) -> Struct:
        return self._state["current_node"].as_ref().resolve()

    def get_actions(self) -> list:
        return self._state["current_node"].as_ref_v(NODE)["actions"].as_list_v(ACTION)

    @property
    def inventory(self) -> list:
        return [item.resolve()["name"].as_str() for item in self._state["inventory"].as_struct(INVENTORY)["items"].as_list_v(RefType(ITEM))]

    @property
    def is_solving_task(self) -> bool:
        return False # TODO

    def act(self, action_index: int):
        node = self.get_current_node()
        actions = node["actions"].as_list().items

        action = actions[action_index].as_struct(ACTION)
        functions = action["functions"].as_list_v(FUNCTION)
        for function in functions:
            self._run_function(function)

    def _run_function(self, function: Struct):
        match function.type.name:
            case MOVE_FUNCTION.name:
                self._state["current_node"] = function["to"]
            case SET_VARIABLE_FUNCTION.name:
                target = function["target_node"].as_ref_v()
                var_name = function["variable_name"].as_str()
                target[var_name] = function["value"]
