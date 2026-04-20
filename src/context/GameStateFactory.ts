import type { GameState } from "./GameContext";

export type TwoPlayerTurn = "player1" | "player2";
export type FourPlayerTurn = "player1" | "player2" | "player3" | "player4";

export function createTwoPlayerGameState(
  startingPlayer: TwoPlayerTurn,
  boardSize = 9,
): GameState {
  const center = boardSize - 1;
  const edge = boardSize * 2 - 2;

  return {
    status: "in_progress",
    turn: startingPlayer,
    boardSize,
    players: {
      player1: {
        position: { x: center, y: edge },
        wallsRemaining: 10,
        goalRow: 0,
      },
      player2: {
        position: { x: center, y: 0 },
        wallsRemaining: 10,
        goalRow: edge,
      },
    },
    walls: [],
  };
}

export function createFourPlayerGameState(
  startingPlayer: FourPlayerTurn,
  boardSize = 9,
): GameState {
  const center = boardSize - 1;
  const edge = boardSize * 2 - 2;

  return {
    status: "in_progress",
    turn: startingPlayer,
    boardSize,
    players: {
      // Clockwise order: top -> right -> bottom -> left
      player1: {
        position: { x: center, y: 0 },
        wallsRemaining: 5,
        goalRow: edge,
      },
      player2: {
        position: { x: edge, y: center },
        wallsRemaining: 5,
        goalRow: 0,
        goalColumn: 0,
      },
      player3: {
        position: { x: center, y: edge },
        wallsRemaining: 5,
        goalRow: 0,
      },
      player4: {
        position: { x: 0, y: center },
        wallsRemaining: 5,
        goalRow: edge,
        goalColumn: edge,
      },
    },
    walls: [],
  };
}
