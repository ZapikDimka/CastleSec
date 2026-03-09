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

        # 1. Parse data (Forward references are just string IDs at this stage)
        self.game_data = GameData.model_validate(raw_json)

        # 2. Register all parsed objects into the context
        self._register_objects_to_context()

        # 3. Resolve all forward references upfront
        self._resolve_all_references(self.game_data)

        # 4. Initialize the state safely
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
        """Recursively walks the game data to link and cache all references."""
        if isinstance(obj, Ref):
            # Calling resolve here caches the target and validates the ID
            obj.resolve(self.ctx)

        elif isinstance(obj, BaseModel):
            for _, val in obj:
                self._resolve_all_references(val)

        elif isinstance(obj, list):
            for item in obj:
                self._resolve_all_references(item)

        elif isinstance(obj, dict):
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