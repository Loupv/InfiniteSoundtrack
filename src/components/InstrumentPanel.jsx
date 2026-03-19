import { RHYTHM_PATTERNS } from "../engine/rhythm"

const WAVE_OPTIONS = [
  { value: "default", label: "Synth"   },
  { value: "piano",   label: "Piano"   },
  { value: "harp",    label: "Harpe"   },
  { value: "marimba", label: "Marimba" },
]

const MODE_OPTIONS = [
  { value: "block",   label: "Bloc"  },
  { value: "strum",   label: "Strum" },
  { value: "arpeggio",label: "Arp"   },
]

const OCTAVE_OPTIONS = [2, 3, 4, 5, 6]

const RHYTHM_OPTIONS = Object.keys(RHYTHM_PATTERNS).map(k => ({
  value: k,
  label: { none: "Aucun", pulse: "Pulse", simple: "Simple", groove: "Groove", half: "Half-time" }[k] ?? k,
}))

export function InstrumentPanel({ layers, onLayerChange, rhythmPattern, rhythmVolume, onRhythmChange, onRhythmVolumeChange }) {
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
        INSTRUMENTS
      </div>

      {layers.map(layer => (
        <LayerRow
          key={layer.id}
          layer={layer}
          onChange={updates => onLayerChange(layer.id, updates)}
        />
      ))}

      {/* Rhythm section */}
      <div style={{
        borderTop: "1px solid #1e1e1e",
        paddingTop: 12,
        display: "flex",
        flexDirection: "column",
        gap: 8,
      }}>
        <div style={{ fontSize: 10, color: "#555", letterSpacing: "0.1em" }}>RYTHME</div>
        <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
          {RHYTHM_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              onClick={() => onRhythmChange(value)}
              style={{
                padding: "4px 9px",
                borderRadius: 5,
                border: `1px solid ${rhythmPattern === value ? "#4a8abf" : "#222"}`,
                background: rhythmPattern === value ? "#0e1a24" : "transparent",
                color: rhythmPattern === value ? "#4a8abf" : "#555",
                fontSize: 11,
                cursor: "pointer",
                fontFamily: "'Courier New', monospace",
                letterSpacing: "0.04em",
                transition: "all 0.15s",
              }}
            >
              {label}
            </button>
          ))}
        </div>
        {rhythmPattern !== "none" && (
          <VolumeSlider
            label="Volume rythme"
            value={rhythmVolume}
            onChange={onRhythmVolumeChange}
            color="#4a8abf"
          />
        )}
      </div>
    </div>
  )
}

function LayerRow({ layer, onChange }) {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      gap: 6,
      opacity: layer.enabled ? 1 : 0.4,
      transition: "opacity 0.2s",
    }}>
      {/* Row 1: toggle + name + selectors */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {/* Enable toggle */}
        <button
          onClick={() => onChange({ enabled: !layer.enabled })}
          title={layer.enabled ? "Désactiver" : "Activer"}
          style={{
            width: 14,
            height: 14,
            borderRadius: "50%",
            border: `2px solid ${layer.enabled ? "#4abf8a" : "#333"}`,
            background: layer.enabled ? "#4abf8a" : "transparent",
            cursor: "pointer",
            padding: 0,
            flexShrink: 0,
          }}
        />

        <span style={{ fontSize: 11, color: "#aaa", minWidth: 58, letterSpacing: "0.04em" }}>
          {layer.name}
        </span>

        {/* Instrument selector */}
        <Select
          options={WAVE_OPTIONS}
          value={layer.waveType}
          onChange={v => onChange({ waveType: v })}
          disabled={!layer.enabled}
        />

        {/* Play mode */}
        <Select
          options={MODE_OPTIONS}
          value={layer.playMode}
          onChange={v => onChange({ playMode: v })}
          disabled={!layer.enabled}
        />

        {/* Octave */}
        <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <span style={{ fontSize: 9, color: "#444" }}>OCT</span>
          <Select
            options={OCTAVE_OPTIONS.map(o => ({ value: o, label: String(o) }))}
            value={layer.octave}
            onChange={v => onChange({ octave: Number(v) })}
            disabled={!layer.enabled}
          />
        </div>
      </div>

      {/* Row 2: volume slider */}
      {layer.enabled && (
        <VolumeSlider
          label="vol"
          value={layer.volume}
          onChange={v => onChange({ volume: v })}
          color="#888"
        />
      )}
    </div>
  )
}

function Select({ options, value, onChange, disabled }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      style={{
        background: "#1a1a1a",
        border: "1px solid #222",
        borderRadius: 4,
        color: disabled ? "#333" : "#aaa",
        fontSize: 10,
        padding: "2px 4px",
        cursor: disabled ? "default" : "pointer",
        fontFamily: "'Courier New', monospace",
        letterSpacing: "0.03em",
      }}
    >
      {options.map(({ value: v, label }) => (
        <option key={v} value={v}>{label}</option>
      ))}
    </select>
  )
}

function VolumeSlider({ label, value, onChange, color = "#888" }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 22 }}>
      <span style={{ fontSize: 9, color: "#444", minWidth: 20 }}>{label}</span>
      <input
        type="range"
        min={0}
        max={100}
        step={1}
        value={Math.round(value * 100)}
        onChange={e => onChange(Number(e.target.value) / 100)}
        style={{ flex: 1, accentColor: color, cursor: "pointer", height: 3 }}
      />
      <span style={{ fontSize: 9, color: "#444", minWidth: 28, textAlign: "right" }}>
        {Math.round(value * 100)}%
      </span>
    </div>
  )
}
