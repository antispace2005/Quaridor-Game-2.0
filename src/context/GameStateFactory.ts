import type { GameState } from "./GameContext";

export type TwoPlayerTurn = "player1" | "player2";
export type FourPlayerTurn = "player1" | "player2" | "player3" | "player4";

export function createTwoPlayerGameState(
  startingPlayer: TwoPlayerTurn,
): GameState {
  return {
    status: "in_progress",
    turn: startingPlayer,
    boardSize: 9,
    players: {
      player1: {
        position: { x: 8, y: 16 },
        wallsRemaining: 10,
        goalRow: 0,
      },
      player2: {
        position: { x: 8, y: 0 },
        wallsRemaining: 10,
        goalRow: 16,
      },
    },
    walls: [],
  };
}

export function createFourPlayerGameState(
  startingPlayer: FourPlayerTurn,
): GameState {
  return {
    status: "in_progress",
    turn: startingPlayer,
    boardSize: 9,
    players: {
      // Clockwise order: top -> right -> bottom -> left
      player1: {
        position: { x: 8, y: 0 },
        wallsRemaining: 5,
        goalRow: 16,
      },
      player2: {
        position: { x: 16, y: 8 },
        wallsRemaining: 5,
        goalRow: 0,
        goalColumn: 0,
      },
      player3: {
        position: { x: 8, y: 16 },
        wallsRemaining: 5,
        goalRow: 0,
      },
      player4: {
        position: { x: 0, y: 8 },
        wallsRemaining: 5,
        goalRow: 16,
        goalColumn: 16,
      },
    },
    walls: [],
  };
}
