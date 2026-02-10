from castle_sec_game.action import Action
from castle_sec_game.action_archetypes import ReturnActionArchetype, MoveActionArchetype, SolveTaskActionArchetype, \
    PickUpItemActionArchetype
from castle_sec_game.actions import MoveAction, SolveTaskAction, PickUpItemAction
from castle_sec_game.inventory import Inventory
from castle_sec_game.map_node import MapNode


class Game:
    _prev_node: MapNode | None = None
    _current_node: MapNode
    _actions: list[Action]
    _is_solving_task: bool = False
    _inventory: Inventory

    def __init__(self, root_node: MapNode):
        self._current_node = root_node
        self._actions = []
        self._inventory = Inventory()
        self._build_actions()

    @property
    def current_node(self):
        return self._current_node

    @property
    def actions(self) -> list[Action]:
        return self._actions

    @property
    def is_solving_task(self) -> bool:
        return self._is_solving_task

    @property
    def inventory(self) -> Inventory:
        return self._inventory

    def dev_solve_task(self, is_success: bool):
        self._is_solving_task = False
        # TODO

    def act(self, action: Action):
        if action not in self.actions:
            raise ValueError("Invalid action")

        match action:
            case MoveAction():
                self._move(action.map_node)
                self._step()
            case SolveTaskAction():
                self._is_solving_task = True
            case PickUpItemAction():
                self._inventory.add(action.item)
                self._current_node.actions.remove(action.archetype)
                self._step()
            case _:
                raise NotImplementedError("Unhandled action")

    def _build_actions(self):
        self._actions = []
        if self._is_solving_task:
            pass

        src = self.current_node.actions

        for action in src:
            match action:
                case MoveActionArchetype():
                    self._actions.append(MoveAction(action, action.map_node))
                case ReturnActionArchetype():
                    if isinstance(action, ReturnActionArchetype):
                        if self._prev_node is None:
                            continue

                    self._actions.append(MoveAction(action, self._prev_node, text=f"Return to '{self._prev_node.name}'"))
                case SolveTaskActionArchetype():
                    self._actions.append(SolveTaskAction(action))
                case PickUpItemActionArchetype():
                    self._actions.append(PickUpItemAction(action, action.item))
                case _:
                    raise NotImplementedError("Unhandled action archetype")

        return self._actions

    def _move(self, node: MapNode):
        self._prev_node = self._current_node
        self._current_node = node
        self._step()

    def _step(self):
        self._build_actions()
