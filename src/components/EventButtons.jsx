export function EventButtons({ state, onPlay, onStop, onFadeIn, onFadeOut, onReroll }) {
  const isPlaying = state === "playing" || state === "fadingIn" || state === "fadingOut"
  const isFading  = state === "fadingIn" || state === "fadingOut"

  return (
    <div style={{
      background: "#111",
      border: "1px solid #1e1e1e",
      borderRadius: 12,
      padding: "16px 20px",
      display: "flex",
      flexDirection: "column",
      gap: 10,
    }}>
      <div style={{ fontSize: 10, color: "#555", letterSpacing: "0.1em", marginBottom: 2 }}>
        CONTRÔLES
      </div>

      {/* Play / Stop row */}
      <div style={{ display: "flex", gap: 8 }}>
        <BigButton
          onClick={() => {
            if (isPlaying) onStop()
            else onPlay()
          }}
          active={isPlaying}
          color={isPlaying ? "#bf4a4a" : "#4abf8a"}
          wide
        >
          {isPlaying ? "■ Stop" : "▶ Play"}
        </BigButton>
      </div>

      {/* Fade / Reroll row */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <SmallButton
          onClick={onFadeIn}
          disabled={isPlaying && state !== "fadingOut"}
          color="#4a8abf"
          title="Démarre avec un fondu entrant"
        >
          ↑ Fade In
        </SmallButton>

        <SmallButton
          onClick={onFadeOut}
          disabled={!isPlaying || isFading}
          color="#bf8a4a"
          title="Fondu sortant vers le silence"
        >
          ↓ Fade Out
        </SmallButton>

        <SmallButton
          onClick={onReroll}
          disabled={!isPlaying}
          color="#8a4abf"
          title="Génère une nouvelle progression au prochain cycle"
        >
          ⟳ Reroll
        </SmallButton>
      </div>
    </div>
  )
}

function BigButton({ children, onClick, active, color, wide }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: wide ? 1 : "none",
        padding: "10px 20px",
        borderRadius: 8,
        border: `1.5px solid ${color}`,
        background: active ? `${color}22` : "transparent",
        color,
        fontSize: 13,
        fontWeight: 700,
        letterSpacing: "0.08em",
        cursor: "pointer",
        fontFamily: "'Courier New', monospace",
        transition: "all 0.15s",
        boxShadow: active ? `0 0 12px ${color}44` : "none",
      }}
    >
      {children}
    </button>
  )
}

function SmallButton({ children, onClick, disabled, color, title }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      style={{
        padding: "6px 12px",
        borderRadius: 6,
        border: `1px solid ${disabled ? "#222" : color + "88"}`,
        background: "transparent",
        color: disabled ? "#333" : color,
        fontSize: 11,
        letterSpacing: "0.06em",
        cursor: disabled ? "default" : "pointer",
        fontFamily: "'Courier New', monospace",
        transition: "all 0.15s",
        opacity: disabled ? 0.4 : 1,
      }}
    >
      {children}
    </button>
  )
}
