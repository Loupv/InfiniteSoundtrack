import { TEXT } from "../constants"

const CONTROLS = [
  { key: "tempo",     label: "Tempo",   min: 40,   max: 240,  step: 1,     fmt: v => `${v} bpm` },
  { key: "sustain",   label: "Sustain", min: 0.3,  max: 4,    step: 0.05,  fmt: v => `${v.toFixed(1)}s` },
  { key: "intensity", label: "Vol",     min: 0.1,  max: 1.4,  step: 0.05,  fmt: v => `${Math.round(v * 100 / 1.4)}%` },
  { key: "spread",    label: "Strum",   min: 0,    max: 0.08, step: 0.002, fmt: v => `${Math.round(v * 1000)}ms` },
]

const WAVE_TYPES = [
  { value: "piano",    label: "♩ piano" },
  { value: "triangle", label: "△ warm" },
  { value: "sine",     label: "∿ soft" },
  { value: "sawtooth", label: "⊿ bright" },
]

export function SoundControls({ values, onChange }) {
  return (
    <div style={{
      background: "#0f0f0f", borderRadius: 10, border: "1px solid #1e1e1e",
      padding: "10px 14px", flexShrink: 0,
    }}>
      <p style={{ margin: "0 0 10px", fontSize: 11, color: TEXT.muted, letterSpacing: "0.1em" }}>SOUND</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {/* Wave type */}
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 11, color: TEXT.muted, width: 44, flexShrink: 0 }}>Wave</span>
          <div style={{ display: "flex", gap: 4 }}>
            {WAVE_TYPES.map(({ value, label }) => {
              const active = (values.waveType ?? "piano") === value
              return (
                <button
                  key={value}
                  onClick={() => onChange("waveType", value)}
                  style={{
                    padding: "2px 7px", borderRadius: 4, fontSize: 10,
                    fontFamily: "'Courier New', monospace", cursor: "pointer",
                    border: active ? "1px solid #4a8abf" : "1px solid #2a2a2a",
                    background: active ? "#0e1a24" : "#1a1a1a",
                    color: active ? "#4a8abf" : TEXT.muted,
                    transition: "all 0.12s",
                  }}
                >{label}</button>
              )
            })}
          </div>
        </div>
        {CONTROLS.map(({ key, label, min, max, step, fmt }) => (
          <label key={key} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ fontSize: 11, color: TEXT.muted, width: 44, flexShrink: 0 }}>{label}</span>
            <input
              type="range" min={min} max={max} step={step} value={values[key]}
              onChange={e => onChange(key, Number(e.target.value))}
              style={{ width: 130, cursor: "pointer" }}
            />
            <span style={{ fontSize: 11, color: TEXT.secondary, width: 52, textAlign: "right", flexShrink: 0 }}>
              {fmt(values[key])}
            </span>
          </label>
        ))}
      </div>
    </div>
  )
}
