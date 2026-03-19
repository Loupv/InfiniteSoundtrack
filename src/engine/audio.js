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

function playDefaultNote(ac, freq, now, dur, perNoteLevel, dest) {
  const filter = ac.createBiquadFilter()
  filter.type = "lowpass"
  filter.Q.value = 0.7
  const maxFreq = Math.min(freq * 14, 18000)
  const midFreq = Math.max(freq * 5, 800)
  const endFreq = Math.max(freq * 2.5, 400)
  filter.frequency.setValueAtTime(maxFreq, now)
  filter.frequency.exponentialRampToValueAtTime(midFreq, now + 0.08)
  filter.frequency.exponentialRampToValueAtTime(endFreq, now + Math.min(dur * 0.5, 1.5))
  filter.connect(dest)

  const env = ac.createGain()
  env.gain.setValueAtTime(0.0001, now)
  env.gain.exponentialRampToValueAtTime(perNoteLevel, now + 0.005)
  env.gain.exponentialRampToValueAtTime(perNoteLevel * 0.65, now + 0.07)
  env.gain.exponentialRampToValueAtTime(perNoteLevel * 0.35, now + 0.3)
  env.gain.exponentialRampToValueAtTime(0.0001, now + dur)
  env.connect(filter)

  PIANO_HARMONICS.forEach(({ ratio, gain: hGain }) => {
    const osc   = ac.createOscillator()
    const gNode = ac.createGain()
    osc.type = "sine"
    osc.frequency.value = freq * ratio
    gNode.gain.value    = hGain
    osc.connect(gNode)
    gNode.connect(env)
    osc.start(now)
    osc.stop(now + dur)
  })
}

// ── Soundfont instruments ─────────────────────────────────────────────────────

const SF_NAMES = {
  piano:   "acoustic_grand_piano",
  harp:    "orchestral_harp",
  marimba: "marimba",
}

// ── Arpeggio helpers ──────────────────────────────────────────────────────────

// Expand midiNotes to targetCount using a bounce pattern (up then down
// without repeating the top note): [C,E,G] → target 4 → [C,E,G,E]
function expandArpeggio(midiNotes, targetCount) {
  const n = midiNotes.length
  if (n === 0) return midiNotes
  if (n === 1) return Array(targetCount).fill(midiNotes[0])
  if (n >= targetCount) return midiNotes.slice(0, targetCount)
  const period = 2 * (n - 1)
  const result = []
  for (let i = 0; i < targetCount; i++) {
    const pos = i % period
    result.push(pos < n ? midiNotes[pos] : midiNotes[period - pos])
  }
  return result
}

function getSpread(playMode, beatMs, targetCount) {
  if (playMode === "strum")    return 0.03
  if (playMode === "arpeggio") return (beatMs / 1000) / Math.max(targetCount, 1)
  return 0 // block
}

export class AudioEngine {
  constructor() {
    this._ctx     = null
    this._sfCache = {}
  }

  _getCtx() {
    if (!this._ctx) this._ctx = new window.AudioContext()
    return this._ctx
  }

  async preload(waveType) {
    if (!SF_NAMES[waveType]) return
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

  async play(chord, { sustain, intensity, playMode = "block", beatMs = 667, arpeggioTarget = 4, waveType = "default" }) {
    const ac = this._getCtx()
    if (ac.state === "suspended") await ac.resume()

    const now      = ac.currentTime
    const rawNotes = buildChordMidi(chord.root, chord.intervals)
    const midiNotes = playMode === "arpeggio"
      ? expandArpeggio(rawNotes, arpeggioTarget)
      : rawNotes

    const spread = getSpread(playMode, beatMs, arpeggioTarget)

    // For arpeggio, each note rings for roughly one beat
    const dur = playMode === "arpeggio"
      ? Math.max(beatMs / 1000, sustain)
      : Math.max(0.25, sustain)

    // ── Soundfont ──
    if (SF_NAMES[waveType]) {
      const instrument = await this.preload(waveType)
      const gain = (intensity * 1.6) / Math.max(midiNotes.length, 3)
      midiNotes.forEach((midi, i) => {
        instrument.play(midi, now + i * spread, { duration: dur, gain })
      })
      return rawNotes
    }

    // ── Default synth ──
    const perNoteLevel = (intensity * 0.07) / Math.max(midiNotes.length, 3)
    if (waveType === "default") {
      midiNotes.forEach((midi, i) => {
        playDefaultNote(ac, midiToFreq(midi), now + i * spread, dur, perNoteLevel, ac.destination)
      })
      return rawNotes
    }

    // ── Oscillator fallback ──
    const master = ac.createGain()
    master.gain.setValueAtTime(0.0001, now)
    master.gain.exponentialRampToValueAtTime(0.15 + intensity * 0.35, now + 0.03)
    master.gain.exponentialRampToValueAtTime(0.0001, now + dur)
    master.connect(ac.destination)

    midiNotes.forEach((midi, i) => {
      const osc  = ac.createOscillator()
      const gain = ac.createGain()
      osc.type            = waveType
      osc.frequency.value = midiToFreq(midi)
      gain.gain.value     = (0.65 * intensity) / Math.max(midiNotes.length, 3)
      osc.connect(gain)
      gain.connect(master)
      osc.start(now + i * spread)
      osc.stop(now + dur)
    })

    return rawNotes
  }
}
