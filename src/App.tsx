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
  const [gameSetup, setGameSetup] = useState<GameSetup>({
    mode: "1v1",
    type: "1v1",
    diff: "none",
  });

  const initialState = useMemo<GameState>(() => {
    if (gameSetup.mode === "1v1v1v1") {
      return createFourPlayerGameState("player1");
    }

    return createTwoPlayerGameState("player1");
  }, [gameSetup.mode]);

  const startGame = (nextSetup: GameSetup) => {
    setGameSetup(nextSetup);
    setSessionKey((currentKey) => currentKey + 1);
    setIsGameRunning(true);
  };

  const restartGame = () => {
    setSessionKey((currentKey) => currentKey + 1);
    setIsGameRunning(true);
  };

  return (
    <div className="app-shell">
      {!isGameRunning ? (
        <MainMenu
          currentSetup={gameSetup}
          onSetupChange={setGameSetup}
          onStartGame={startGame}
          onRestartGame={restartGame}
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
          <Board boardSize={9} manager={offlineGameManager} />
        </GameContainer>
      )}
    </div>
  );
}

export default App;
