import asyncio
import logging
import json
import re
import textwrap

from castle_sec_game.game.game import Game

BOLD, CYAN, YELLOW, GREEN, RESET = "\033[1m", "\033[96m", "\033[93m", "\033[92m", "\033[0m"


async def ainput(prompt: str = "") -> str:
    return await asyncio.to_thread(input, prompt)


def clean_len(s):
    return len(re.sub(r'\033\[[0-9;]*m', '', s))


def draw_line(content, width, border_color=CYAN):
    # max(0, ...) ensures padding never goes negative if a single unbroken word exceeds width
    padding = max(0, width - 4 - clean_len(content))
    return f"{BOLD}{border_color}║{RESET} {content}{' ' * padding} {BOLD}{border_color}║{RESET}"


def display_node(game: Game):
    node = game.get_current_node()
    actions = node["actions"].as_list().items
    inventory = game.inventory

    g_width = 52
    i_width = 25
    content_width = g_width - 4

    node_name = node["name"].as_str()
    node_text = node["text"].as_str()

    left = [f"{BOLD}{CYAN}╔═{'═' * content_width}═╗{RESET}"]

    # Wrap node name (just in case it's huge)
    for line in textwrap.wrap(node_name, content_width):
        left.append(draw_line(line.center(content_width), g_width))

    left.append(f"{BOLD}{CYAN}╠═{'═' * content_width}═╣{RESET}")

    # Wrap main node text safely
    for line in textwrap.wrap(node_text, content_width):
        left.append(draw_line(line, g_width))

    left.append(draw_line("", g_width))

    if game.is_solving_task:
        left.append(draw_line(f"{YELLOW}Solving task...{RESET}", g_width))
    else:
        left.append(draw_line(f"{BOLD}{YELLOW}Available Actions:{RESET}", g_width))
        for i, action in enumerate(actions):
            label = action.as_struct()["label"].as_str()
            prefix = f"[{i}] "
            prefix_len = len(prefix)

            # Wrap the action text, accounting for the width of the "[X] " prefix
            wrapped_action = textwrap.wrap(label, content_width - prefix_len)

            if not wrapped_action:
                continue

            # First line gets the colored prefix
            left.append(draw_line(f"{GREEN}[{i}]{RESET} {wrapped_action[0]}", g_width))

            # Subsequent lines are indented to match the text
            for line in wrapped_action[1:]:
                left.append(draw_line(f"{' ' * prefix_len}{line}", g_width))

    while len(left) < 10:
        left.append(draw_line("", g_width))
    left.append(f"{BOLD}{CYAN}╚═{'═' * content_width}═╝{RESET}")

    right = [f"{BOLD}{YELLOW}╔═{'═' * (i_width - 4)}═╗{RESET}",
             f"{BOLD}{YELLOW}║{'INVENTORY'.center(i_width - 2)}║{RESET}",
             f"{BOLD}{YELLOW}╠═{'═' * (i_width - 4)}═╣{RESET}"]

    if not inventory:
        right.append(f"{BOLD}{YELLOW}║{RESET} {'(empty)'.center(i_width - 4)} {BOLD}{YELLOW}║{RESET}")
    else:
        for item_name in inventory:
            # Wrap inventory items to prevent breaking the right panel
            for line in textwrap.wrap(item_name, i_width - 4):
                item_line = line.center(i_width - 4)
                right.append(f"{BOLD}{YELLOW}║{RESET} {item_line} {BOLD}{YELLOW}║{RESET}")

    right.append(f"{BOLD}{YELLOW}╚═{'═' * (i_width - 4)}═╝{RESET}")

    max_rows = max(len(left), len(right))
    for i in range(max_rows):
        l_row = left[i] if i < len(left) else " " * g_width
        r_row = right[i] if i < len(right) else ""
        gap = "  "
        print(f"{l_row}{' ' * (g_width - clean_len(l_row))}{gap}{r_row}")


async def select_action(game: Game) -> int | None:
    actions = game.get_current_node()["actions"].as_list().items

    index_str = await ainput("\n> ")
    if game.is_solving_task:
        return None

    try:
        index = int(index_str)
    except ValueError:
        return None

    if index < 0 or index >= len(actions):
        return None

    return index


def clear_terminal():
    print("\033[H\033[J", end="")


async def run_game():
    with open("test_map.json", "r") as f:
        raw_map_data = json.load(f)

    # TODO
    game = Game(raw_map_data, "assets", "../tasks")

    clear_terminal()

    while True:
        display_node(game)
        action_index = await select_action(game)
        if action_index is not None:
            clear_terminal()
            game.act(action_index)
        else:
            clear_terminal()
            print(f"{YELLOW}Invalid input, try again.{RESET}")
        await asyncio.sleep(0)


def main():
    logging.basicConfig(level=logging.DEBUG)
    try:
        asyncio.run(run_game())
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()