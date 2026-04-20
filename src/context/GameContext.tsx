import React, { type ReactNode } from "react";
import { createContext, useContext } from "react";

export interface PlayerState {
  position: { x: number; y: number };
  wallsRemaining: number;
  goalRow: number;
}

export interface GameState {
  status: "in_progress" | "finished" | "paused";
  turn: "player1" | "player2" | "player3" | "player4";
  boardSize: number;
  players: {
    player1?: PlayerState;
    player2?: PlayerState;
    player3?: PlayerState;
    player4?: PlayerState;
  };
  walls: Array<{
    x: number;
    y: number;
    playerId: 0 | 1 | 2 | 3;
  }>;
}

interface GameContextType {
  gameState: GameState;
  setGameState: (state: GameState) => void;
}

const GameContext = createContext<GameContextType | undefined>(undefined);

export function GameContainer({
  children,
  initialState,
}: {
  children: ReactNode;
  initialState: GameState;
}) {
  const [gameState, setGameState] = React.useState(initialState);
  const hasShownFinishedAlert = React.useRef(false);

  React.useEffect(() => {
    if (gameState.status !== "finished") {
      hasShownFinishedAlert.current = false;
      return;
    }

    if (hasShownFinishedAlert.current) {
      return;
    }

    hasShownFinishedAlert.current = true;
    window.alert(`${gameState.turn} won`);
  }, [gameState.status, gameState.turn]);

  return (
    <GameContext.Provider value={{ gameState, setGameState }}>
      {children}
    </GameContext.Provider>
  );
}

export function useGameState(): GameContextType {
  const context = useContext(GameContext);
  if (!context) {
    throw new Error("useGameState must be used within GameContainer");
  }
  return context;
}
