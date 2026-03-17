import { NOTE_COLORS, CHORD_TYPES, TEXT } from "../constants"
import { ChordChip } from "./ChordChip"

// Fixed column template: one column per chord type, always aligned
const COLS = `20px repeat(${CHORD_TYPES.length}, minmax(44px, 1fr))`

export function ChordGrid({ groupedChords, allChords, selectedChordName, timelineNameSet, suggestions, showSuggestions, onChordClick, onChordContextMenu, onChordDragStart }) {
  return (
    <section style={{ paddingBottom: 16 }}>
      {/* Header row — type labels */}
      <div style={{ display: "grid", gridTemplateColumns: COLS, gap: "3px 3px", marginBottom: 4 }}>
        <div />
        {CHORD_TYPES.map(t => (
          <div key={t.suffix} style={{ fontSize: 9, color: TEXT.faint, textAlign: "center", letterSpacing: "0.02em" }}>
            {t.suffix || "M"}
          </div>
        ))}
      </div>

      <div style={{ display: "grid", gap: 3 }}>
        {groupedChords.map(group => (
          <div key={group.note} style={{ display: "grid", gridTemplateColumns: COLS, gap: "3px 3px", alignItems: "center" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: NOTE_COLORS[group.note], textAlign: "right", paddingRight: 2 }}>
              {group.note}
            </span>
            {group.chords.map(chord => (
              <ChordChip
                key={chord.name}
                chord={chord}
                isActive={selectedChordName === chord.name}
                isInTimeline={timelineNameSet.has(chord.name)}
                suggestionScore={showSuggestions ? (suggestions.get(chord.name) ?? 0) : 0}
                draggable
                onDragStart={e => onChordDragStart(e, chord)}
                onClick={() => onChordClick(chord)}
                onContextMenu={e => { e.preventDefault(); onChordContextMenu(chord) }}
              />
            ))}
          </div>
        ))}
      </div>
    </section>
  )
}
