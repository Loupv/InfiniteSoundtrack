import { NOTE_COLORS, TEXT, DURATIONS } from "../constants"
import { buildChordMidi, chordDisplayName, spellNote } from "../musicUtils"
import { t, durName } from "../i18n"

const PC_NAMES = ["C","C#","D","Eb","E","F","F#","G","Ab","A","Bb","B"]

const INTERVAL_NAMES = {
  0:"R", 1:"♭2", 2:"2", 3:"♭3", 4:"3", 5:"4",
  6:"♭5", 7:"5", 8:"♭6", 9:"6", 10:"♭7", 11:"7",
}

function intervalLabel(semitones) {
  const norm = ((semitones % 12) + 12) % 12
  const extra = Math.floor(semitones / 12)
  return extra > 0 ? `${INTERVAL_NAMES[norm] ?? "?"}+${extra}oct` : (INTERVAL_NAMES[norm] ?? `+${semitones}`)
}

/**
 * Rotate intervals by `n` positions (inversion).
 * Each rotation takes the lowest note and raises it by one octave.
 * Returns new interval array relative to the same root midi.
 */
function invertIntervals(intervals, n) {
  if (n === 0) return intervals
  const count = intervals.length
  const rot = ((n % count) + count) % count
  // Move the first `rot` notes up by one octave — intervals stay relative to original root
  return [...intervals.slice(rot), ...intervals.slice(0, rot).map(i => i + 12)]
}

function inversionLabel(n, notation) {
  if (n === 0) return t("invRoot", notation)
  if (n === 1) return t("inv1st", notation)
  if (n === 2) return t("inv2nd", notation)
  if (n === 3) return t("inv3rd", notation)
  return `${n}th`
}

function SmallBtn({ onClick, children, title, disabled }) {
  return (
    <button onClick={onClick} disabled={disabled} title={title} style={{
      width: 22, height: 22, borderRadius: 5, padding: 0,
      border: "1px solid #2e2e2e", background: disabled ? "#141414" : "#1e1e1e",
      color: disabled ? TEXT.faint : TEXT.secondary,
      fontSize: 13, cursor: disabled ? "default" : "pointer",
      display: "inline-flex", alignItems: "center", justifyContent: "center",
      fontFamily: "monospace", lineHeight: 1, flexShrink: 0,
    }}>{children}</button>
  )
}

export function ChordDetail({ chord, octave, inversion, beats = 1, notation = "english", onOctaveChange, onInversionChange, onBeatsChange, onPlay }) {
  if (!chord) {
    return (
      <div style={{
        background: "#0f0f0f", border: "1px solid #1e1e1e", borderRadius: 10,
        padding: "10px 14px", display: "flex", alignItems: "center", justifyContent: "center",
        minWidth: 260, flex: "0 0 260px",
      }}>
        <span style={{ fontSize: 12, color: TEXT.faint }}>{t("selectChord", notation)}</span>
      </div>
    )
  }

  const color    = NOTE_COLORS[chord.root] ?? "#888"
  const maxInv   = chord.intervals.length - 1
  const invIntervals = invertIntervals(chord.intervals, inversion)
  const octShift = (octave - 4) * 12
  const midiNotes = buildChordMidi(chord.root, invIntervals).map(m => m + octShift)

  const noteCards = midiNotes.map((midi, i) => ({
    name:     `${spellNote(chord.root, invIntervals[i], notation)}${Math.floor(midi / 12) - 1}`,
    interval: intervalLabel(invIntervals[i]),
    isBass:   i === 0,
  }))

  return (
    <div style={{
      background: "#0f0f0f", border: `1px solid ${color}44`, borderRadius: 10,
      padding: "10px 14px", minWidth: 260, flex: "0 0 auto",
    }}>
      {/* Title */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{ fontSize: 16, fontWeight: 700, color, letterSpacing: "0.04em" }}>{chordDisplayName(chord.name, chord.root, notation)}</span>
        <span style={{ fontSize: 10, color: TEXT.faint }}>{chord.intervals.length} notes</span>
        <button
          onClick={() => onPlay(chord, octave, inversion)}
          style={{
            marginLeft: "auto", padding: "3px 9px", borderRadius: 5,
            border: `1px solid ${color}55`, background: `${color}1a`,
            color, fontSize: 11, fontFamily: "'Courier New', monospace", cursor: "pointer",
          }}
        >▶</button>
      </div>

      {/* Note cards */}
      <div style={{ display: "flex", gap: 4, marginBottom: 10, flexWrap: "wrap" }}>
        {noteCards.map(({ name, interval, isBass }, i) => (
          <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
            <div style={{
              padding: "2px 6px", borderRadius: 4, fontSize: 11, fontWeight: 700,
              background: isBass ? color : `${color}20`,
              color: isBass ? "#fff" : color,
              border: `1px solid ${color}44`,
            }}>{name}</div>
            <span style={{ fontSize: 9, color: TEXT.faint }}>{interval}</span>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {/* Octave */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 10, color: TEXT.muted, width: 58, flexShrink: 0 }}>{t("octave", notation)}</span>
          <SmallBtn onClick={() => onOctaveChange(Math.max(1, octave - 1))}>−</SmallBtn>
          <span style={{ fontSize: 12, fontWeight: 700, color: TEXT.primary, width: 16, textAlign: "center" }}>{octave}</span>
          <SmallBtn onClick={() => onOctaveChange(Math.min(7, octave + 1))}>+</SmallBtn>
        </div>

        {/* Inversion */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <span style={{ fontSize: 10, color: TEXT.muted, width: 58, flexShrink: 0 }}>{t("inversion", notation)}</span>
          <SmallBtn
            onClick={() => onInversionChange(inversion - 1)}
            disabled={inversion === 0}
            title={t("prevInversion", notation)}
          >−</SmallBtn>
          <span style={{
            fontSize: 10, color: inversion === 0 ? TEXT.faint : TEXT.primary,
            width: 56, textAlign: "center", flexShrink: 0,
          }}>
            {inversionLabel(inversion, notation)}
          </span>
          <SmallBtn
            onClick={() => onInversionChange(inversion + 1)}
            disabled={inversion >= maxInv}
            title={t("nextInversion", notation)}
          >+</SmallBtn>
          {inversion !== 0 && (
            <button
              onClick={() => onInversionChange(0)}
              style={{ fontSize: 9, color: TEXT.faint, background: "none", border: "none", cursor: "pointer", padding: 0 }}
            >{t("resetInv", notation)}</button>
          )}
        </div>

        {/* Duration */}
        {onBeatsChange && (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 10, color: TEXT.muted, width: 58, flexShrink: 0 }}>{t("duration", notation)}</span>
            <div style={{ display: "flex", gap: 3 }}>
              {DURATIONS.map(d => {
                const active = beats === d.beats
                return (
                  <button
                    key={d.beats}
                    onClick={() => onBeatsChange(d.beats)}
                    title={durName(d.beats, notation)}
                    style={{
                      width: 32, height: 24, borderRadius: 4, padding: 0,
                      border: active ? `1px solid ${color}` : "1px solid #2e2e2e",
                      background: active ? `${color}22` : "#1a1a1a",
                      color: active ? color : TEXT.faint,
                      fontSize: 13, cursor: "pointer",
                      display: "inline-flex", alignItems: "center", justifyContent: "center",
                      fontFamily: "system-ui, -apple-system, 'Segoe UI Symbol', 'Apple Symbols', sans-serif",
                    }}
                  >{d.label}</button>
                )
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
