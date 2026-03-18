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

export function buildGroupedChords(notes, chordTypes) {
  return notes.map(note => ({
    note,
    chords: chordTypes.map(type => ({ name: `${note}${type.suffix}`, root: note, intervals: type.intervals })),
  }))
}
