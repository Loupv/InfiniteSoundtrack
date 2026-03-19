import { NOTES, NOTE_FR, PC_NAMES_FR } from "./constants"

// Given a Set of pitch classes (0–11), find the best matching chord.
// Uses Jaccard similarity; returns null if no chord scores ≥ 0.5.
export function recognizeChord(pitchClassSet, allChords) {
  if (pitchClassSet.size < 2) return null
  let best = null, bestScore = -1
  for (const chord of allChords) {
    const rootPc = NOTES.indexOf(chord.root)
    const chordPcs = new Set(chord.intervals.map(i => (rootPc + i) % 12))
    const input = [...pitchClassSet]
    const intersection = input.filter(pc => chordPcs.has(pc)).length
    const union = new Set([...input, ...chordPcs]).size
    const score = intersection / union
    if (score > bestScore) { bestScore = score; best = chord }
  }
  return bestScore >= 0.5 ? best : null
}

export function noteToMidi(note, octave = 4) {
  return 12 * (octave + 1) + NOTES.indexOf(note)
}

export function midiToFreq(midi) {
  return 440 * Math.pow(2, (midi - 69) / 12)
}

export function buildChordMidi(root, intervals) {
  const base = noteToMidi(root, 4)
  return intervals.map(i => base + i)
}

export function midiToPitchClass(midi) {
  return ((midi % 12) + 12) % 12
}

export function chordPitchClasses(chord) {
  return new Set(buildChordMidi(chord.root, chord.intervals).map(midiToPitchClass))
}

export function buildAllChords(notes, chordTypes) {
  return notes.flatMap(note =>
    chordTypes.map(type => ({ name: `${note}${type.suffix}`, root: note, intervals: type.intervals }))
  )
}

// Convert a chord name like "Em" → "Mim" for French notation.
// root must be passed separately because it may be 2 chars (e.g. "C#").
export function chordDisplayName(chordName, root, notation) {
  if (notation !== "french") return chordName
  const fr = NOTE_FR[root]
  return fr ? fr + chordName.slice(root.length) : chordName
}

// Convert a note-name+octave string like "C#4" → "Do#4"
export function noteDisplayName(nameOct, notation) {
  if (notation !== "french") return nameOct
  // Try 2-char roots first, then 1-char
  for (const len of [2, 1]) {
    const root = nameOct.slice(0, len)
    if (NOTE_FR[root]) return NOTE_FR[root] + nameOct.slice(len)
  }
  return nameOct
}

// French name for a pitch class (0–11) used in note cards
export function pcDisplayName(pc, notation) {
  if (notation !== "french") return ["C","C#","D","Eb","E","F","F#","G","Ab","A","Bb","B"][pc]
  return PC_NAMES_FR[pc]
}

// Spell a chord tone correctly using functional harmony (e.g. C# + 4st = E#, not F).
// rootName: e.g. "C#", "Bb". semitones: interval from root (may exceed 11 for octave+ spans).
const _LETTERS    = ["C","D","E","F","G","A","B"]
const _LETTER_PC  = [0, 2, 4, 5, 7, 9, 11]
// Semitones mod 12 → diatonic degree offset within an octave.
// interval 8 maps to degree 4 (augmented 5th, as in aug chord) rather than degree 5 (minor 6th).
// interval 6 maps to degree 4 (diminished 5th, as in dim chord).
const _SEM_DEG    = [0, 1, 1, 2, 2, 3, 4, 4, 4, 5, 6, 6]
const _LETTER_FR  = { C:"Do", D:"Ré", E:"Mi", F:"Fa", G:"Sol", A:"La", B:"Si" }

export function spellNote(rootName, semitones, notation = "english") {
  const rootLetter   = rootName[0]
  const rootAccVal   = [...rootName.slice(1)].reduce((s, c) => s + (c === "#" ? 1 : c === "b" ? -1 : 0), 0)
  const rootLetterIdx = _LETTERS.indexOf(rootLetter)
  const rootPc       = ((_LETTER_PC[rootLetterIdx] + rootAccVal) % 12 + 12) % 12

  const targetPc      = ((rootPc + semitones) % 12 + 12) % 12
  const degreeOffset  = _SEM_DEG[semitones % 12] + 7 * Math.floor(semitones / 12)
  const tgtLetterIdx  = (rootLetterIdx + degreeOffset) % 7
  const tgtLetter     = _LETTERS[tgtLetterIdx]
  const tgtNaturalPc  = _LETTER_PC[tgtLetterIdx]

  let acc = ((targetPc - tgtNaturalPc) % 12 + 12) % 12
  if (acc > 6) acc -= 12
  const accStr = acc === 0 ? "" : acc === 1 ? "#" : acc === 2 ? "##" : acc === -1 ? "b" : acc === -2 ? "bb" : "?"

  if (notation === "french") return (_LETTER_FR[tgtLetter] ?? tgtLetter) + accStr
  return tgtLetter + accStr
}

export function buildGroupedChords(notes, chordTypes) {
  return notes.map(note => ({
    note,
    chords: chordTypes.map(type => ({ name: `${note}${type.suffix}`, root: note, intervals: type.intervals })),
  }))
}
