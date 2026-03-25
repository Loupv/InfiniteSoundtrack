import { RHYTHM_PATTERNS } from "../engine/rhythm"
import { LAYER_PRESETS } from "../engine/soundtrack"

const WAVE_OPTIONS = [
  { value: "default", label: "Synth"   },
  { value: "piano",   label: "Piano"   },
  { value: "harp",    label: "Harpe"   },
  { value: "marimba", label: "Marimba" },
]

export const PLAY_MODES = [
  { value: "block",    label: "Bloc",     desc: "Tous les accords simultanément" },
  { value: "strum",    label: "Strum",    desc: "Cascade rapide ascendante" },
  { value: "arpUp",    label: "Arp ↑",    desc: "Arpège montant (1 note/beat)" },
  { value: "arpDown",  label: "Arp ↓",    desc: "Arpège descendant" },
  { value: "arpUpDown",label: "Arp ↕",    desc: "Arpège bounce montée-descente" },
  { value: "alberti",  label: "Alberti",  desc: "Main gauche classique: basse–5te–3ce–5te" },
  { value: "waltz",    label: "Valse",    desc: "Basse sur 1, accord sur 2–3" },
  { value: "comp",     label: "Comp",     desc: "Contretemps jazz (Bill Evans)" },
  { value: "broken",   label: "Brisé",    desc: "Accords brisés type baroque" },
]

const RHYTHM_OPTIONS = Object.keys(RHYTHM_PATTERNS).map(k => ({
  value: k,
  label: { none: "Aucun", pulse: "Pulse", simple: "Simple", groove: "Groove", half: "Half-time" }[k] ?? k,
}))

const OCTAVE_OPTIONS = [2, 3, 4, 5, 6]

export function InstrumentPanel({
  layers, onLayerChange,
  rhythmPattern, rhythmVolume, onRhythmChange, onRhythmVolumeChange,
  onApplyPreset,
}) {
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

      {/* Header + presets */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ fontSize: 10, color: "#555", letterSpacing: "0.1em" }}>INSTRUMENTS</span>
        <div style={{ marginLeft: "auto", display: "flex", gap: 5, flexWrap: "wrap" }}>
          {Object.keys(LAYER_PRESETS).map(name => (
            <button
              key={name}
              onClick={() => onApplyPreset(name)}
              title={name}
              style={{
                padding: "2px 7px",
                borderRadius: 4,
                border: "1px solid #222",
                background: "transparent",
                color: "#555",
                fontSize: 9,
                cursor: "pointer",
                fontFamily: "'Courier New', monospace",
                letterSpacing: "0.04em",
                transition: "color 0.15s, border-color 0.15s",
              }}
              onMouseEnter={e => { e.target.style.color = "#888"; e.target.style.borderColor = "#444" }}
              onMouseLeave={e => { e.target.style.color = "#555"; e.target.style.borderColor = "#222" }}
            >
              {name}
            </button>
          ))}
        </div>
      </div>

      {/* Layer rows */}
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
        <span style={{ fontSize: 10, color: "#555", letterSpacing: "0.1em" }}>RYTHME</span>
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
                fontSize: 10,
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
            label="vol"
            value={rhythmVolume}
            onChange={onRhythmVolumeChange}
            color="#4a8abf"
          />
        )}
      </div>
    </div>
  )
}

// ── LayerRow ─────────────────────────────────────────────────────────────────

function LayerRow({ layer, onChange }) {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      gap: 5,
      opacity: layer.enabled ? 1 : 0.38,
      transition: "opacity 0.2s",
    }}>
      {/* Row: toggle + name + selectors */}
      <div style={{ display: "flex", alignItems: "center", gap: 7, flexWrap: "wrap" }}>
        <ToggleDot enabled={layer.enabled} onClick={() => onChange({ enabled: !layer.enabled })} />

        <span style={{ fontSize: 10, color: "#aaa", minWidth: 60, letterSpacing: "0.04em" }}>
          {layer.name}
        </span>

        <Select
          options={WAVE_OPTIONS}
          value={layer.waveType}
          onChange={v => onChange({ waveType: v })}
          disabled={!layer.enabled}
        />

        <ModeSelect
          value={layer.playMode}
          onChange={v => onChange({ playMode: v })}
          disabled={!layer.enabled}
        />

        <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
          <span style={{ fontSize: 9, color: "#444" }}>oct</span>
          <Select
            options={OCTAVE_OPTIONS.map(o => ({ value: o, label: String(o) }))}
            value={layer.octave}
            onChange={v => onChange({ octave: Number(v) })}
            disabled={!layer.enabled}
          />
        </div>
      </div>

      {/* Volume slider */}
      {layer.enabled && (
        <VolumeSlider
          label="vol"
          value={layer.volume}
          onChange={v => onChange({ volume: v })}
          color="#666"
        />
      )}
    </div>
  )
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ToggleDot({ enabled, onClick }) {
  return (
    <button
      onClick={onClick}
      title={enabled ? "Désactiver" : "Activer"}
      style={{
        width: 12, height: 12, borderRadius: "50%", flexShrink: 0,
        border: `2px solid ${enabled ? "#4abf8a" : "#333"}`,
        background: enabled ? "#4abf8a" : "transparent",
        cursor: "pointer", padding: 0,
      }}
    />
  )
}

function Select({ options, value, onChange, disabled }) {
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      style={{
        background: "#1a1a1a", border: "1px solid #222", borderRadius: 4,
        color: disabled ? "#333" : "#aaa",
        fontSize: 10, padding: "2px 4px", cursor: disabled ? "default" : "pointer",
        fontFamily: "'Courier New', monospace", letterSpacing: "0.03em",
      }}
    >
      {options.map(({ value: v, label }) => (
        <option key={v} value={v}>{label}</option>
      ))}
    </select>
  )
}

function ModeSelect({ value, onChange, disabled }) {
  const current = PLAY_MODES.find(m => m.value === value)
  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      disabled={disabled}
      title={current?.desc ?? ""}
      style={{
        background: "#1a1a1a", border: "1px solid #222", borderRadius: 4,
        color: disabled ? "#333" : "#8abf8a",
        fontSize: 10, padding: "2px 4px", cursor: disabled ? "default" : "pointer",
        fontFamily: "'Courier New', monospace", letterSpacing: "0.03em",
        minWidth: 68,
      }}
    >
      {PLAY_MODES.map(({ value: v, label }) => (
        <option key={v} value={v}>{label}</option>
      ))}
    </select>
  )
}

function VolumeSlider({ label, value, onChange, color = "#888" }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, paddingLeft: 19 }}>
      <span style={{ fontSize: 9, color: "#3a3a3a", minWidth: 18 }}>{label}</span>
      <input
        type="range" min={0} max={100} step={1}
        value={Math.round(value * 100)}
        onChange={e => onChange(Number(e.target.value) / 100)}
        style={{ flex: 1, accentColor: color, cursor: "pointer", height: 3 }}
      />
      <span style={{ fontSize: 9, color: "#3a3a3a", minWidth: 28, textAlign: "right" }}>
        {Math.round(value * 100)}%
      </span>
    </div>
  )
}
