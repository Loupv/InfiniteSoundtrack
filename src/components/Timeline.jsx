import { TEXT } from "../constants"
import { TimelineChip, DropIndicator } from "./TimelineChip"

function BtnSmall({ onClick, active = true, highlighted = false, children, title }) {
  return (
    <button onClick={onClick} disabled={!active} title={title} style={{
      padding: "5px 10px", borderRadius: 6, fontSize: 12,
      fontFamily: "'Courier New', monospace", letterSpacing: "0.04em",
      cursor: active ? "pointer" : "default",
      border:     highlighted ? "1px solid #4a8abf" : "1px solid #2a2a2a",
      background: highlighted ? "#0e1a24" : active ? "#1a1a1a" : "#111",
      color:      highlighted ? "#4a8abf" : active ? TEXT.secondary : TEXT.faint,
      transition: "border 0.12s, background 0.12s, color 0.12s",
    }}>{children}</button>
  )
}

export function Timeline({
  progression, dragOverIndex, timelineDropActive,
  detectedKey, showSuggestions, suggestions,
  loopMode, isPlaying, playingTimelineId,
  hasSaved, savedProgSummary,
  onToggleSuggestions, onToggleLoop,
  onRemove, onClear, onTogglePlayback, onLoadSaved, onExportMidi,
  onTimelineDragStart,
  onSlotDragOver, onZoneDragOver, onZoneDragLeave, onZoneDrop,
  onChordPlay, notation = "english",
}) {
  return (
    <section>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, letterSpacing: "0.12em", color: TEXT.muted }}>TIMELINE</span>
        {detectedKey && progression.length > 0 && (
          <span style={{ fontSize: 12, color: "#4a8abf" }}>
            key: <strong>{detectedKey}</strong>
          </span>
        )}
        <div style={{ display: "flex", gap: 5, marginLeft: "auto", flexWrap: "wrap" }}>
          {progression.length > 0 && (
            <BtnSmall onClick={onToggleSuggestions} highlighted={showSuggestions}>
              {showSuggestions ? "◉ suggest" : "○ suggest"}
            </BtnSmall>
          )}
          <BtnSmall onClick={onToggleLoop} highlighted={loopMode} title="Loop — replay continuously">
            ⟳ loop
          </BtnSmall>
          <BtnSmall onClick={onTogglePlayback} active={progression.length > 0}>
            {isPlaying ? "■ stop" : "▶ play"}
          </BtnSmall>
          {progression.length > 0 && (
            <BtnSmall onClick={onExportMidi} title="Export as MIDI file">
              ↓ midi
            </BtnSmall>
          )}
          {hasSaved && (
            <BtnSmall onClick={onLoadSaved} title={`Load: ${savedProgSummary}${savedProgSummary ? "…" : ""}`}>
              ↩ restore
            </BtnSmall>
          )}
          <BtnSmall onClick={onClear}>✕</BtnSmall>
        </div>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={onZoneDragOver}
        onDragLeave={onZoneDragLeave}
        onDrop={onZoneDrop}
        style={{
          minHeight: 80, borderRadius: 10,
          border: timelineDropActive ? "1.5px dashed #4a8abf" : "1.5px dashed #222",
          background: timelineDropActive ? "#0a1520" : "#0f0f0f",
          padding: "8px 10px",
          display: "flex", alignItems: "center", gap: 0, flexWrap: "wrap",
          transition: "border 0.12s, background 0.12s",
        }}
      >
        {progression.length === 0 ? (
          <div
            onDragOver={e => onSlotDragOver(e, 0)}
            style={{ flex: 1, minHeight: 52, display: "flex", alignItems: "center" }}
          >
            <span style={{ color: TEXT.faint, fontSize: 13 }}>Drag chords here…</span>
          </div>
        ) : (
          <>
            <Slot index={0} dragOverIndex={dragOverIndex} onSlotDragOver={onSlotDragOver} />
            {progression.map((entry, i) => (
              <div key={entry.id} style={{ display: "flex", alignItems: "center" }}>
                <TimelineChip
                  chord={entry} index={i}
                  isPlaying={playingTimelineId === entry.id}
                  onPlay={onChordPlay}
                  onRemove={() => onRemove(i)}
                  onDragStart={onTimelineDragStart}
                  notation={notation}
                />
                <div style={{ display: "flex", alignItems: "center" }}>
                  {i < progression.length - 1 && dragOverIndex !== i + 1 && (
                    <span style={{ color: TEXT.faint, fontSize: 14, userSelect: "none", margin: "0 2px" }}>›</span>
                  )}
                  <Slot index={i + 1} dragOverIndex={dragOverIndex} onSlotDragOver={onSlotDragOver} />
                </div>
              </div>
            ))}
          </>
        )}
      </div>

      {/* Suggestion hint */}
      {showSuggestions && progression.length > 0 && suggestions.size > 0 && (
        <div style={{ marginTop: 5, fontSize: 11, color: TEXT.muted, lineHeight: 1.5 }}>
          Chords with a coloured border are suggested next chords — brighter = stronger fit (voice-leading, scale, tritone subs).
        </div>
      )}
    </section>
  )
}

function Slot({ index, dragOverIndex, onSlotDragOver }) {
  const active = dragOverIndex === index
  return (
    <div
      onDragOver={e => onSlotDragOver(e, index)}
      style={{
        width: active ? 14 : 6, height: 52,
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0, transition: "width 0.1s",
      }}
    >
      {active && <DropIndicator />}
    </div>
  )
}
