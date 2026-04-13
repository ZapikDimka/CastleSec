import re
from datetime import datetime
from typing import Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from castle_sec_game.game.game import Game


def interpolate(text: Optional[str], variables: dict[str, str]) -> Optional[str]:
    if not text:
        return text
    return re.sub(r'\{([\w.]+)\}', lambda m: variables.get(m.group(1), ''), text)


def _node_string_fields(node, prefix: str) -> dict[str, str]:
    return {
        f"{prefix}.name": node.name,
        f"{prefix}.text": node.text,
    }


def build_context(game: "Game") -> dict[str, str]:
    ctx = game.ctx
    implicit: dict[str, str] = {}

    implicit.update(_node_string_fields(game.current_node, "node"))
    implicit["map.name"] = game.state.current_map.resolve(ctx).name

    if game.state.prev_node is not None:
        implicit.update(_node_string_fields(game.state.prev_node.resolve(ctx), "prev_node"))

    now = datetime.now()
    implicit["time.hour"] = str(now.hour)
    implicit["time.minute"] = str(now.minute)
    implicit["time.second"] = str(now.second)

    implicit.update(game.state.variables)
    return implicit
