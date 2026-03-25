import { buildChordMidi, midiToFreq } from "../musicUtils"

// ── Default synth (oscillator piano) ─────────────────────────────────────────

const PIANO_HARMONICS = [
  { ratio: 1.0000, gain: 1.00 },
  { ratio: 2.0006, gain: 0.50 },
  { ratio: 3.0018, gain: 0.25 },
  { ratio: 4.0038, gain: 0.12 },
  { ratio: 5.0065, gain: 0.06 },
  { ratio: 6.0100, gain: 0.03 },
]

// Chord quality → filter character for timbral variety
function getFilterParams(suffix) {
  if (suffix === "m" || suffix === "m7" || suffix === "m6")
    return { maxMult: 8, midMult: 3.5, endMult: 1.8, attack: 0.12, Q: 0.5 }
  if (suffix === "dim")
    return { maxMult: 6, midMult: 2.5, endMult: 1.5, attack: 0.15, Q: 0.4 }
  if (suffix === "aug")
    return { maxMult: 18, midMult: 7, endMult: 3, attack: 0.05, Q: 0.9 }
  if (suffix === "7" || suffix === "9" || suffix === "11")
    return { maxMult: 11, midMult: 4, endMult: 2.2, attack: 0.07, Q: 0.8 }
  if (suffix === "maj7")
    return { maxMult: 16, midMult: 6, endMult: 3, attack: 0.06, Q: 0.6 }
  if (suffix === "sus2" || suffix === "sus4")
    return { maxMult: 12, midMult: 5, endMult: 2.8, attack: 0.09, Q: 0.5 }
  // Major (default)
  return { maxMult: 14, midMult: 5, endMult: 2.5, attack: 0.08, Q: 0.7 }
}

function playDefaultNote(ac, freq, startTime, dur, perNoteLevel, dest, suffix = "") {
  const fp = getFilterParams(suffix)
  const filter = ac.createBiquadFilter()
  filter.type = "lowpass"
  filter.Q.value = fp.Q
  const maxFreq = Math.min(freq * fp.maxMult, 18000)
  const midFreq = Math.max(freq * fp.midMult, 800)
  const endFreq = Math.max(freq * fp.endMult, 400)
  filter.frequency.setValueAtTime(maxFreq, startTime)
  filter.frequency.exponentialRampToValueAtTime(midFreq, startTime + fp.attack)
  filter.frequency.exponentialRampToValueAtTime(endFreq, startTime + Math.min(dur * 0.5, 1.5))
  filter.connect(dest)

  const env = ac.createGain()
  env.gain.setValueAtTime(0.0001, startTime)
  env.gain.exponentialRampToValueAtTime(perNoteLevel, startTime + 0.005)
  env.gain.exponentialRampToValueAtTime(perNoteLevel * 0.65, startTime + 0.07)
  env.gain.exponentialRampToValueAtTime(perNoteLevel * 0.35, startTime + 0.3)
  env.gain.exponentialRampToValueAtTime(0.0001, startTime + dur)
  env.connect(filter)

  PIANO_HARMONICS.forEach(({ ratio, gain: hGain }) => {
    const osc   = ac.createOscillator()
    const gNode = ac.createGain()
    osc.type = "sine"
    osc.frequency.value = freq * ratio
    gNode.gain.value    = hGain
    osc.connect(gNode)
    gNode.connect(env)
    osc.start(startTime)
    osc.stop(startTime + dur)
  })
}

function playOscNotes(ac, midiNotes, startTime, dur, intensity, waveType, dest) {
  const master = ac.createGain()
  master.gain.setValueAtTime(0.0001, startTime)
  master.gain.exponentialRampToValueAtTime(0.15 + intensity * 0.35, startTime + 0.03)
  master.gain.exponentialRampToValueAtTime(0.0001, startTime + dur)
  master.connect(dest)
  midiNotes.forEach(midi => {
    const osc  = ac.createOscillator()
    const gain = ac.createGain()
    osc.type            = waveType
    osc.frequency.value = midiToFreq(midi)
    gain.gain.value     = (0.65 * intensity) / Math.max(midiNotes.length, 2)
    osc.connect(gain)
    gain.connect(master)
    osc.start(startTime)
    osc.stop(startTime + dur)
  })
}

// ── Soundfont instruments ─────────────────────────────────────────────────────

const SF_NAMES = {
  piano:   "acoustic_grand_piano",
  harp:    "orchestral_harp",
  marimba: "marimba",
}

// ── Schedule builder ──────────────────────────────────────────────────────────
// Returns an array of { notes: number[], t: number, dur: number }
// where t is seconds after chord start and dur is note duration in seconds.

export function buildSchedule(midiNotes, playMode, chordDurSec, beatSec) {
  const d = chordDurSec
  const b = beatSec

  switch (playMode) {

    // ── Strum: fast cascade up ─────────────────────────────────────────────
    case "strum":
      return midiNotes.map((n, i) => ({
        notes: [n], t: i * 0.028, dur: Math.max(0.3, d * 0.9),
      }))

    // ── Arpège montant ─────────────────────────────────────────────────────
    case "arpUp": {
      const step = b
      return midiNotes.map((n, i) => ({
        notes: [n], t: i * step, dur: Math.max(step * 1.5, 0.35),
      }))
    }

    // ── Arpège descendant ──────────────────────────────────────────────────
    case "arpDown": {
      const step = b
      return [...midiNotes].reverse().map((n, i) => ({
        notes: [n], t: i * step, dur: Math.max(step * 1.5, 0.35),
      }))
    }

    // ── Arpège montée-descente (bounce) ────────────────────────────────────
    case "arpUpDown": {
      const n = midiNotes.length
      const bounced = n <= 1
        ? midiNotes
        : [...midiNotes, ...[...midiNotes].reverse().slice(1, -1)]
      const step = d / Math.max(bounced.length, 1)
      return bounced.map((note, i) => ({
        notes: [note], t: i * step, dur: Math.max(step * 1.6, 0.25),
      }))
    }

    // ── Alberti (main gauche classique: basse–5te–3ce–5te×2) ──────────────
    case "alberti": {
      if (midiNotes.length < 2) return [{ notes: midiNotes, t: 0, dur: d }]
      const bass = midiNotes[0]
      const high = midiNotes[midiNotes.length - 1]
      const mid  = midiNotes[Math.round((midiNotes.length - 1) / 2)]
      // 8 equal subdivisions per bar: bass-high-mid-high × 2
      const pat  = [bass, high, mid, high, bass, high, mid, high]
      const step = d / pat.length
      return pat.map((note, i) => ({
        notes: [note], t: i * step, dur: Math.max(step * 1.3, 0.12),
      }))
    }

    // ── Valse (basse + accord ×2) ──────────────────────────────────────────
    case "waltz": {
      const bass  = [midiNotes[0]]
      const chord = midiNotes.slice(1).length ? midiNotes.slice(1) : midiNotes
      const beat  = d / 3
      return [
        { notes: bass,  t: 0,        dur: beat * 0.85 },
        { notes: chord, t: beat,     dur: beat * 1.6  },
        { notes: chord, t: beat * 2, dur: beat * 1.6  },
      ]
    }

    // ── Comp jazz (contretemps façon Bill Evans) ───────────────────────────
    case "comp": {
      const bass  = [midiNotes[0]]
      const chord = midiNotes.slice(1).length ? midiNotes.slice(1) : midiNotes
      const bt    = d / 4
      return [
        { notes: bass,  t: 0,         dur: bt * 0.7  },
        { notes: chord, t: bt * 1,    dur: bt * 0.55 },
        { notes: chord, t: bt * 1.5,  dur: bt * 0.55 },
        { notes: bass,  t: bt * 2,    dur: bt * 0.7  },
        { notes: chord, t: bt * 2.5,  dur: bt * 0.55 },
        { notes: chord, t: bt * 3,    dur: bt * 0.55 },
        { notes: chord, t: bt * 3.5,  dur: bt * 0.55 },
      ]
    }

    // ── Broken: brisé type guitare baroque (1-2, 2-3, 1-2-3 ...) ─────────
    case "broken": {
      const n     = midiNotes.length
      if (n < 2) return [{ notes: midiNotes, t: 0, dur: d }]
      const pairs = []
      for (let i = 0; i < n - 1; i++) {
        pairs.push([midiNotes[i], midiNotes[i + 1]])
      }
      // fill the bar with repeating pairs
      const step = d / (Math.ceil(d / b) * 2)
      const out  = []
      let t = 0
      let pi = 0
      while (t < d - step * 0.5) {
        const p = pairs[pi % pairs.length]
        out.push({ notes: p, t, dur: Math.max(step * 2, 0.25) })
        t  += step * 2
        pi++
      }
      return out
    }

    // ── Bloc (défaut) ──────────────────────────────────────────────────────
    case "block":
    default:
      return [{ notes: midiNotes, t: 0, dur: Math.max(0.25, d * 0.92) }]
  }
}

// ── Humanization ─────────────────────────────────────────────────────────────
// Micro-timing and velocity jitter to break the mechanical feel.

function humanizeTime(t) {
  // ±25ms jitter — noticeable, human-like
  return t + (Math.random() - 0.5) * 0.050
}

function humanizeGain(g) {
  // ±20% velocity variation for dynamic expression
  return g * (1 + (Math.random() - 0.5) * 0.4)
}

// ── AudioEngine ───────────────────────────────────────────────────────────────

export class AudioEngine {
  constructor() {
    this._ctx      = null
    this._sfCache  = {}
    this._destNode = null
  }

  setContext(ac, destNode) {
    this._ctx      = ac
    this._destNode = destNode ?? null
  }

  _getCtx() {
    if (!this._ctx) {
      const AC = window.AudioContext || window.webkitAudioContext
      this._ctx = new AC()
    }
    return this._ctx
  }

  _getDest() {
    return this._destNode ?? this._getCtx().destination
  }

  unlock() {
    const ac = this._getCtx()
    if (ac.state === "suspended") ac.resume()
  }

  async preload(waveType) {
    if (!SF_NAMES[waveType]) return null
    const ac = this._getCtx()
    if (!this._sfCache[waveType]) {
      const Soundfont = (await import("soundfont-player")).default
      this._sfCache[waveType] = Soundfont.instrument(ac, SF_NAMES[waveType], {
        format: "mp3",
        soundfont: "MusyngKite",
      })
    }
    return this._sfCache[waveType]
  }

  /**
   * Play a chord using schedule-based patterns.
   * @param {object} chord
   * @param {object} opts
   * @param {number|null} opts.startTime    Web Audio clock time; null = now
   * @param {number}      opts.chordDurSec  Total chord duration in seconds
   * @param {number}      opts.beatSec      Beat duration (for pattern timing)
   * @param {number}      opts.intensity    0..1
   * @param {string}      opts.playMode     "block"|"strum"|"arpUp"|"arpDown"|"arpUpDown"|"alberti"|"waltz"|"comp"|"broken"
   * @param {string}      opts.waveType     "default"|"piano"|"harp"|"marimba"|wave type
   */
  async play(chord, {
    startTime    = null,
    chordDurSec  = 2,
    beatSec      = 0.667,
    intensity    = 0.7,
    playMode     = "block",
    waveType     = "default",
    _rawMidi     = null,
  }) {
    const ac   = this._getCtx()
    const dest = this._getDest()
    if (ac.state === "suspended") await ac.resume()

    const now      = startTime ?? ac.currentTime
    const rawNotes = _rawMidi ?? buildChordMidi(chord.root, chord.intervals)
    const suffix   = chord.suffix ?? chord.name?.replace(chord.root, "") ?? ""
    const schedule = buildSchedule(rawNotes, playMode, chordDurSec, beatSec)

    // Pre-load soundfont once (fast if already cached)
    const instrument = SF_NAMES[waveType] ? (await this.preload(waveType)) : null

    // Should we humanize? Yes for patterns with multiple hits, no for single block
    const shouldHumanize = schedule.length > 1

    for (const { notes, t, dur } of schedule) {
      const at = shouldHumanize ? Math.max(now, humanizeTime(now + t)) : now + t

      if (instrument) {
        // ── Soundfont ──
        const baseGain = (intensity * 1.6) / Math.max(notes.length, 2)
        notes.forEach(midi => {
          const g = shouldHumanize ? humanizeGain(baseGain) : baseGain
          instrument.play(midi, at, { duration: dur, gain: g })
        })

      } else if (waveType === "default") {
        // ── Default (harmonic) synth — now with chord-quality filter ──
        const baseLevel = (intensity * 0.07) / Math.max(notes.length, 2)
        notes.forEach(midi => {
          const level = shouldHumanize ? humanizeGain(baseLevel) : baseLevel
          playDefaultNote(ac, midiToFreq(midi), at, dur, level, dest, suffix)
        })

      } else {
        // ── Oscillator fallback ──
        playOscNotes(ac, notes, at, dur, intensity, waveType, dest)
      }
    }
  }
}
