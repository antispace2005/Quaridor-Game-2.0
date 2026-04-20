import "./MainMenu.css";

export type MenuMode = "1v1" | "1v1ai" | "1v1v1v1";
export type AiDifficulty = "easy" | "normal" | "hard" | "expert";
export type GameDiff = AiDifficulty | "none" | "online";

export interface GameSetup {
  mode: MenuMode;
  type: "1v1" | "1v1v1v1";
  diff: GameDiff;
  boardSize: 7 | 9 | 11;
}

interface MainMenuProps {
  currentSetup: GameSetup;
  onSetupChange: (setup: GameSetup) => void;
  onStartGame: (setup: GameSetup) => void;
  onRestartGame: () => void;
}

export default function MainMenu({
  currentSetup,
  onSetupChange,
  onStartGame,
  onRestartGame,
}: MainMenuProps) {
  const isAiMode = currentSetup.mode === "1v1ai";

  const updateMode = (mode: MenuMode) => {
    onSetupChange({
      ...currentSetup,
      mode,
      type: mode === "1v1v1v1" ? "1v1v1v1" : "1v1",
      diff:
        mode === "1v1ai"
          ? currentSetup.diff === "none" || currentSetup.diff === "online"
            ? "normal"
            : currentSetup.diff
          : mode === "1v1v1v1"
            ? "none"
            : "none",
    });
  };

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
              className={currentSetup.mode === "1v1" ? "selected" : ""}
              onClick={() => updateMode("1v1")}
            >
              1v1
            </button>
            <button
              type="button"
              className={currentSetup.mode === "1v1ai" ? "selected" : ""}
              onClick={() => updateMode("1v1ai")}
            >
              1v1 AI
            </button>
            <button
              type="button"
              className={currentSetup.mode === "1v1v1v1" ? "selected" : ""}
              onClick={() => updateMode("1v1v1v1")}
            >
              1v1v1v1
            </button>
          </div>
        </section>

        {isAiMode ? (
          <section className="main-menu__section">
            <h2>AI Difficulty</h2>
            <div className="main-menu__button-row">
              {(["easy", "normal", "hard", "expert"] as const).map(
                (difficulty) => (
                  <button
                    key={difficulty}
                    type="button"
                    className={
                      currentSetup.diff === difficulty ? "selected" : ""
                    }
                    onClick={() =>
                      onSetupChange({
                        ...currentSetup,
                        diff: difficulty,
                      })
                    }
                  >
                    {difficulty}
                  </button>
                ),
              )}
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

        <section className="main-menu__section">
          <h2>Board Size</h2>
          <div className="main-menu__button-row compact">
            {([7, 9, 11] as const).map((size) => (
              <button
                key={size}
                type="button"
                className={currentSetup.boardSize === size ? "selected" : ""}
                onClick={() =>
                  onSetupChange({
                    ...currentSetup,
                    boardSize: size,
                  })
                }
              >
                {size}x{size}
              </button>
            ))}
          </div>
        </section>

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
