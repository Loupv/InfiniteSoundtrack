import { NOTES } from "./constants"

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
