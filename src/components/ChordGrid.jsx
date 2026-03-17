import { useState } from "react"
import { NOTE_COLORS, CHORD_TYPES, TEXT } from "../constants"
import { ChordChip } from "./ChordChip"

export function ChordGrid({ groupedChords, allChords, selectedChordName, timelineNameSet, suggestions, showSuggestions, onChordClick, onChordContextMenu, onChordDragStart }) {
  const [hiddenTypes, setHiddenTypes] = useState(new Set())

  function toggleType(suffix) {
    setHiddenTypes(prev => {
      const next = new Set(prev)
      next.has(suffix) ? next.delete(suffix) : next.add(suffix)
      return next
    })
  }

  const visibleTypes = CHORD_TYPES.filter(t => !hiddenTypes.has(t.suffix))
  const COLS = `20px repeat(${visibleTypes.length}, minmax(44px, 1fr))`

  return (
    <section style={{ paddingBottom: 16 }}>
      {/* Header row — also acts as filter toggles, aligned with columns */}
      <div style={{ display: "grid", gridTemplateColumns: COLS, gap: "3px 3px", marginBottom: 4 }}>
        <div />
        {visibleTypes.map(t => (
          <button
            key={t.suffix}
            onClick={() => toggleType(t.suffix)}
            style={{
              padding: "2px 4px", borderRadius: 4, fontSize: 9,
              fontFamily: "'Courier New', monospace", cursor: "pointer",
              border: "1px solid #444", background: "#222",
              color: TEXT.secondary, transition: "all 0.1s",
              textAlign: "center", letterSpacing: "0.02em",
            }}
          >
            {t.suffix || "M"}
          </button>
        ))}
      </div>

      {/* Hidden types — click to restore */}
      {hiddenTypes.size > 0 && (
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 6, alignItems: "center" }}>
          <span style={{ fontSize: 9, color: TEXT.faint }}>hidden:</span>
          {CHORD_TYPES.filter(t => hiddenTypes.has(t.suffix)).map(t => (
            <button
              key={t.suffix}
              onClick={() => toggleType(t.suffix)}
              style={{
                padding: "2px 6px", borderRadius: 4, fontSize: 9,
                fontFamily: "'Courier New', monospace", cursor: "pointer",
                border: "1px solid #2a2a2a", background: "#111",
                color: TEXT.faint, transition: "all 0.1s",
              }}
            >
              {t.suffix || "M"}
            </button>
          ))}
        </div>
      )}

      <div style={{ display: "grid", gap: 3 }}>
        {groupedChords.map(group => (
          <div key={group.note} style={{ display: "grid", gridTemplateColumns: COLS, gap: "3px 3px", alignItems: "center" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: NOTE_COLORS[group.note], textAlign: "right", paddingRight: 2 }}>
              {group.note}
            </span>
            {group.chords.filter(c => !hiddenTypes.has(c.name.slice(c.root.length))).map(chord => (
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
