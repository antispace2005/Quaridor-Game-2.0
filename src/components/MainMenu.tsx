import "./MainMenu.css";

export type MenuMode =
  | "two-player"
  | "two-player-ai"
  | "four-player"
  | "four-player-ai";
export type PlayerRole = "human" | "ai";
export type PlayerControlState = Record<
  "player1" | "player2" | "player3" | "player4",
  PlayerRole
>;

export interface GameSetup {
  mode: MenuMode;
  controls: PlayerControlState;
}

interface MainMenuProps {
  currentSetup: GameSetup;
  onSetupChange: (setup: GameSetup) => void;
  onStartGame: (setup: GameSetup) => void;
  onRestartGame: () => void;
}

const DEFAULT_CONTROLS: PlayerControlState = {
  player1: "human",
  player2: "human",
  player3: "ai",
  player4: "ai",
};

export default function MainMenu({
  currentSetup,
  onSetupChange,
  onStartGame,
  onRestartGame,
}: MainMenuProps) {
  const isFourPlayerMode =
    currentSetup.mode === "four-player" ||
    currentSetup.mode === "four-player-ai";
  const isAiMode =
    currentSetup.mode === "two-player-ai" ||
    currentSetup.mode === "four-player-ai";

  const updateMode = (mode: MenuMode) => {
    onSetupChange({
      mode,
      controls:
        mode === "four-player" || mode === "four-player-ai"
          ? currentSetup.controls
          : {
              ...DEFAULT_CONTROLS,
              player3: "ai",
              player4: "ai",
            },
    });
  };

  const updateControl = (
    playerKey: keyof PlayerControlState,
    role: PlayerRole,
  ) => {
    onSetupChange({
      ...currentSetup,
      controls: {
        ...currentSetup.controls,
        [playerKey]: role,
      },
    });
  };

  const playerKeys: Array<keyof PlayerControlState> = isFourPlayerMode
    ? ["player1", "player2", "player3", "player4"]
    : ["player1", "player2"];

  return (
    <div className="main-menu">
      <div className="main-menu__card">
        <h1 className="main-menu__title">Quoridor</h1>
        <p className="main-menu__subtitle">Choose a mode and start the game.</p>

        <section className="main-menu__section">
          <h2>Game Mode</h2>
          <div className="main-menu__button-row">
            <button
              type="button"
              className={currentSetup.mode === "two-player" ? "selected" : ""}
              onClick={() => updateMode("two-player")}
            >
              1v1 Human
            </button>
            <button
              type="button"
              className={
                currentSetup.mode === "two-player-ai" ? "selected" : ""
              }
              onClick={() => updateMode("two-player-ai")}
            >
              1v1 AI
            </button>
            <button
              type="button"
              className={currentSetup.mode === "four-player" ? "selected" : ""}
              onClick={() => updateMode("four-player")}
            >
              1v1v1v1 Human
            </button>
            <button
              type="button"
              className={
                currentSetup.mode === "four-player-ai" ? "selected" : ""
              }
              onClick={() => updateMode("four-player-ai")}
            >
              1v1v1v1 AI
            </button>
          </div>
        </section>

        {isAiMode ? (
          <section className="main-menu__section">
            <h2>Player Control</h2>
            <div className="main-menu__player-grid">
              {playerKeys.map((playerKey) => (
                <div key={playerKey} className="main-menu__player-card">
                  <span>{playerKey}</span>
                  <div className="main-menu__button-row compact">
                    <button
                      type="button"
                      className={
                        currentSetup.controls[playerKey] === "human"
                          ? "selected"
                          : ""
                      }
                      onClick={() => updateControl(playerKey, "human")}
                    >
                      Human
                    </button>
                    <button
                      type="button"
                      className={
                        currentSetup.controls[playerKey] === "ai"
                          ? "selected"
                          : ""
                      }
                      onClick={() => updateControl(playerKey, "ai")}
                    >
                      AI
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : (
          <section className="main-menu__section">
            <h2>Players</h2>
            <p className="main-menu__muted">
              All players are human in this mode.
            </p>
          </section>
        )}

        <section className="main-menu__section main-menu__actions">
          <button
            type="button"
            className="primary"
            onClick={() => onStartGame(currentSetup)}
          >
            Start Game
          </button>
          <button type="button" onClick={onRestartGame}>
            Restart Game
          </button>
        </section>

        <section className="main-menu__section">
          <h2>Online</h2>
          <div className="main-menu__button-row">
            <button type="button" disabled>
              Host Game WIP
            </button>
            <button type="button" disabled>
              Join Game WIP
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}
