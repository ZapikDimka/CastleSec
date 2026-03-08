from pathlib import Path
from typing import Union

from castle_sec_game.game.context import Context
from castle_sec_game.game.types import Asset, Task


class AssetLoader:
    def __init__(self, ctx: Context):
        self.ctx = ctx

    def load_images_from_dir(self, images_dir: Union[str, Path]) -> None:
        path = Path(images_dir)

        if not path.exists() or not path.is_dir():
            print(f"Warning: Image directory '{images_dir}' not found.")
            return

        for item in path.iterdir():
            if item.is_file():
                asset_id = item.name

                # Directly instantiate the Pydantic model
                asset = Asset(path=str(item))

                # Register the model in the unified engine context
                self.ctx.register_object(asset_id, asset)

    def load_tasks_from_dir(self, tasks_dir: Union[str, Path]) -> None:
        path = Path(tasks_dir)

        if not path.exists() or not path.is_dir():
            print(f"Warning: Task directory '{tasks_dir}' not found.")
            return

        for item in path.iterdir():
            if item.is_dir():
                task_id = item.name

                # Directly instantiate the Pydantic model
                task = Task(path=str(item))

                # Register the model in the unified engine context
                self.ctx.register_object(task_id, task)

    def load_all(self, images_dir: Union[str, Path], tasks_dir: Union[str, Path]) -> None:
        self.load_images_from_dir(images_dir)
        self.load_tasks_from_dir(tasks_dir)
