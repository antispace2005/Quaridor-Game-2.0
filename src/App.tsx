import "./App.css";
import Board from "./components/Board";
import MainMenu, { type GameSetup } from "./components/MainMenu";
import { GameContainer } from "./context/GameContext";
import {
  createFourPlayerGameState,
  createTwoPlayerGameState,
} from "./context/GameStateFactory";
import { OfflineGameManager } from "./Managers/OfflineGameManager";
import { useMemo, useState } from "react";
import type { GameState } from "./context/GameContext";

const offlineGameManager = new OfflineGameManager();

function App() {
  const [isGameRunning, setIsGameRunning] = useState(false);
  const [sessionKey, setSessionKey] = useState(0);
  const [startingPlayer, setStartingPlayer] = useState<
    "player1" | "player2" | "player3" | "player4"
  >("player1");
  const [gameSetup, setGameSetup] = useState<GameSetup>({
    mode: "1v1",
    type: "1v1",
    diff: "none",
    boardSize: 9,
  });

  const getRandomStartingPlayer = (
    mode: GameSetup["mode"],
  ): "player1" | "player2" | "player3" | "player4" => {
    if (mode === "1v1v1v1") {
      const players = ["player1", "player2", "player3", "player4"] as const;
      return players[Math.floor(Math.random() * players.length)] ?? "player1";
    }

    const players = ["player1", "player2"] as const;
    return players[Math.floor(Math.random() * players.length)] ?? "player1";
  };

  const initialState = useMemo<GameState>(() => {
    if (gameSetup.mode === "1v1v1v1") {
      return createFourPlayerGameState(startingPlayer, gameSetup.boardSize);
    }

    const twoPlayerStarter =
      startingPlayer === "player2" ? "player2" : "player1";
    return createTwoPlayerGameState(twoPlayerStarter, gameSetup.boardSize);
  }, [gameSetup.boardSize, gameSetup.mode, startingPlayer]);

  const startGame = (nextSetup: GameSetup) => {
    setStartingPlayer(getRandomStartingPlayer(nextSetup.mode));
    setGameSetup(nextSetup);
    setSessionKey((currentKey) => currentKey + 1);
    setIsGameRunning(true);
  };

  const restartGame = () => {
    setStartingPlayer(getRandomStartingPlayer(gameSetup.mode));
    setSessionKey((currentKey) => currentKey + 1);
    setIsGameRunning(true);
  };

  const exitToMainMenu = () => {
    setIsGameRunning(false);
  };

  return (
    <div className="app-shell">
      {!isGameRunning ? (
        <MainMenu
          currentSetup={gameSetup}
          onSetupChange={setGameSetup}
          onStartGame={startGame}
        />
      ) : (
        <GameContainer
          key={sessionKey}
          initialState={initialState}
          initialControls={{
            type: gameSetup.type,
            diff: gameSetup.diff,
          }}
        >
          <Board
            boardSize={gameSetup.boardSize}
            manager={offlineGameManager}
            onRestartGame={restartGame}
            onExitGame={exitToMainMenu}
          />
        </GameContainer>
      )}
    </div>
  );
}

export default App;
