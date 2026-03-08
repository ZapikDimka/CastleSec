from castle_sec_game.game.objects import Struct
from castle_sec_game.game.types import StructType


class EngineContext:
    def __init__(self):
        self.registered_ids: dict[str, set[str]] = {}
        self.objects: dict[str, dict[str, Struct]] = {}

    def register_id(self, target_type: StructType, obj_id: str):
        if target_type.name not in self.registered_ids:
            self.registered_ids[target_type.name] = set()
        self.registered_ids[target_type.name].add(obj_id)
        print("Registered id:", obj_id, "of type", target_type.name)

    def store_object(self, target_type: StructType, obj_id: str, obj: Struct):
        if target_type.name not in self.objects:
            self.objects[target_type.name] = {}
        self.objects[target_type.name][obj_id] = obj

    def get_object(self, target_type: str, obj_id: str) -> Struct | None:
        return self.objects.get(target_type, {}).get(obj_id)
