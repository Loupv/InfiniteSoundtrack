const SLIDERS = [
  {
    key:      "valence",
    label:    "Valence",
    leftLabel:  "Triste",
    rightLabel: "Joyeux",
    color:    "#bf8abf",
  },
  {
    key:      "tension",
    label:    "Tension",
    leftLabel:  "Calme",
    rightLabel: "Tendu",
    color:    "#bf4a4a",
  },
  {
    key:      "energy",
    label:    "Énergie",
    leftLabel:  "Doux",
    rightLabel: "Intense",
    color:    "#4abf8a",
  },
  {
    key:      "color",
    label:    "Couleur",
    leftLabel:  "Sombre",
    rightLabel: "Lumineux",
    color:    "#bfb04a",
  },
]

// Convert -1..1 to 0..100 for HTML range input
function toRange(v) { return ((v + 1) / 2) * 100 }
function fromRange(v) { return (v / 100) * 2 - 1 }

export function EmotionalSliders({ mood, onChange }) {
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
      <div style={{ fontSize: 10, color: "#555", letterSpacing: "0.1em", marginBottom: 2 }}>
        ÉMOTIONS
      </div>

      {SLIDERS.map(({ key, label, leftLabel, rightLabel, color }) => {
        const val = mood[key] ?? 0
        return (
          <div key={key} style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 11, color: "#888", letterSpacing: "0.05em" }}>{label}</span>
              <span style={{ fontSize: 10, color: color, opacity: 0.8 }}>
                {val > 0.05 ? `+${val.toFixed(2)}` : val < -0.05 ? val.toFixed(2) : "0"}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ fontSize: 10, color: "#444", minWidth: 40, textAlign: "right" }}>
                {leftLabel}
              </span>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={toRange(val)}
                onChange={e => onChange(key, fromRange(Number(e.target.value)))}
                style={{
                  flex: 1,
                  accentColor: color,
                  cursor: "pointer",
                  height: 4,
                }}
              />
              <span style={{ fontSize: 10, color: "#444", minWidth: 44 }}>
                {rightLabel}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
