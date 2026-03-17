import { NOTES } from "./constants"

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

export function buildGroupedChords(notes, chordTypes) {
  return notes.map(note => ({
    note,
    chords: chordTypes.map(type => ({ name: `${note}${type.suffix}`, root: note, intervals: type.intervals })),
  }))
}
