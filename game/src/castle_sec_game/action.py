import abc


class Action(abc.ABC):
    _text: str

    def __init__(self, text: str):
        self._text = text

    @property
    def text(self):
        return self._text
