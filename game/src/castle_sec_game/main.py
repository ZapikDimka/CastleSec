from castle_sec_game.action import Action
from castle_sec_game.action_archetypes import ReturnActionArchetype, MoveActionArchetype
from castle_sec_game.game import Game
from castle_sec_game.map_node import MapNode


def select_action(actions: list[Action]) -> Action | None:
    index_str = input()
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


def display_node(node: MapNode, actions: list[Action]):
    print(f"\n{BOLD}{CYAN}╔═{'═' * 60}═╗{RESET}")
    print(f"{BOLD}{CYAN}║ {node.name.center(60)} ║{RESET}")
    print(f"{BOLD}{CYAN}╠═{'═' * 60}═╣{RESET}")

    print(f"  {node.text}")
    print()

    print(f"  {BOLD}{YELLOW}Available Actions:{RESET}")
    for i, action in enumerate(actions):
        print(f"  {GREEN}[{i}]{RESET} {action.text}")

    print(f"{BOLD}{CYAN}╚═{'═' * 60}═╝{RESET}")


def main():
    node_a = MapNode(name="A", text="Node A", actions=[ReturnActionArchetype()])
    node_b = MapNode(name="B", text="Node B", actions=[ReturnActionArchetype()])
    root_node = MapNode(name="Root", text="You see something!", actions=[
        ReturnActionArchetype(),
        MoveActionArchetype(node_a),
        MoveActionArchetype(node_b)
    ])

    game = Game(root_node)
    while True:
        current_node = game.current_node
        actions = game.actions
        display_node(current_node, actions)
        action = select_action(actions)
        if action is None:
            continue

        game.act(action)


if __name__ == "__main__":
    main()
