from dataclasses import dataclass


@dataclass
class InventoryItem:
    _name: str
    _image: str

    def __init__(self, name: str, image: str):
        self._name = name
        self._image = image

    @property
    def name(self):
        return self._name

    @property
    def image(self):
        return self._image
