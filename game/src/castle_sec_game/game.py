from castle_sec_game.action import Action
from castle_sec_game.action_archetypes import ReturnActionArchetype, MoveActionArchetype
from castle_sec_game.actions import MoveAction
from castle_sec_game.map_node import MapNode


class Game:
    _prev_node: MapNode | None = None
    _current_node: MapNode
    _actions: list[Action]

    def __init__(self, root_node: MapNode):
        self._current_node = root_node
        self._actions = []
        self._build_actions()

    @property
    def current_node(self):
        return self._current_node

    @property
    def actions(self) -> list[Action]:
        return self._actions

    def act(self, action: Action):
        if action not in self.actions:
            raise ValueError("Invalid action")

        match action:
            case MoveAction():
                self._move(action.map_node)
            case _:
                raise NotImplementedError("Unhandled action")

    def _build_actions(self):
        src = self.current_node.actions
        self._actions = []

        for action in src:
            match action:
                case MoveActionArchetype():
                    self._actions.append(MoveAction(action.map_node))
                case ReturnActionArchetype():
                    if isinstance(action, ReturnActionArchetype):
                        if self._prev_node is None:
                            continue

                    self._actions.append(MoveAction(self._prev_node, text=f"Return to {self._prev_node.name}"))
                case _:
                    raise NotImplementedError("Unhandled action archetype")

        return self._actions

    def _move(self, node: MapNode):
        self._prev_node = self._current_node
        self._current_node = node
        self._build_actions()
