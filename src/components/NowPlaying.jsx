import { NOTE_COLORS } from "../constants"

export function NowPlaying({ currentChord, currentIndex, progression, detectedKey, tempo, state }) {
  const isPlaying = state === "playing" || state === "fadingIn" || state === "fadingOut"

  return (
    <div style={{
      background: "#111",
      border: "1px solid #1e1e1e",
      borderRadius: 12,
      padding: "16px 20px",
      display: "flex",
      flexDirection: "column",
      gap: 14,
    }}>
      {/* Current chord + key info */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
        <div style={{
          fontSize: 36,
          fontWeight: 700,
          letterSpacing: "0.04em",
          color: currentChord ? NOTE_COLORS[currentChord.root] : "#333",
          transition: "color 0.4s ease",
          minWidth: 80,
          textShadow: currentChord
            ? `0 0 20px ${NOTE_COLORS[currentChord.root]}66`
            : "none",
        }}>
          {currentChord
            ? `${currentChord.root}${currentChord.suffix}`
            : "—"
          }
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ fontSize: 11, color: "#555", letterSpacing: "0.08em" }}>TONALITÉ</span>
          <span style={{ fontSize: 13, color: "#888" }}>
            {detectedKey ?? "—"}
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ fontSize: 11, color: "#555", letterSpacing: "0.08em" }}>TEMPO</span>
          <span style={{ fontSize: 13, color: "#888" }}>{tempo} bpm</span>
        </div>

        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6 }}>
          {state === "fadingIn"  && <StatusBadge label="FADE IN"  color="#4a8abf" />}
          {state === "fadingOut" && <StatusBadge label="FADE OUT" color="#bf8a4a" />}
          {state === "playing"   && <PulseDot />}
        </div>
      </div>

      {/* Progression chips */}
      {progression.length > 0 && (
        <div style={{
          display: "flex",
          gap: 6,
          flexWrap: "wrap",
          alignItems: "center",
        }}>
          {progression.map((chord, i) => {
            const active  = isPlaying && i === currentIndex
            const color   = NOTE_COLORS[chord.root] ?? "#555"
            return (
              <div
                key={`${chord.name}-${i}`}
                style={{
                  padding: "4px 10px",
                  borderRadius: 6,
                  fontSize: 12,
                  fontWeight: active ? 700 : 500,
                  letterSpacing: "0.03em",
                  border: `1.5px solid ${active ? color : "#2a2a2a"}`,
                  color: active ? color : "#555",
                  background: active ? `${color}18` : "transparent",
                  boxShadow: active ? `0 0 10px ${color}44` : "none",
                  transition: "all 0.25s ease",
                }}
              >
                {chord.root}{chord.suffix}
              </div>
            )
          })}
          {Array.from({ length: Math.max(0, 4 - progression.length) }).map((_, i) => (
            <div
              key={`empty-${i}`}
              style={{
                padding: "4px 10px",
                borderRadius: 6,
                fontSize: 12,
                border: "1.5px solid #1a1a1a",
                color: "#2a2a2a",
              }}
            >
              —
            </div>
          ))}
        </div>
      )}

      {!progression.length && (
        <div style={{ fontSize: 12, color: "#333", letterSpacing: "0.06em" }}>
          Appuie sur Play pour commencer
        </div>
      )}
    </div>
  )
}

function PulseDot() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <div style={{
        width: 7,
        height: 7,
        borderRadius: "50%",
        background: "#4a8abf",
        boxShadow: "0 0 6px #4a8abf",
        animation: "pulse 1.5s ease-in-out infinite",
      }} />
      <style>{`@keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:0.4;transform:scale(0.7)} }`}</style>
      <span style={{ fontSize: 10, color: "#4a8abf", letterSpacing: "0.1em" }}>EN COURS</span>
    </div>
  )
}

function StatusBadge({ label, color }) {
  return (
    <span style={{
      fontSize: 10,
      color,
      border: `1px solid ${color}55`,
      borderRadius: 4,
      padding: "2px 7px",
      letterSpacing: "0.08em",
    }}>
      {label}
    </span>
  )
}
