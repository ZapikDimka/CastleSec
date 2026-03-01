import logging
import typing
from contextlib import asynccontextmanager
from typing import Annotated

from castle_sec_game.file import FileReader
from castle_sec_game.game import Game
from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from starlette import status
from starlette.staticfiles import StaticFiles

from dto import game_to_dto, GameStateDto


logging.getLogger("game").setLevel(logging.DEBUG)
logging.basicConfig(level=logging.INFO)

assets_path = "../game/assets"

class State:
    game: Game

    def __init__(self, game: Game):
        self.game = game


@asynccontextmanager
async def lifespan(app: FastAPI):
    reader = FileReader("../game/test_map.json", assets_path, "../tasks")
    root_node = reader.read_file()
    game = Game(root_node)
    app.state = State(game=game)

    yield


app = FastAPI(lifespan=lifespan)
app.state = typing.cast(State, app.state)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],  # Разрешает все методы (GET, POST и т.д.)
    allow_headers=["*"],  # Разрешает все заголовки
)

def get_state(request: Request) -> State:
    return typing.cast(State, request.app.state)


def get_game(state: Annotated[State, Depends(get_state)]) -> Game:
    return state.game


@app.get("/current-state", response_model=GameStateDto)
async def get_current_state(game: Annotated[Game, Depends(get_game)]) -> GameStateDto:
    return game_to_dto(game)


@app.post("/perform-action/{index}", status_code=status.HTTP_200_OK)
async def perform_action(index: int, game: Annotated[Game, Depends(get_game)]) -> None:
    if game.is_solving_task:
        raise HTTPException(status_code=400, detail="Cannot perform action while solving a task")

    actions = game.actions
    if index < 0 or index >= len(actions):
        raise HTTPException(status_code=400, detail="Action index out of range")

    action = actions[index]
    game.act(action)  # TODO: Handle?

app.mount("/assets", StaticFiles(directory=assets_path), name="assets")
