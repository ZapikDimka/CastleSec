from typing import Any

from pydantic import ValidationError

from castle_sec_game.game.asset_loader import AssetLoader
from castle_sec_game.game.types import *
from castle_sec_game.game.context import Context
from castle_sec_game.task.task import TaskRunner


class Game:
    def __init__(self, raw_json: dict, images_dir: str, tasks_dir: str):
        self.ctx = Context()
        loader = AssetLoader(self.ctx)
        loader.load_all(images_dir=images_dir, tasks_dir=tasks_dir)

        self.game_data = GameData.model_validate(raw_json)
        self._register_objects_to_context()
        self._resolve_all_references(self.game_data)
        starting_node = self.game_data.root.resolve(self.ctx).root
        self.state = GameState(
            current_map=self.game_data.root,
            current_node=starting_node,
            inventory=Inventory(items=[]),
            visited_nodes=[starting_node.ref_id]
        )

        self._task: Optional[TaskRunner] = None
        self._task_callbacks: dict[str, list[BaseFunction]] = {"success": [], "failure": []}
        self._step()

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
        return self._actions

    @property
    def inventory(self) -> Inventory:
        return self.state.inventory

    @property
    def is_solving_task(self) -> bool:
        return self._task is not None

    @property
    def task_url(self) -> str | None:
        if self._task is None:
            return None
        return self._task.get_url()

    def act(self, action_index: Optional[int] = None) -> Any:
        if action_index is None:
            self._step()
            return

        if self.is_solving_task:
            return

        self.state.message = None
        node = self.current_node
        action = self._actions[action_index]

        for function in action.functions:
            self._run_function(function)

        if action.once:
            node.actions.remove(action)

        self._step()

    def _step(self):
        self._build_actions()

    def _build_actions(self) -> list[Action]:
        self._actions = []
        if self._task is not None:
            res = self._task.get_result()
            if res is None:
                return self._actions

            funcs_to_run = (
                self._task_callbacks.get("success", [])
                if res.is_success()
                else self._task_callbacks.get("failure", [])
            )

            self._task = None
            self._task_callbacks = {}

            for func in funcs_to_run:
                self._run_function(func)

        src = self.current_node.actions
        for action in src:
            if self._evaluate_action_conditions(action):
                self._actions.append(action)

        return self._actions

    def _check_condition(self, condition) -> bool:
        inventory_ids = {ref.ref_id for ref in self.state.inventory.items}
        match condition.type:
            case "HasItemCondition":
                return condition.item.ref_id in inventory_ids
        return True

    def _evaluate_action_conditions(self, action: Action) -> bool:
        return all(self._check_condition(c) for c in action.conditions)

    def _run_function(self, function: BaseFunction):
        match function.type:
            case "MoveFunction":
                self.state.current_node = function.to
                if function.to.ref_id not in self.state.visited_nodes:
                    self.state.visited_nodes.append(function.to.ref_id)

            case "SetTextFunction":
                target_node = function.target_node.resolve(self.ctx) if function.target_node else self.current_node
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

            case "SetImageFunction":
                target_node = function.target_node.resolve(self.ctx) if function.target_node else self.current_node
                setattr(target_node, "image", function.value)

            case "PickUpItemFunction":
                self.state.inventory.items.append(function.item)

            case "SolveTaskFunction":
                self._task = TaskRunner(name=function.task.root)
                self._task_callbacks = {
                    "success": function.on_success,
                    "failure": function.on_failure
                }

                self._task.run()

            case "ShowMessageFunction":
                self.state.message = function.message

            case "ConditionalFunction":
                if self._check_condition(function.condition):
                    for f in function.on_success:
                        self._run_function(f)
                else:
                    for f in function.on_failure:
                        self._run_function(f)
