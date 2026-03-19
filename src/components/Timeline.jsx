import { useDroppable } from "@dnd-kit/core"
import { SortableContext, horizontalListSortingStrategy } from "@dnd-kit/sortable"
import { TEXT } from "../constants"
import { t } from "../i18n"
import { TimelineChip } from "./TimelineChip"

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
  progression,
  detectedKey, showSuggestions, suggestions,
  loopMode, isPlaying, playingTimelineId,
  hasSaved, savedProgSummary,
  canUndo, onUndo,
  shareCopied, onShare,
  onToggleSuggestions, onToggleLoop,
  onRemove, onClear, onTogglePlayback, onLoadSaved, onExportMidi, onRandomize, onRandomizeOne,
  onChordPlay, notation = "english",
}) {
  const { setNodeRef, isOver } = useDroppable({ id: "timeline-zone" })

  return (
    <section>
      {/* Header row */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6, flexWrap: "wrap" }}>
        <span style={{ fontSize: 12, letterSpacing: "0.12em", color: TEXT.muted }}>{t("timeline", notation)}</span>
        {detectedKey && progression.length > 0 && (
          <span style={{ fontSize: 12, color: "#4a8abf" }}>
            {t("key", notation)} <strong>{detectedKey}</strong>
          </span>
        )}
        <div style={{ display: "flex", gap: 5, marginLeft: "auto", flexWrap: "wrap" }}>
          <BtnSmall onClick={onRandomize} title={t("generate4", notation)}>⚄</BtnSmall>
          <BtnSmall onClick={onRandomizeOne} title={t("addOne", notation)}>⚄+</BtnSmall>
          {progression.length > 0 && (
            <BtnSmall onClick={onToggleSuggestions} highlighted={showSuggestions}>
              {showSuggestions ? "◉ suggest" : "○ suggest"}
            </BtnSmall>
          )}
          <BtnSmall onClick={onToggleLoop} highlighted={loopMode} title={t("loopTooltip", notation)}>
            ⟳ loop
          </BtnSmall>
          <BtnSmall onClick={onTogglePlayback} active={progression.length > 0}>
            {isPlaying ? "■ stop" : "▶ play"}
          </BtnSmall>
          {progression.length > 0 && (
            <BtnSmall onClick={onExportMidi} title={t("exportMidi", notation)}>
              ↓ midi
            </BtnSmall>
          )}
          {hasSaved && (
            <BtnSmall onClick={onLoadSaved} title={`${t("loadPrefix", notation)}${savedProgSummary}${savedProgSummary ? "…" : ""}`}>
              ↩ restore
            </BtnSmall>
          )}
          {progression.length > 0 && (
            <BtnSmall onClick={onShare} highlighted={shareCopied}>
              {shareCopied ? "✓ copied!" : "⤴ share"}
            </BtnSmall>
          )}
          <BtnSmall onClick={onUndo} active={canUndo} title="Undo">↩︎</BtnSmall>
          <BtnSmall onClick={onClear}>✕</BtnSmall>
        </div>
      </div>

      {/* Drop zone */}
      <SortableContext items={progression.map(e => e.id)} strategy={horizontalListSortingStrategy}>
        <div
          ref={setNodeRef}
          style={{
            minHeight: 80, borderRadius: 10,
            border: isOver ? "1.5px dashed #4a8abf" : "1.5px dashed #222",
            background: isOver ? "#0a1520" : "#0f0f0f",
            padding: "8px 10px",
            display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap",
            transition: "border 0.12s, background 0.12s",
          }}
        >
          {progression.length === 0 ? (
            <span style={{ color: TEXT.faint, fontSize: 13 }}>{t("dragHere", notation)}</span>
          ) : (
            progression.map((entry, i) => (
              <div key={entry.id} style={{ display: "flex", alignItems: "center" }}>
                <TimelineChip
                  chord={entry}
                  index={i}
                  isPlaying={playingTimelineId === entry.id}
                  onPlay={onChordPlay}
                  onRemove={() => onRemove(i)}
                  notation={notation}
                />
                {i < progression.length - 1 && (
                  <span style={{ color: TEXT.faint, fontSize: 14, userSelect: "none", margin: "0 2px" }}>›</span>
                )}
              </div>
            ))
          )}
        </div>
      </SortableContext>

      {/* Suggestion hint */}
      {showSuggestions && progression.length > 0 && suggestions.size > 0 && (
        <div style={{ marginTop: 5, fontSize: 11, color: TEXT.muted, lineHeight: 1.5 }}>
          {t("suggHint", notation)}
        </div>
      )}
    </section>
  )
}
