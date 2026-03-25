import { NOTES } from "../constants"

// ── Melody Generator ─────────────────────────────────────────────────────────
// Generates musically coherent melodic lines over chord progressions.
// Uses contour shaping, chord-tone targeting, passing/neighbor tones,
// and tension-resolution awareness.

// Interval classes for melodic motion preferences
const STEP = 1       // half step
const WHOLE = 2      // whole step
const MIN3 = 3
const MAJ3 = 4
const P4 = 5
const P5 = 7
const OCTAVE = 12

// Motion weights: smaller intervals are preferred for smooth melody
const MOTION_WEIGHTS = {
  0: 0.1,   // unison (avoid)
  1: 0.7,   // half step
  2: 1.0,   // whole step (most natural)
  3: 0.8,   // minor 3rd
  4: 0.7,   // major 3rd
  5: 0.5,   // perfect 4th
  7: 0.4,   // perfect 5th (leap)
  12: 0.15, // octave (rare)
}

function motionWeight(interval) {
  const abs = Math.abs(interval)
  return MOTION_WEIGHTS[abs] ?? (abs <= 6 ? 0.3 : 0.05)
}

// ── Scale utilities ──────────────────────────────────────────────────────────

function buildScaleNotes(keyRoot, scaleIntervals, minMidi, maxMidi) {
  const notes = []
  for (let oct = -1; oct <= 9; oct++) {
    for (const interval of scaleIntervals) {
      const midi = keyRoot + oct * 12 + interval
      if (midi >= minMidi && midi <= maxMidi) notes.push(midi)
    }
  }
  return [...new Set(notes)].sort((a, b) => a - b)
}

function isChordTone(midi, chordMidis) {
  const pc = ((midi % 12) + 12) % 12
  return chordMidis.some(m => ((m % 12) + 12) % 12 === pc)
}

function nearestScaleNote(midi, scaleNotes) {
  let best = scaleNotes[0], bestDist = 999
  for (const n of scaleNotes) {
    const d = Math.abs(n - midi)
    if (d < bestDist) { bestDist = d; best = n }
  }
  return best
}

// ── Contour shapes ───────────────────────────────────────────────────────────
// Each contour is a function that returns a "target height" (0-1) for a given
// position (0-1) within the phrase. The melody gravitates toward this height.

const CONTOURS = {
  arch:     t => Math.sin(t * Math.PI),                    // rise then fall
  valley:   t => 1 - Math.sin(t * Math.PI),                // fall then rise
  rising:   t => t,                                         // gradual ascent
  falling:  t => 1 - t,                                     // gradual descent
  plateau:  t => t < 0.3 ? t / 0.3 : t > 0.7 ? (1 - t) / 0.3 : 1, // rise, hold, fall
  wave:     t => 0.5 + 0.5 * Math.sin(t * Math.PI * 2),    // one full wave
  question: t => t < 0.6 ? t / 0.6 * 0.6 : 0.6 + (t - 0.6) / 0.4 * 0.4, // ends high
}

const CONTOUR_NAMES = Object.keys(CONTOURS)

// ── Rhythm patterns for melody ───────────────────────────────────────────────
// Returns array of { t: offset (0-1 of bar), dur: fraction of bar, accent: bool }

function melodyRhythm(beatsPerBar, energy, style = "default") {
  const patterns = []

  if (style === "sustained" || energy < -0.3) {
    // Long, flowing notes
    patterns.push(
      { t: 0, dur: 0.5, accent: true },
      { t: 0.5, dur: 0.5, accent: false },
    )
  } else if (style === "syncopated" || energy > 0.5) {
    // Syncopated, more active
    patterns.push(
      { t: 0, dur: 0.25, accent: true },
      { t: 0.25, dur: 0.125, accent: false },
      { t: 0.5, dur: 0.25, accent: true },
      { t: 0.75, dur: 0.125, accent: false },
      { t: 0.875, dur: 0.125, accent: false },
    )
  } else if (style === "waltz") {
    patterns.push(
      { t: 0, dur: 0.333, accent: true },
      { t: 0.333, dur: 0.333, accent: false },
      { t: 0.667, dur: 0.333, accent: false },
    )
  } else {
    // Default: quarter-note based with variation
    const rand = Math.random()
    if (rand < 0.3) {
      // Simple quarter notes
      patterns.push(
        { t: 0, dur: 0.25, accent: true },
        { t: 0.25, dur: 0.25, accent: false },
        { t: 0.5, dur: 0.25, accent: true },
        { t: 0.75, dur: 0.25, accent: false },
      )
    } else if (rand < 0.6) {
      // Dotted quarter + eighth
      patterns.push(
        { t: 0, dur: 0.375, accent: true },
        { t: 0.375, dur: 0.125, accent: false },
        { t: 0.5, dur: 0.375, accent: true },
        { t: 0.875, dur: 0.125, accent: false },
      )
    } else if (rand < 0.8) {
      // Half + two quarters
      patterns.push(
        { t: 0, dur: 0.5, accent: true },
        { t: 0.5, dur: 0.25, accent: false },
        { t: 0.75, dur: 0.25, accent: true },
      )
    } else {
      // Long note + pickup
      patterns.push(
        { t: 0, dur: 0.625, accent: true },
        { t: 0.625, dur: 0.125, accent: false },
        { t: 0.75, dur: 0.25, accent: true },
      )
    }
  }

  // Occasionally add a rest (remove a note) for breathing space
  if (patterns.length > 2 && Math.random() < 0.25) {
    const removeIdx = 1 + Math.floor(Math.random() * (patterns.length - 2))
    patterns.splice(removeIdx, 1)
  }

  return patterns
}

// ── Main melody generator ────────────────────────────────────────────────────

export class MelodyGenerator {
  constructor() {
    this._lastNote = null
    this._contour = null
    this._contourPhrase = 0    // how many bars into current contour
    this._phraseLength = 0     // total bars for current contour
    this._direction = 1        // 1 = ascending tendency, -1 = descending
    this._motif = null         // short interval pattern to repeat/vary
    this._motifAge = 0
  }

  /**
   * Generate melody notes for one bar/chord.
   * @param {object} chord - { root, intervals, suffix }
   * @param {number} keyRoot - pitch class 0-11
   * @param {number[]} scaleIntervals - scale intervals
   * @param {object} opts
   * @param {number} opts.octave - base octave for melody (e.g. 5)
   * @param {number} opts.energy - -1 to 1
   * @param {number} opts.tension - -1 to 1
   * @param {number} opts.valence - -1 to 1
   * @param {number} opts.chordDurSec - chord duration in seconds
   * @param {number} opts.beatSec - beat duration in seconds
   * @returns {Array<{ midi: number, t: number, dur: number, velocity: number }>}
   */
  generate(chord, keyRoot, scaleIntervals, opts = {}) {
    const {
      octave = 5,
      energy = 0,
      tension = 0,
      valence = 0,
      chordDurSec = 2,
      beatSec = 0.5,
    } = opts

    const rootPc = NOTES.indexOf(chord.root)
    const chordMidis = chord.intervals.map(i => rootPc + (octave) * 12 + 12 + i)
    const minMidi = (octave) * 12 + 12     // e.g. C5 = 72
    const maxMidi = (octave + 1) * 12 + 12 + 7 // up to ~G6
    const scaleNotes = buildScaleNotes(keyRoot, scaleIntervals, minMidi - 5, maxMidi + 5)

    // ── Contour management ───────────────────────────────────────────────
    if (!this._contour || this._contourPhrase >= this._phraseLength) {
      this._contour = CONTOUR_NAMES[Math.floor(Math.random() * CONTOUR_NAMES.length)]
      this._phraseLength = 2 + Math.floor(Math.random() * 6) // 2-7 bars
      this._contourPhrase = 0

      // New motif every phrase (short interval pattern)
      this._motif = this._generateMotif(scaleNotes)
      this._motifAge = 0
    }

    const contourFn = CONTOURS[this._contour]
    const phrasePos = this._contourPhrase / Math.max(1, this._phraseLength - 1)
    const targetHeight = contourFn(phrasePos)
    this._contourPhrase++

    // Target note based on contour height mapped to register
    const targetMidi = Math.round(minMidi + targetHeight * (maxMidi - minMidi))
    const targetOnScale = nearestScaleNote(targetMidi, scaleNotes)

    // ── Rhythm ───────────────────────────────────────────────────────────
    const style = energy < -0.3 ? "sustained" : energy > 0.5 ? "syncopated" : "default"
    const rhythm = melodyRhythm(4, energy, style)

    // ── Generate notes ───────────────────────────────────────────────────
    const notes = []
    let currentNote = this._lastNote ?? targetOnScale

    // If first note ever, start on a chord tone near the target
    if (!this._lastNote) {
      currentNote = this._nearestChordTone(targetOnScale, chordMidis, scaleNotes)
    }

    for (let i = 0; i < rhythm.length; i++) {
      const slot = rhythm[i]
      const slotPos = i / rhythm.length
      const localTarget = nearestScaleNote(
        Math.round(minMidi + contourFn(phrasePos * 0.8 + slotPos * 0.2) * (maxMidi - minMidi)),
        scaleNotes
      )

      let nextNote

      if (slot.accent && Math.random() < 0.6) {
        // Accented beats: prefer chord tones
        nextNote = this._nearestChordTone(localTarget, chordMidis, scaleNotes)
      } else if (this._motif && this._motifAge < 3 && i < this._motif.length) {
        // Apply motif (transposed)
        const motifInterval = this._motif[i]
        const candidate = currentNote + motifInterval
        nextNote = nearestScaleNote(candidate, scaleNotes)
      } else {
        // Stepwise motion toward target with occasional leaps
        nextNote = this._stepToward(currentNote, localTarget, scaleNotes, tension)
      }

      // Constrain to range
      nextNote = Math.max(minMidi - 2, Math.min(maxMidi + 2, nextNote))
      nextNote = nearestScaleNote(nextNote, scaleNotes)

      // Avoid too many repeated notes
      if (nextNote === currentNote && scaleNotes.length > 2) {
        const idx = scaleNotes.indexOf(nextNote)
        if (idx >= 0) {
          const direction = Math.random() < 0.5 ? 1 : -1
          const altIdx = Math.max(0, Math.min(scaleNotes.length - 1, idx + direction))
          nextNote = scaleNotes[altIdx]
        }
      }

      // Velocity based on accent and position
      let velocity = slot.accent ? 0.75 + Math.random() * 0.15 : 0.5 + Math.random() * 0.2
      // Chord tones get a slight boost
      if (isChordTone(nextNote, chordMidis)) velocity = Math.min(1, velocity + 0.08)

      notes.push({
        midi: nextNote,
        t: slot.t * chordDurSec,
        dur: slot.dur * chordDurSec * (0.8 + Math.random() * 0.3), // slight duration variation
        velocity,
      })

      currentNote = nextNote
    }

    this._lastNote = currentNote
    this._motifAge++

    return notes
  }

  _generateMotif(scaleNotes) {
    // Short 2-4 note interval pattern
    const len = 2 + Math.floor(Math.random() * 3)
    const motif = []
    for (let i = 0; i < len; i++) {
      const leap = Math.random() < 0.7
        ? (Math.random() < 0.5 ? 1 : -1) * (1 + Math.floor(Math.random() * 2)) // step
        : (Math.random() < 0.5 ? 1 : -1) * (3 + Math.floor(Math.random() * 4)) // leap
      motif.push(leap)
    }
    return motif
  }

  _nearestChordTone(target, chordMidis, scaleNotes) {
    // Find nearest chord tone pitch class in any octave near the target
    const chordPCs = chordMidis.map(m => ((m % 12) + 12) % 12)
    const candidates = scaleNotes.filter(n => chordPCs.includes(((n % 12) + 12) % 12))
    if (!candidates.length) return nearestScaleNote(target, scaleNotes)

    let best = candidates[0], bestDist = 999
    for (const c of candidates) {
      const d = Math.abs(c - target)
      if (d < bestDist) { bestDist = d; best = c }
    }
    return best
  }

  _stepToward(current, target, scaleNotes, tension) {
    const diff = target - current
    const absDiff = Math.abs(diff)
    const dir = diff > 0 ? 1 : -1

    // Higher tension = more likely to leap
    const leapChance = 0.15 + Math.max(0, tension) * 0.25

    if (absDiff <= 2) {
      // Already close, small step or stay
      const idx = scaleNotes.indexOf(nearestScaleNote(current, scaleNotes))
      const step = dir * (Math.random() < 0.6 ? 1 : 2)
      const newIdx = Math.max(0, Math.min(scaleNotes.length - 1, idx + step))
      return scaleNotes[newIdx]
    }

    if (Math.random() < leapChance && absDiff > 3) {
      // Leap (3rd, 4th, or 5th)
      const leapSize = MAJ3 + Math.floor(Math.random() * 4) // 4-7 semitones
      return nearestScaleNote(current + dir * leapSize, scaleNotes)
    }

    // Default: stepwise
    const idx = scaleNotes.indexOf(nearestScaleNote(current, scaleNotes))
    const step = dir * (1 + Math.floor(Math.random() * 2))
    const newIdx = Math.max(0, Math.min(scaleNotes.length - 1, idx + step))
    return scaleNotes[newIdx]
  }

  reset() {
    this._lastNote = null
    this._contour = null
    this._contourPhrase = 0
    this._phraseLength = 0
    this._motif = null
    this._motifAge = 0
  }
}
