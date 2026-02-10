from castle_sec_game.inventory_item import InventoryItem


class Inventory:
    _items: list[InventoryItem]
    
    def __init__(self):
        self._items = []

    def add(self, item: InventoryItem):
        self._items.append(item)

    def remove(self, item: InventoryItem):
        self._items.remove(item)

    def __contains__(self, item: InventoryItem):
        return item in self._items

    def __iter__(self):
        return iter(self._items)

    def __len__(self):
        return len(self._items)
