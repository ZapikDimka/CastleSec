import asyncio
import logging

from castle_sec_game.action import Action
from castle_sec_game.file_reader import FileReader
from castle_sec_game.game import Game


async def ainput(prompt: str = "") -> str:
    return await asyncio.to_thread(input, prompt)

async def select_action(game: Game) -> Action | None:
    actions = game.actions

    index_str = await ainput()
    if game.is_solving_task:
        return None

    try:
        index = int(index_str)
    except ValueError:
        print("Invalid input")
        return None

    if index < 0 or index >= len(actions):
        print("Invalid input")
        return None

    return actions[index]


BOLD = "\033[1m"
CYAN = "\033[96m"
YELLOW = "\033[93m"
GREEN = "\033[92m"
RESET = "\033[0m"

import re


def clean_len(s):
    return len(re.sub(r'\033\[[0-9;]*m', '', s))


def draw_line(content, width, border_color=CYAN):
    padding = width - 4 - clean_len(content)
    return f"{BOLD}{border_color}║{RESET} {content}{' ' * padding} {BOLD}{border_color}║{RESET}"


def display_node(game: Game):
    node = game.current_node
    actions = game.actions
    inventory = game.inventory

    g_width = 52
    i_width = 25

    left = [f"{BOLD}{CYAN}╔═{'═' * (g_width - 4)}═╗{RESET}", draw_line(node.name.center(g_width - 4), g_width),
            f"{BOLD}{CYAN}╠═{'═' * (g_width - 4)}═╣{RESET}", draw_line(node.text, g_width), draw_line("", g_width)]

    if game.is_solving_task:
        left.append(draw_line(f"{YELLOW}Solving task...{RESET}", g_width))
    else:
        left.append(draw_line(f"{BOLD}{YELLOW}Available Actions:{RESET}", g_width))
        for i, action in enumerate(actions):
            left.append(draw_line(f"{GREEN}[{i}]{RESET} {action.text}", g_width))

    while len(left) < 10:
        left.append(draw_line("", g_width))
    left.append(f"{BOLD}{CYAN}╚═{'═' * (g_width - 4)}═╝{RESET}")

    right = [f"{BOLD}{YELLOW}╔═{'═' * (i_width - 4)}═╗{RESET}", f"{BOLD}{YELLOW}║{'INVENTORY'.center(i_width - 2)}║{RESET}",
             f"{BOLD}{YELLOW}╠═{'═' * (i_width - 4)}═╣{RESET}"]

    if not inventory:
        right.append(f"{BOLD}{YELLOW}║{RESET} {'(empty)'.center(i_width - 4)} {BOLD}{YELLOW}║{RESET}")
    else:
        for item in inventory:
            name = item.name if hasattr(item, 'name') else str(item)
            item_line = name[:i_width - 4].center(i_width - 4)
            right.append(f"{BOLD}{YELLOW}║{RESET} {item_line} {BOLD}{YELLOW}║{RESET}")

    right.append(f"{BOLD}{YELLOW}╚═{'═' * (i_width - 4)}═╝{RESET}")

    max_rows = max(len(left), len(right))
    for i in range(max_rows):
        l_row = left[i] if i < len(left) else " " * g_width
        r_row = right[i] if i < len(right) else ""
        gap = "  "
        print(f"{l_row}{' ' * (g_width - clean_len(l_row))}{gap}{r_row}")

async def run_game():
    '''
    node_a = MapNode(name="A", text="Node A", actions=[ReturnActionArchetype(), PickUpItemActionArchetype(item=InventoryItem("Dog Shit"))])
    node_b = MapNode(name="B", text="Node B", actions=[ReturnActionArchetype(), SolveTaskActionArchetype()])
    root_node = MapNode(name="Root", text="You see something!", actions=[
        ReturnActionArchetype(),
        MoveActionArchetype(node_a),
        MoveActionArchetype(node_b)
    ])
    '''
    reader = FileReader("test_map.json")
    root_node = reader.read_file()

    game = Game(root_node)
    while True:
        display_node(game)
        action = await select_action(game)
        game.act(action)
        await asyncio.sleep(0)

def main():
    logging.basicConfig(level=logging.DEBUG)

    try:
        asyncio.run(run_game())
    except KeyboardInterrupt:
        pass

if __name__ == "__main__":
   main()
