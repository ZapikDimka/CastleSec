from typing import Any

from pydantic import ValidationError

from castle_sec_game.game.asset_loader import AssetLoader
from castle_sec_game.game.types import *
from castle_sec_game.game.context import Context


class Game:
    def __init__(self, raw_json: dict, images_dir: str, tasks_dir: str):
        self.ctx = Context()
        loader = AssetLoader(self.ctx)
        loader.load_all(images_dir=images_dir, tasks_dir=tasks_dir)

        self.game_data = GameData.model_validate(raw_json)
        self._register_objects_to_context()
        self._resolve_all_references(self.game_data)
        self.state = GameState(
            current_map=self.game_data.root,
            current_node=self.game_data.root.resolve(self.ctx).root,
            inventory=Inventory(items=[])
        )

    def _register_objects_to_context(self):
        for item in self.game_data.items:
            self.ctx.register_object(item.id, item)

        for game_map in self.game_data.maps:
            self.ctx.register_object(game_map.id, game_map)
            for node in game_map.nodes:
                self.ctx.register_object(node.id, node)

    def _resolve_all_references(self, obj: Any):
        match obj:
            case Ref():
                obj.resolve(self.ctx)
            case BaseModel():
                for _, val in obj:
                    self._resolve_all_references(val)
            case list():
                for item in obj:
                    self._resolve_all_references(item)
            case dict():
                for val in obj.values():
                    self._resolve_all_references(val)

    @property
    def current_node(self) -> Node:
        return self.state.current_node.resolve(self.ctx)

    @property
    def actions(self) -> list:
        return self.current_node.actions

    @property
    def inventory(self) -> Inventory:
        return self.state.inventory

    @property
    def is_solving_task(self) -> bool:
        return False

    def act(self, action_index: int):
        node = self.current_node
        action = node.actions[action_index]

        for function in action.functions:
            self._run_function(function)

        if action.once:
            node.actions.pop(action_index)

    def _run_function(self, function: BaseFunction):
        match function.type:
            case "MoveFunction":
                self.state.current_node = function.to

            case "SetVariableFunction":
                target_node = function.target_node.resolve(self.ctx)
                var_name = function.variable

                if hasattr(target_node, var_name):
                    try:
                        setattr(target_node, var_name, function.value)
                    except ValidationError as e:
                        raise TypeError(
                            f"Script Error: Cannot assign value to '{var_name}' on {type(target_node).__name__}. "
                            f"Type mismatch.\nDetails: {e}"
                        )
                else:
                    raise ValueError(
                        f"Runtime Error: Field '{var_name}' does not exist on {type(target_node).__name__}"
                    )

            case "PickUpItemFunction":
                self.state.inventory.items.append(function.item)
