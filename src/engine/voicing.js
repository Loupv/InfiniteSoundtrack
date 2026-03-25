import { NOTES } from "../constants"

// ── Voicing Engine ───────────────────────────────────────────────────────────
// Generates musical voicings with inversions, spread voicings, and
// voice-leading optimization between consecutive chords.

// ── Build all inversions of a chord in a given octave range ──────────────────

function buildVoicings(chord, baseOctave = 4) {
  const rootPc = NOTES.indexOf(chord.root)
  const intervals = chord.intervals
  const n = intervals.length

  const voicings = []

  // Root position and inversions
  for (let inv = 0; inv < n; inv++) {
    const notes = []
    for (let j = 0; j < n; j++) {
      const idx = (inv + j) % n
      let midi = rootPc + (baseOctave + 1) * 12 + intervals[idx]
      // Ensure notes go upward from bass
      while (notes.length > 0 && midi <= notes[notes.length - 1]) {
        midi += 12
      }
      notes.push(midi)
    }
    voicings.push({ notes, inversion: inv, type: "close" })
  }

  // Drop-2 voicings (take 2nd note from top, drop it an octave)
  if (n >= 4) {
    for (let inv = 0; inv < n; inv++) {
      const close = []
      for (let j = 0; j < n; j++) {
        const idx = (inv + j) % n
        let midi = rootPc + (baseOctave + 1) * 12 + intervals[idx]
        while (close.length > 0 && midi <= close[close.length - 1]) {
          midi += 12
        }
        close.push(midi)
      }
      // Drop the second-from-top note
      if (close.length >= 4) {
        const dropped = [...close]
        const dropNote = dropped[dropped.length - 2]
        dropped[dropped.length - 2] = dropNote - 12
        dropped.sort((a, b) => a - b)
        voicings.push({ notes: dropped, inversion: inv, type: "drop2" })
      }
    }
  }

  // Open/spread voicing: alternate notes up octaves for wider sound
  for (let inv = 0; inv < Math.min(n, 3); inv++) {
    const notes = []
    for (let j = 0; j < n; j++) {
      const idx = (inv + j) % n
      let midi = rootPc + (baseOctave + 1) * 12 + intervals[idx]
      // Spread: every other note goes up an octave
      if (j % 2 === 1 && j > 0) midi += 12
      while (notes.length > 0 && midi <= notes[notes.length - 1]) {
        midi += 12
      }
      notes.push(midi)
    }
    voicings.push({ notes, inversion: inv, type: "spread" })
  }

  return voicings
}

// ── Voice leading cost between two voicings ──────────────────────────────────

function voiceLeadingCost(voicingA, voicingB) {
  // Sum of minimal distances for each voice
  // Pad shorter voicing with repeated top/bottom
  const a = voicingA.notes
  const b = voicingB.notes
  const len = Math.max(a.length, b.length)

  let cost = 0
  for (let i = 0; i < len; i++) {
    const noteA = a[Math.min(i, a.length - 1)]
    const noteB = b[Math.min(i, b.length - 1)]
    const d = Math.abs(noteA - noteB)
    // Quadratic cost penalizes large leaps more than proportionally
    cost += d * d
  }
  return cost
}

// ── Main voicing selector ────────────────────────────────────────────────────

export class VoicingEngine {
  constructor() {
    this._lastVoicing = null
    this._lastBassNote = null
  }

  /**
   * Choose the best voicing for a chord given the previous voicing.
   * @param {object} chord - { root, intervals, suffix, name }
   * @param {object} opts
   * @param {number} opts.octave - target octave
   * @param {string} opts.style - "close"|"spread"|"drop2"|"auto"
   * @param {boolean} opts.preferSmooth - minimize voice leading distance
   * @returns {{ notes: number[], bass: number }}
   */
  voice(chord, opts = {}) {
    const {
      octave = 4,
      style = "auto",
      preferSmooth = true,
    } = opts

    const allVoicings = buildVoicings(chord, octave)

    // Filter by style preference
    let candidates = style === "auto"
      ? allVoicings
      : allVoicings.filter(v => v.type === style)

    if (!candidates.length) candidates = allVoicings

    let chosen

    if (this._lastVoicing && preferSmooth) {
      // Score each candidate by voice leading cost
      let bestCost = Infinity
      chosen = candidates[0]

      for (const v of candidates) {
        const cost = voiceLeadingCost(this._lastVoicing, v)
        // Small bonus for variety (don't always pick same inversion)
        const varietyBonus = (v.inversion === this._lastVoicing.inversion) ? 5 : 0
        const totalCost = cost + varietyBonus

        if (totalCost < bestCost) {
          bestCost = totalCost
          chosen = v
        }
      }
    } else {
      // First chord: pick root position or a pleasing default
      chosen = candidates.find(v => v.inversion === 0 && v.type === "close") ?? candidates[0]
    }

    this._lastVoicing = chosen

    // Bass note: root of the chord in bass octave
    const rootPc = NOTES.indexOf(chord.root)
    const bass = rootPc + (octave - 1) * 12 + 12  // one octave below voicing
    this._lastBassNote = bass

    return {
      notes: chosen.notes,
      bass,
      inversion: chosen.inversion,
      type: chosen.type,
    }
  }

  /**
   * Get bass note with optional walking bass movement
   * @param {object} chord
   * @param {object} nextChord - next chord (for approach notes)
   * @param {number} octave
   * @param {number} chordDurSec
   * @param {number} beatSec
   * @param {number} energy - -1 to 1
   * @returns {Array<{ midi: number, t: number, dur: number, velocity: number }>}
   */
  bassLine(chord, nextChord, octave = 2, chordDurSec = 2, beatSec = 0.5, energy = 0) {
    const rootPc = NOTES.indexOf(chord.root)
    const rootMidi = rootPc + (octave + 1) * 12
    const fifth = rootMidi + 7
    const third = rootMidi + (chord.suffix?.includes("m") ? 3 : 4)

    const notes = []

    if (energy < -0.3) {
      // Sustained bass: just root, held long
      notes.push({ midi: rootMidi, t: 0, dur: chordDurSec * 0.9, velocity: 0.7 })
    } else if (energy > 0.4) {
      // Walking bass: root, passing tone, fifth, approach to next root
      const beatsPerBar = Math.round(chordDurSec / beatSec)
      const nextRootPc = nextChord ? NOTES.indexOf(nextChord.root) : rootPc
      const nextRootMidi = nextRootPc + (octave + 1) * 12

      // Approach note: chromatic step toward next root
      let approachNote = nextRootMidi - 1
      if (Math.abs(approachNote - fifth) <= 1) approachNote = nextRootMidi + 1
      // Keep in range
      while (approachNote < rootMidi - 7) approachNote += 12
      while (approachNote > rootMidi + 12) approachNote -= 12

      if (beatsPerBar >= 4) {
        notes.push({ midi: rootMidi, t: 0, dur: beatSec * 0.9, velocity: 0.75 })
        notes.push({ midi: third, t: beatSec, dur: beatSec * 0.85, velocity: 0.55 })
        notes.push({ midi: fifth, t: beatSec * 2, dur: beatSec * 0.85, velocity: 0.6 })
        notes.push({ midi: approachNote, t: beatSec * 3, dur: beatSec * 0.8, velocity: 0.55 })
      } else {
        notes.push({ midi: rootMidi, t: 0, dur: beatSec * 0.9, velocity: 0.75 })
        notes.push({ midi: fifth, t: beatSec, dur: beatSec * 0.85, velocity: 0.6 })
      }
    } else {
      // Medium energy: root on 1, fifth on 3
      notes.push({ midi: rootMidi, t: 0, dur: beatSec * 1.8, velocity: 0.7 })
      notes.push({ midi: fifth, t: beatSec * 2, dur: beatSec * 1.7, velocity: 0.55 })
    }

    return notes
  }

  reset() {
    this._lastVoicing = null
    this._lastBassNote = null
  }
}
