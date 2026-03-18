import { NOTE_COLORS, DURATIONS } from "../constants"
import { chordDisplayName } from "../musicUtils"

export function DropIndicator() {
  return (
    <div style={{
      width: 2, alignSelf: "stretch", minHeight: 52,
      background: "#4a8abf", borderRadius: 2,
      boxShadow: "0 0 6px #4a8abf", flexShrink: 0,
    }} />
  )
}

export function TimelineChip({ chord, index, isPlaying, onPlay, onRemove, onDragStart, notation = "english" }) {
  const color  = NOTE_COLORS[chord.root] ?? "#888"
  const beats  = chord.beats ?? 1
  const displayName = chordDisplayName(chord.name, chord.root, notation)
  const dur    = DURATIONS.find(d => d.beats === beats) ?? DURATIONS[2]
  // Width scales proportionally with duration: 72px per beat
  const chipW  = Math.max(28, Math.min(200, Math.round(72 * beats)))

  return (
    <div
      draggable
      onDragStart={e => onDragStart(e, index)}
      style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 4, cursor: "grab" }}
    >
      <div
        onClick={() => onPlay(chord)}
        style={{
          position: "relative",
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          padding: "9px 6px", width: chipW, minHeight: 48, borderRadius: 10,
          fontFamily: "'Courier New', monospace", fontSize: 13, fontWeight: 700,
          background: isPlaying ? color : `${color}1a`,
          color: isPlaying ? "#fff" : color,
          border: `2px solid ${color}`,
          boxShadow: isPlaying ? `0 0 14px ${color}88` : "none",
          transition: "all 0.12s", userSelect: "none",
          flexDirection: "column", gap: 2,
        }}
      >
        <span style={{ fontSize: Math.max(9, 13 - Math.max(0, displayName.length - 4)) }}>{displayName}</span>
        <span style={{ fontSize: 9, opacity: 0.6 }}>{dur.label}</span>
        {(chord.inversion ?? 0) > 0 && (
          <span style={{ fontSize: 8, opacity: 0.7, position: "absolute", bottom: 3, right: 4 }}>
            {chord.inversion === 1 ? "1st" : chord.inversion === 2 ? "2nd" : chord.inversion === 3 ? "3rd" : `${chord.inversion}th`}
          </span>
        )}
      </div>
      <button
        onClick={onRemove}
        style={{
          width: 16, height: 16, borderRadius: "50%", border: "1px solid #333",
          background: "#1e1e1e", color: "#777", fontSize: 9,
          cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", padding: 0,
        }}
      >✕</button>
    </div>
  )
}
