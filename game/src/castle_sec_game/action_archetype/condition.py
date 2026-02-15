import abc

from castle_sec_game.inventory import InventoryItem


class Condition(abc.ABC):
    pass

class HasItemCondition(Condition):
    _item: InventoryItem

    def __init__(self, item: InventoryItem):
        self._item = item

    @property
    def item(self) -> InventoryItem:
        return self._item
