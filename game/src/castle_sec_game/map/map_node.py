from castle_sec_game.action_archetype import ActionArchetype


# TODO: Add states
class MapNode:
    _name: str
    _text: str
    _image: str
    _actions: list[ActionArchetype]

    def __init__(self, name: str, text: str, image: str, actions: list[ActionArchetype]):
        self._name = name
        self._text = text
        self._image = image
        self._actions = actions

    def __str__(self):
        return f"MapNode('{self._name}')"

    @property
    def name(self) -> str:
        return self._name

    @property
    def text(self) -> str:
        return self._text

    @property
    def image(self) -> str:
        return self._image

    @property
    def actions(self) -> list[ActionArchetype]:
        return self._actions
