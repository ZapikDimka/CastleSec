from pathlib import Path
from typing import Union

from castle_sec_game.game.ctx import EngineContext
from castle_sec_game.game.schemas import ASSET, TASK
from castle_sec_game.game.objects import Atom


class AssetLoader:
    def __init__(self, ctx: EngineContext):
        self._ctx = ctx

    def load_images_from_dir(self, images_dir: Union[str, Path]):
        path = Path(images_dir)

        if not path.exists() or not path.is_dir():
            print(f"Warning: Image directory '{images_dir}' not found.")
            return

        for item in path.iterdir():
            if item.is_file():
                asset_id = item.name

                self._ctx.register_id(ASSET, asset_id)
                asset_struct = ASSET.new({"path": Atom.string(str(item))})
                self._ctx.store_object(ASSET, asset_id, asset_struct)

    def load_tasks_from_dir(self, tasks_dir: Union[str, Path]):
        path = Path(tasks_dir)

        if not path.exists() or not path.is_dir():
            print(f"Warning: Task directory '{tasks_dir}' not found.")
            return

        for item in path.iterdir():
            if item.is_dir():
                task_id = item.name

                self._ctx.register_id(TASK, task_id)
                task_struct = TASK.new({"path": Atom.string(str(item))})
                self._ctx.store_object(TASK, task_id, task_struct)

    def load_all(self, images_dir: Union[str, Path], tasks_dir: Union[str, Path]):
        self.load_images_from_dir(images_dir)
        self.load_tasks_from_dir(tasks_dir)
