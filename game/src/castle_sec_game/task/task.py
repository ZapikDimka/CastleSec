import asyncio
import logging
import uuid
from enum import Enum


logger = logging.getLogger("game")

class TaskResult(Enum):
    SUCCESS = 0
    FAILURE = 1
    TIMEOUT = 2
    TERMINATED = 3
    ERROR = 4

    def is_success(self):
        return self == TaskResult.SUCCESS

class TaskRunner:
    _name: str
    _id: uuid.UUID
    _timeout: float
    _process: asyncio.subprocess.Process | None = None
    _task: asyncio.Task[TaskResult] | None = None

    def __init__(self, name, timeout=15*60):
        self._name = name
        self._id = uuid.uuid4()
        self._timeout = timeout

    def __str__(self):
        return f"{self._name}__{self._id}"

    def get_result(self):
        if self._task.done():
            return self._task.result()

        return None

    def run(self):
        self._task = asyncio.create_task(self._run_impl())

    async def _run_impl(self) -> TaskResult:
        '''
        cmd = [
            "docker", "compose",
            "-p", f"{self._name}__{self._id}",
            "--project-directory", f"../tasks/{self._name}",
            "up", "--abort-on-container-exit",
            "--exit-code-from", self._name
        ]
        '''
        # --service-ports

        # TODO: Un-hardcode tasks folder
        cmd = [
            "docker", "compose",
            "-p", f"{self}",
            "--project-directory", f"../tasks/{self._name}",
            "run", "--rm",
            self._name
        ]

        logger.info(f"[{self}] Launching task")
        self._process = await asyncio.create_subprocess_exec(*cmd, stdout=asyncio.subprocess.DEVNULL, stderr=asyncio.subprocess.DEVNULL)
        try:
            await asyncio.wait_for(self._process.wait(), timeout=self._timeout)
            logger.info(f"[{self}] Task completed with exit code {self._process.returncode}")
            return TaskResult.SUCCESS if self._process.returncode == 0 else TaskResult.FAILURE
        except asyncio.TimeoutError:
            logger.info(f"[{self}] Task timed out. Waiting for termination...")
            self._process.terminate()
            await self._process.wait()
            logger.info(f"[{self}] Task terminated.")
            return TaskResult.TIMEOUT
        except asyncio.CancelledError:
            logger.info(f"[{self}] Task was cancelled by the user")
            return TaskResult.TERMINATED
        except Exception as e:
            logger.info(f"[{self}] Task failed:\n{e}")
            return TaskResult.ERROR

    async def terminate(self):
        if self._process is None:
            return

        logger.info(f"[{self}] Terminating task.")
        self._task.cancel()
