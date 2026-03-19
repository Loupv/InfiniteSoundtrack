import { useDraggable } from "@dnd-kit/core"
import { NOTE_COLORS, TEXT, SUGGESTION_STYLE } from "../constants"
import { chordDisplayName } from "../musicUtils"

export function ChordChip({
  chord, isActive, isInTimeline, suggestionScore = 0,
  notation = "english",
  onClick, onContextMenu,
}) {
  const color       = NOTE_COLORS[chord.root] ?? "#888"
  const displayName = chordDisplayName(chord.name, chord.root, notation)
  const has         = suggestionScore > 0

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: `grid:${chord.name}`,
    data: { type: "grid", chord },
  })

  let bg, border, textColor, shadow
  if (isActive) {
    bg = color; border = `2px solid ${color}`; textColor = "#fff"
    shadow = `0 0 12px ${color}99`
  } else if (has) {
    const s        = Math.pow(suggestionScore, 3)
    const bgAlpha  = Math.round(SUGGESTION_STYLE.BG_ALPHA_MIN  + s * SUGGESTION_STYLE.BG_ALPHA_RANGE)
    const bdrAlpha = Math.round(SUGGESTION_STYLE.BDR_ALPHA_MIN + s * SUGGESTION_STYLE.BDR_ALPHA_RANGE)
    const bdrWidth = (SUGGESTION_STYLE.BDR_WIDTH_MIN + s * SUGGESTION_STYLE.BDR_WIDTH_RANGE).toFixed(1)
    const glowPx   = Math.round(SUGGESTION_STYLE.GLOW_PX_MIN   + s * SUGGESTION_STYLE.GLOW_PX_RANGE)
    bg        = `${color}${bgAlpha.toString(16).padStart(2, "0")}`
    border    = `${bdrWidth}px solid ${color}${bdrAlpha.toString(16).padStart(2, "0")}`
    textColor = suggestionScore > 0.5 ? color : TEXT.secondary
    shadow    = `0 0 ${glowPx}px ${color}${Math.round(bdrAlpha * 0.7).toString(16).padStart(2, "0")}`
  } else if (isInTimeline) {
    bg = `${color}22`; border = `1.5px solid ${color}88`; textColor = color; shadow = "none"
  } else {
    bg = "#181818"; border = "1px solid #282828"; textColor = TEXT.secondary; shadow = "none"
  }

  return (
    <div
      ref={setNodeRef}
      onClick={onClick}
      onContextMenu={onContextMenu}
      title={`${displayName}${has ? ` · suggestion ${Math.round(suggestionScore * 100)}%` : ""}`}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        padding: "4px 7px", minWidth: 42, minHeight: 30, borderRadius: 6,
        fontSize: 12, fontFamily: "'Courier New', monospace", fontWeight: 700,
        letterSpacing: "0.03em", cursor: isDragging ? "grabbing" : "grab",
        userSelect: "none", touchAction: "none",
        background: bg, color: textColor, border, boxShadow: shadow,
        opacity: isDragging ? 0.4 : 1,
        transition: "background 0.15s, border 0.15s, color 0.15s, box-shadow 0.15s",
        transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
      }}
      {...attributes}
      {...listeners}
    >
      {displayName}
    </div>
  )
}
