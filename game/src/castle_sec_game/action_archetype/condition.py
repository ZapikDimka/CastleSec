import abc
from dataclasses import dataclass

from castle_sec_game.inventory import InventoryItem


class Condition(abc.ABC):
    pass

@dataclass
class HasItemCondition(Condition):
    _item: InventoryItem

    def __init__(self, item: InventoryItem):
        self._item = item

    @property
    def item(self) -> InventoryItem:
        return self._item
