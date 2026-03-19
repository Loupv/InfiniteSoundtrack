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

function playDefaultNote(ac, freq, startTime, dur, perNoteLevel, dest) {
  const filter = ac.createBiquadFilter()
  filter.type = "lowpass"
  filter.Q.value = 0.7
  const maxFreq = Math.min(freq * 14, 18000)
  const midFreq = Math.max(freq * 5, 800)
  const endFreq = Math.max(freq * 2.5, 400)
  filter.frequency.setValueAtTime(maxFreq, startTime)
  filter.frequency.exponentialRampToValueAtTime(midFreq, startTime + 0.08)
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
  }) {
    const ac   = this._getCtx()
    const dest = this._getDest()
    if (ac.state === "suspended") await ac.resume()

    const now      = startTime ?? ac.currentTime
    const rawNotes = buildChordMidi(chord.root, chord.intervals)
    const schedule = buildSchedule(rawNotes, playMode, chordDurSec, beatSec)

    // Pre-load soundfont once (fast if already cached)
    const instrument = SF_NAMES[waveType] ? (await this.preload(waveType)) : null

    for (const { notes, t, dur } of schedule) {
      const at = now + t

      if (instrument) {
        // ── Soundfont ──
        const gain = (intensity * 1.6) / Math.max(notes.length, 2)
        notes.forEach(midi => instrument.play(midi, at, { duration: dur, gain }))

      } else if (waveType === "default") {
        // ── Default (harmonic) synth ──
        const perNoteLevel = (intensity * 0.07) / Math.max(notes.length, 2)
        notes.forEach(midi => playDefaultNote(ac, midiToFreq(midi), at, dur, perNoteLevel, dest))

      } else {
        // ── Oscillator fallback ──
        playOscNotes(ac, notes, at, dur, intensity, waveType, dest)
      }
    }
  }
}
