import abc

from castle_sec_game.action_archetype import ActionArchetype


class Action(abc.ABC):
    _archetype: ActionArchetype
    _text: str

    def __init__(self, archetype: ActionArchetype, text: str):
        self._archetype = archetype
        self._text = text

    @property
    def archetype(self) -> ActionArchetype:
        return self._archetype

    @property
    def text(self):
        return self._text
