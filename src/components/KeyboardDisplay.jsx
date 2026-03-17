import { TEXT, NOTE_TO_PC } from "../constants"

const WHITE_PATTERN = ["C","D","E","F","G","A","B"]
const BLACK_PATTERN = [
  { note: "C#", slot: 0.65 },
  { note: "Eb", slot: 1.65 },
  // gap at E/F — no black key at slot 2.xx
  { note: "F#", slot: 3.65 },
  { note: "Ab", slot: 4.65 },
  { note: "Bb", slot: 5.65 },
]

// Build a flat list of all keys across the given octaves
function buildKeys(octaves) {
  const whites = [], blacks = []
  octaves.forEach((oct, octIdx) => {
    WHITE_PATTERN.forEach((note, wi) => {
      whites.push({ note, oct, globalIndex: octIdx * 7 + wi })
    })
    BLACK_PATTERN.forEach(({ note, slot }) => {
      blacks.push({ note, oct, globalSlot: octIdx * 7 + slot })
    })
  })
  return { whites, blacks }
}

export function KeyboardDisplay({
  octaves = [3, 4],
  isPlayedPitchWithOct,
  isSelectedPitchWithOct,
  onNoteClick,
  selectedChordName,
  selectedChordColor,
  keyboardActiveNotes = new Set(),
  recognizedChord = null,
  recognizedChordColor,
  onClearKeyboardNotes,
  onRecognizedChordClick,
}) {
  const KEY_W = 32
  const KEY_H = 100
  const BK_H  = 62
  const BK_W  = 19

  const { whites, blacks } = buildKeys(octaves)
  const TOTAL_WHITE = octaves.length * 7
  const hasActive = keyboardActiveNotes.size > 0

  // Key color priority: played > active (recognition) > selected (chord grid) > default
  function whiteKeyBg(note, oct) {
    if (isPlayedPitchWithOct(NOTE_TO_PC[note], oct)) return "#ffcf66"
    if (keyboardActiveNotes.has(NOTE_TO_PC[note])) return "#6ee7b7"
    if (isSelectedPitchWithOct(NOTE_TO_PC[note], oct)) return "#9fd3ff"
    return "#e4e4e4"
  }
  function blackKeyBg(note, oct) {
    if (isPlayedPitchWithOct(NOTE_TO_PC[note], oct)) return "#ffb933"
    if (keyboardActiveNotes.has(NOTE_TO_PC[note])) return "#34d399"
    if (isSelectedPitchWithOct(NOTE_TO_PC[note], oct)) return "#3b82f6"
    return "#1a1a1a"
  }

  return (
    <div style={{ background: "#0f0f0f", borderRadius: 10, border: "1px solid #1e1e1e", padding: "10px 12px", flexShrink: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8 }}>
        <p style={{ margin: 0, fontSize: 11, color: TEXT.muted, letterSpacing: "0.1em" }}>KEYBOARD</p>

        {hasActive ? (
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {recognizedChord ? (
              <button
                onClick={() => onRecognizedChordClick?.(recognizedChord)}
                title="Select this chord"
                style={{
                  background: `${recognizedChordColor}22`,
                  border: `1.5px solid ${recognizedChordColor}99`,
                  color: recognizedChordColor,
                  borderRadius: 5, padding: "2px 8px",
                  fontSize: 12, fontFamily: "inherit", fontWeight: 700,
                  cursor: "pointer", letterSpacing: "0.03em",
                }}
              >
                {recognizedChord.name}
              </button>
            ) : (
              <span style={{ fontSize: 11, color: TEXT.muted }}>
                {keyboardActiveNotes.size} note{keyboardActiveNotes.size > 1 ? "s" : ""}…
              </span>
            )}
            <button
              onClick={onClearKeyboardNotes}
              title="Clear selected notes"
              style={{
                background: "none", border: "1px solid #333", color: TEXT.muted,
                borderRadius: 4, padding: "1px 6px", fontSize: 10,
                fontFamily: "inherit", cursor: "pointer",
              }}
            >
              ✕
            </button>
          </div>
        ) : (
          <span style={{ fontSize: 12, color: selectedChordName ? selectedChordColor : TEXT.faint, fontWeight: 700 }}>
            {selectedChordName || "—"}
          </span>
        )}
      </div>

      <div style={{ position: "relative", width: TOTAL_WHITE * KEY_W, height: KEY_H, userSelect: "none" }}>
        {/* White keys */}
        <div style={{ display: "flex", position: "absolute", inset: 0 }}>
          {whites.map(({ note, oct }) => (
            <div
              key={`${note}${oct}`}
              onClick={() => onNoteClick(note, oct)}
              style={{
                width: KEY_W, height: KEY_H, flexShrink: 0,
                border: "1px solid #333",
                background: whiteKeyBg(note, oct),
                color: "#222", display: "flex", alignItems: "flex-end",
                justifyContent: "center", paddingBottom: 5,
                cursor: "pointer", boxSizing: "border-box",
                borderRadius: "0 0 4px 4px",
                transition: "background 0.08s",
              }}
            >
              <span style={{ fontSize: 8, fontWeight: 700 }}>{note}{oct}</span>
            </div>
          ))}
        </div>

        {/* Black keys */}
        {blacks.map(({ note, oct, globalSlot }) => (
          <div
            key={`${note}${oct}`}
            onClick={() => onNoteClick(note, oct)}
            style={{
              position: "absolute",
              left: globalSlot * KEY_W + (KEY_W - BK_W) / 2,
              top: 0,
              width: BK_W, height: BK_H,
              background: blackKeyBg(note, oct),
              border: "1px solid #555",
              borderRadius: "0 0 4px 4px",
              cursor: "pointer",
              zIndex: 2,
              display: "flex", alignItems: "flex-end", justifyContent: "center",
              paddingBottom: 4, boxSizing: "border-box",
              transition: "background 0.08s",
            }}
          >
            <span style={{ fontSize: 7, color: "#aaa", fontWeight: 700 }}>{note}</span>
          </div>
        ))}
      </div>
      <p style={{ margin: "5px 0 0", fontSize: 10, color: TEXT.faint }}>
        C{octaves[0]} – B{octaves[octaves.length - 1]} · click notes to recognize a chord
      </p>
    </div>
  )
}
