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

export function KeyboardDisplay({ octaves = [3, 4], isPlayedPitchWithOct, isSelectedPitchWithOct, onNoteClick, selectedChordName, selectedChordColor }) {
  const KEY_W = 32
  const KEY_H = 100
  const BK_H  = 62
  const BK_W  = 19

  const { whites, blacks } = buildKeys(octaves)
  const TOTAL_WHITE = octaves.length * 7

  return (
    <div style={{ background: "#0f0f0f", borderRadius: 10, border: "1px solid #1e1e1e", padding: "10px 12px", flexShrink: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8 }}>
        <p style={{ margin: 0, fontSize: 11, color: TEXT.muted, letterSpacing: "0.1em" }}>KEYBOARD</p>
        <span style={{ fontSize: 12, color: selectedChordName ? selectedChordColor : TEXT.faint, fontWeight: 700 }}>
          {selectedChordName || "—"}
        </span>
      </div>

      <div style={{ position: "relative", width: TOTAL_WHITE * KEY_W, height: KEY_H, userSelect: "none" }}>
        {/* White keys */}
        <div style={{ display: "flex", position: "absolute", inset: 0 }}>
          {whites.map(({ note, oct }) => {
            const played = isPlayedPitchWithOct(NOTE_TO_PC[note], oct)
            const sel    = isSelectedPitchWithOct(NOTE_TO_PC[note], oct)
            return (
              <div
                key={`${note}${oct}`}
                onClick={() => onNoteClick(note, oct)}
                style={{
                  width: KEY_W, height: KEY_H, flexShrink: 0,
                  border: "1px solid #333",
                  background: played ? "#ffcf66" : sel ? "#9fd3ff" : "#e4e4e4",
                  color: "#222", display: "flex", alignItems: "flex-end",
                  justifyContent: "center", paddingBottom: 5,
                  cursor: "pointer", boxSizing: "border-box",
                  borderRadius: "0 0 4px 4px",
                  transition: "background 0.08s",
                }}
              >
                <span style={{ fontSize: 8, fontWeight: 700 }}>{note}{oct}</span>
              </div>
            )
          })}
        </div>

        {/* Black keys */}
        {blacks.map(({ note, oct, globalSlot }) => {
          const played = isPlayedPitchWithOct(NOTE_TO_PC[note], oct)
          const sel    = isSelectedPitchWithOct(NOTE_TO_PC[note], oct)
          return (
            <div
              key={`${note}${oct}`}
              onClick={() => onNoteClick(note, oct)}
              style={{
                position: "absolute",
                left: globalSlot * KEY_W + (KEY_W - BK_W) / 2,
                top: 0,
                width: BK_W, height: BK_H,
                background: played ? "#ffb933" : sel ? "#3b82f6" : "#1a1a1a",
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
          )
        })}
      </div>
      <p style={{ margin: "5px 0 0", fontSize: 10, color: TEXT.faint }}>C{octaves[0]} – B{octaves[octaves.length - 1]} · click to play a note</p>
    </div>
  )
}
