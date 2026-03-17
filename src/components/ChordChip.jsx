import { NOTE_COLORS, TEXT, SUGGESTION_STYLE } from "../constants"

export function ChordChip({
  chord, isActive, isInTimeline, suggestionScore = 0,
  draggable, onDragStart, onClick, onContextMenu,
}) {
  const color = NOTE_COLORS[chord.root] ?? "#888"
  const has   = suggestionScore > 0

  // Much stronger visual graduation:
  // score 0.1 → faint tint; score 1.0 → solid bright background
  let bg, border, textColor, shadow
  if (isActive) {
    bg = color; border = `2px solid ${color}`; textColor = "#fff"
    shadow = `0 0 12px ${color}99`
  } else if (has) {
    // Power curve: squaring the score makes low-scoring chords nearly invisible
    // while high-scoring ones are bright and prominent
    const s = Math.pow(suggestionScore, 2)
    const bgAlpha  = Math.round(SUGGESTION_STYLE.BG_ALPHA_MIN  + s * SUGGESTION_STYLE.BG_ALPHA_RANGE)
    const bdrAlpha = Math.round(SUGGESTION_STYLE.BDR_ALPHA_MIN + s * SUGGESTION_STYLE.BDR_ALPHA_RANGE)
    const glowPx   = Math.round(SUGGESTION_STYLE.GLOW_PX_MIN   + s * SUGGESTION_STYLE.GLOW_PX_RANGE)
    bg        = `${color}${bgAlpha.toString(16).padStart(2, "0")}`
    border    = `${1 + s * 2.5}px solid ${color}${bdrAlpha.toString(16).padStart(2, "0")}`
    textColor = suggestionScore > 0.65 ? color : TEXT.secondary
    shadow    = `0 0 ${glowPx}px ${color}${Math.round(bdrAlpha * 0.7).toString(16).padStart(2, "0")}`
  } else if (isInTimeline) {
    bg = `${color}22`; border = `1.5px solid ${color}88`; textColor = color; shadow = "none"
  } else {
    bg = "#181818"; border = "1px solid #282828"; textColor = TEXT.secondary; shadow = "none"
  }

  return (
    <div
      draggable={draggable}
      onDragStart={onDragStart}
      onClick={onClick}
      onContextMenu={onContextMenu}
      title={`${chord.name}${has ? ` · suggestion ${Math.round(suggestionScore * 100)}%` : ""}`}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        padding: "4px 7px", minWidth: 42, minHeight: 30, borderRadius: 6,
        fontSize: 12, fontFamily: "'Courier New', monospace", fontWeight: 700,
        letterSpacing: "0.03em", cursor: draggable ? "grab" : "pointer", userSelect: "none",
        background: bg, color: textColor, border, boxShadow: shadow,
        transition: "background 0.15s, border 0.15s, color 0.15s, box-shadow 0.15s",
      }}
    >
      {chord.name}
    </div>
  )
}
