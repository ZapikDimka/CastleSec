from castle_sec_game.game.asset_loader import AssetLoader
from castle_sec_game.game.parser import load_from_json
from castle_sec_game.game.objects import *
from castle_sec_game.game.schemas import *
from castle_sec_game.game.ctx import EngineContext


class Game:
    def __init__(self, raw_json: dict, images_dir: str, tasks_dir: str):
        ctx = EngineContext()

        # 1. Let the loader crawl the file system and register everything
        loader = AssetLoader(ctx)
        loader.load_all(images_dir=images_dir, tasks_dir=tasks_dir)

        # 2. Parse the game map.
        # If the JSON references "cell.png", it will successfully validate
        # because the loader just found it and registered it!
        self._game_data = load_from_json(raw_json, GAME_DATA, ctx)

        # 3. Initialize State
        self._state = GAME_STATE.new({
            "current_map": self._game_data.as_struct()["root"],
        })
        self._state["current_node"] = self._state["current_map"].as_ref_v()["root"]
        self._state["inventory"] = INVENTORY.new({
            "items": ListObject(ITEM, [
                ITEM.new({
                    "name": Atom.string("Test"),
                    "image": Atom.string("TEST")
                })
            ])
        })

    def get_current_node(self) -> Struct:
        return self._state["current_node"].as_ref().resolve()

    @property
    def inventory(self) -> list:
        return [item["name"].as_str() for item in self._state["inventory"].as_struct(INVENTORY)["items"].as_list_v(ITEM)]

    @property
    def is_solving_task(self) -> bool:
        return False # TODO

    def act(self, action_index: int):
        node = self.get_current_node()
        actions = node["actions"].as_list().items

        action = actions[action_index].as_struct(ACTION)
        match action.type.name:
            case MOVE_ACTION.name:
                self._state["current_node"] = action["to"]
            case SET_VARIABLE_ACTION.name:
                target = action["target_node"].as_ref_v()
                var_name = action["variable_name"].as_str()
                target[var_name] = action["value"] # TODO
