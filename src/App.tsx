import "./App.css";
import Board from "./components/Board";
import { GameContainer } from "./context/GameContext";
import {
  createFourPlayerGameState,
  createTwoPlayerGameState,
} from "./context/GameStateFactory";
import { OfflineGameManager } from "./Managers/OfflineGameManager";

const offlineGameManager = new OfflineGameManager();

function App() {
  return (
    <GameContainer initialState={createTwoPlayerGameState("player1")}>
      <Board boardSize={9} manager={offlineGameManager} />
    </GameContainer>
  );
}

export default App;
