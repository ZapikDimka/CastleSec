from pathlib import Path
from typing import Union

from castle_sec_game.game.ctx import EngineContext
from castle_sec_game.game.schemas import ASSET, TASK
from castle_sec_game.game.objects import Atom


class AssetLoader:
    def __init__(self, ctx: EngineContext):
        self._ctx = ctx

    def load_images_from_dir(self, images_dir: Union[str, Path]):
        """Scans a directory for files and registers them as ASSETs."""
        path = Path(images_dir)

        if not path.exists() or not path.is_dir():
            print(f"Warning: Image directory '{images_dir}' not found.")
            return

        # Iterate through all items in the directory
        for item in path.iterdir():
            if item.is_file():
                # We use the filename (e.g., 'cell.png') as the ID for JSON references
                asset_id = item.name

                self._ctx.register_id(ASSET, asset_id)
                # We store the full relative path so the UI knows exactly where to find it
                asset_struct = ASSET.new({"path": Atom.string(str(item))})
                self._ctx.store_object(ASSET, asset_id, asset_struct)

    def load_tasks_from_dir(self, tasks_dir: Union[str, Path]):
        """Scans a directory for subdirectories and registers them as TASKs."""
        path = Path(tasks_dir)

        if not path.exists() or not path.is_dir():
            print(f"Warning: Task directory '{tasks_dir}' not found.")
            return

        # Iterate through all items in the directory
        for item in path.iterdir():
            if item.is_dir():
                # We use the folder name (e.g., 'find_key') as the task ID
                task_id = item.name

                self._ctx.register_id(TASK, task_id)
                task_struct = TASK.new({"path": Atom.string(str(item))})
                self._ctx.store_object(TASK, task_id, task_struct)

    def load_all(self, images_dir: Union[str, Path], tasks_dir: Union[str, Path]):
        """Convenience method to scan and load everything."""
        self.load_images_from_dir(images_dir)
        self.load_tasks_from_dir(tasks_dir)
