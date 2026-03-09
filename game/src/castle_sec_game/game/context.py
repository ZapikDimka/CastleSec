from typing import Any, Optional, Type


class Context:
    def __init__(self):
        self._registry: dict[str, Any] = {}

    def register_object(self, obj_id: str, obj: Any) -> None:
        if not obj_id:
            raise ValueError("Registration Error: Cannot register an object without a valid ID.")
        if obj_id in self._registry:
            raise ValueError(f"Registration Error: Object with ID '{obj_id}' already exists.")

        self._registry[obj_id] = obj

    def get_object[T](self, obj_id: str, expected_type: Optional[Type[T]] = None) -> T:
        obj = self._registry.get(obj_id)

        if obj is None:
            raise RuntimeError(f"Resolution Error: Object with ID '{obj_id}' not found in context.")
        if expected_type is not None and not isinstance(obj, expected_type):
            raise TypeError(
                f"Resolution Error: Expected ID '{obj_id}' to point to a '{expected_type.__name__}', "
                f"but found a '{type(obj).__name__}' instead."
            )

        return obj

    def has_object(self, obj_id: str) -> bool:
        return obj_id in self._registry

    def clear(self) -> None:
        self._registry.clear()