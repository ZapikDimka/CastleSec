import asyncio
import logging
import os
import re
import subprocess
import time
import uuid
from enum import Enum
from pathlib import Path
from urllib import error as urllib_error
from urllib import request as urllib_request


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
    _run_task: asyncio.Task[TaskResult] | None = None
    _completion_future: asyncio.Future[TaskResult] | None = None
    _url: str | None = None
    _probe_url: str | None = None
    _is_ready: bool = False

    def __init__(self, name: str, tasks_dir: str | Path, timeout: float = 15 * 60):
        self._name = name
        self._id = uuid.uuid4()
        self._timeout = timeout
        self._tasks_dir = Path(tasks_dir).resolve()
        self._task_dir = (self._tasks_dir / self._name).resolve()

    def __str__(self):
        return f"{self._name}__{self._id}"

    @property
    def name(self) -> str:
        return self._name

    def get_result(self) -> TaskResult | None:
        if self._run_task is None or not self._run_task.done():
            return None
        return self._run_task.result()

    def get_url(self) -> str | None:
        if not self._is_ready:
            return None
        return self._url

    def run(self):
        if self._run_task is not None:
            return

        compose_path = self._find_compose_file()
        if compose_path is not None:
            public_host = os.environ.get("TASK_PUBLIC_HOST", "127.0.0.1")
            self._url = self._read_host_port(compose_path, public_host)
            probe_host = os.environ.get("TASK_HOST", public_host)
            self._probe_url = self._read_host_port(compose_path, probe_host)

        self._run_task = asyncio.create_task(self._run_impl())

    async def mark_success(self):
        await self._finish_with(TaskResult.SUCCESS)

    async def mark_failure(self):
        await self._finish_with(TaskResult.FAILURE)

    async def terminate(self):
        await self._finish_with(TaskResult.TERMINATED)

    async def _finish_with(self, result: TaskResult):
        if self._run_task is None:
            return

        for _ in range(100):
            if self._completion_future is not None:
                break
            await asyncio.sleep(0.05)

        if self._completion_future is not None and not self._completion_future.done():
            self._completion_future.set_result(result)

        await self._run_task

    async def _run_impl(self) -> TaskResult:
        if not self._task_dir.exists() or not self._task_dir.is_dir():
            logger.error(f"[{self}] Task directory does not exist: {self._task_dir}")
            return TaskResult.ERROR

        compose_path = self._find_compose_file()
        if compose_path is None:
            logger.error(f"[{self}] docker-compose file not found in {self._task_dir}")
            return TaskResult.ERROR

        if self._url is None:
            self._url = self._read_host_port(compose_path)

        if self._url is None:
            logger.error(f"[{self}] Could not determine task URL from compose file")
            return TaskResult.ERROR

        self._completion_future = asyncio.get_running_loop().create_future()
        self._is_ready = False

        try:
            logger.info(f"[{self}] Launching task from {self._task_dir}")
            await self._compose("up", "-d", "--build", "--remove-orphans")

            ready = await self._wait_until_ready(timeout=60.0, interval=0.5)
            if not ready:
                logger.error(f"[{self}] Task did not become ready in time: {self._url}")
                return TaskResult.ERROR

            self._is_ready = True
            logger.info(f"[{self}] Task is ready: {self._url}")

            result = await asyncio.wait_for(self._completion_future, timeout=self._timeout)
            logger.info(f"[{self}] Task finished with result: {result.name}")
            return result
        except asyncio.TimeoutError:
            logger.info(f"[{self}] Task timed out")
            return TaskResult.TIMEOUT
        except asyncio.CancelledError:
            logger.info(f"[{self}] Task was cancelled")
            return TaskResult.TERMINATED
        except Exception:
            logger.exception(f"[{self}] Task failed")
            return TaskResult.ERROR
        finally:
            self._is_ready = False
            try:
                await self._compose("down", "--remove-orphans", "--volumes")
            except Exception:
                logger.exception(f"[{self}] Failed to stop docker compose stack")

    async def _compose(self, *compose_args: str):
        await asyncio.to_thread(self._compose_sync, *compose_args)

    def _compose_sync(self, *compose_args: str):
        cmd = [
            "docker", "compose",
            "-p", str(self),
            "--project-directory", str(self._task_dir),
            *compose_args,
        ]

        logger.debug(f"[{self}] Running command: {' '.join(cmd)}")
        process = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            encoding="utf-8",
            errors="ignore",
            cwd=str(self._task_dir),
        )

        if process.returncode != 0:
            raise RuntimeError(
                f"docker compose {' '.join(compose_args)} failed with code {process.returncode}\n"
                f"STDOUT:\n{process.stdout.strip()}\nSTDERR:\n{process.stderr.strip()}"
            )

    async def _wait_until_ready(self, timeout: float = 60.0, interval: float = 0.5) -> bool:
        deadline = time.monotonic() + timeout

        while time.monotonic() < deadline:
            is_ready = await asyncio.to_thread(self._probe_http_ready)
            if is_ready:
                return True
            await asyncio.sleep(interval)

        return False

    def _probe_http_ready(self) -> bool:
        if self._probe_url is None:
            return False

        req = urllib_request.Request(
            self._probe_url,
            headers={"User-Agent": "CastleSecTaskRunner/1.0"},
            method="GET",
        )

        try:
            with urllib_request.urlopen(req, timeout=2) as response:
                return 100 <= response.status < 600
        except urllib_error.HTTPError as exc:
            return 100 <= exc.code < 600
        except Exception:
            return False

    def _find_compose_file(self) -> Path | None:
        for filename in ("docker-compose.yml", "docker-compose.yaml"):
            candidate = self._task_dir / filename
            if candidate.exists() and candidate.is_file():
                return candidate
        return None

    def _read_host_port(self, compose_path: Path, host: str = "127.0.0.1") -> str | None:
        try:
            lines = compose_path.read_text(encoding="utf-8").splitlines()
        except OSError:
            logger.info(f"[{self}] Cannot read compose file: {compose_path}")
            return None

        inside_services = False
        inside_target_service = False
        service_indent = None
        inside_ports = False
        ports_indent = None

        for line in lines:
            stripped = line.strip()
            if not stripped or stripped.startswith("#"):
                continue

            indent = len(line) - len(line.lstrip(" "))

            if stripped == "services:" and indent == 0:
                inside_services = True
                inside_target_service = False
                inside_ports = False
                service_indent = None
                ports_indent = None
                continue

            if inside_services and indent == 0 and stripped != "services:":
                inside_services = False
                inside_target_service = False
                inside_ports = False
                service_indent = None
                ports_indent = None

            if not inside_services:
                continue

            if inside_target_service and stripped == "ports:":
                inside_ports = True
                ports_indent = indent
                continue

            service_match = re.match(r"^([A-Za-z0-9_-]+):\s*$", stripped)
            if service_match and indent == 2:
                current_service_name = service_match.group(1)
                inside_target_service = current_service_name == self._name
                service_indent = indent if inside_target_service else None
                inside_ports = False
                ports_indent = None
                continue

            if not inside_target_service:
                continue

            if indent <= (service_indent or 0):
                inside_target_service = False
                inside_ports = False
                ports_indent = None
                continue

            if inside_ports:
                if indent <= (ports_indent or 0):
                    inside_ports = False
                    continue

                if stripped.startswith("-"):
                    mapping = stripped[1:].strip().split("#", 1)[0].strip().strip('"').strip("'")
                    parts = [part.strip() for part in mapping.split(":")]

                    if len(parts) >= 2:
                        for candidate in reversed(parts[:-1]):
                            if candidate.isdigit():
                                logger.info(f"[{self}] Task URL: http://{host}:{candidate}")
                                return f"http://{host}:{candidate}"

        logger.info(f"[{self}] No port mapping found for service '{self._name}'")
        return None