import type { GameState } from "./GameContext";
import {
  createFourPlayerGameState,
  createTwoPlayerGameState,
} from "./GameStateFactory";

export { createFourPlayerGameState, createTwoPlayerGameState };

export const twoPlayerGameState: GameState = createTwoPlayerGameState("player1");
export const fourPlayerGameState: GameState = createFourPlayerGameState("player1");
export const exampleGameState: GameState = twoPlayerGameState;
