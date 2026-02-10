from castle_sec_game.action_archetype import ActionArchetype


# TODO: Add states
class MapNode:
    _name: str
    _text: str
    _actions: list[ActionArchetype]

    def __init__(self, name: str, text: str, actions: list[ActionArchetype]):
        self._name = name
        self._text = text
        self._actions = actions

    @property
    def name(self) -> str:
        return self._name

    @property
    def text(self) -> str:
        return self._text

    @property
    def actions(self) -> list[ActionArchetype]:
        return self._actions
