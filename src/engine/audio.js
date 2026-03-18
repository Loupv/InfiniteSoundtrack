import { buildChordMidi, midiToFreq } from "../musicUtils"

// Harmonic partials for piano synthesis
// Slight inharmonicity mimics real piano string stiffness
const PIANO_HARMONICS = [
  { ratio: 1.0000, gain: 1.00 },
  { ratio: 2.0006, gain: 0.50 },
  { ratio: 3.0018, gain: 0.25 },
  { ratio: 4.0038, gain: 0.12 },
  { ratio: 5.0065, gain: 0.06 },
  { ratio: 6.0100, gain: 0.03 },
]

function playPianoNote(ac, freq, now, dur, perNoteLevel, dest) {
  // Brightness filter: wide on attack (hammer strike), narrows as note decays
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

  // Piano ADSR: fast attack, quick initial decay, slow sustain tail
  const env = ac.createGain()
  env.gain.setValueAtTime(0.0001, now)
  env.gain.exponentialRampToValueAtTime(perNoteLevel, now + 0.005)       // attack
  env.gain.exponentialRampToValueAtTime(perNoteLevel * 0.65, now + 0.07) // initial decay
  env.gain.exponentialRampToValueAtTime(perNoteLevel * 0.35, now + 0.3)  // mid decay
  env.gain.exponentialRampToValueAtTime(0.0001, now + dur)               // release
  env.connect(filter)

  PIANO_HARMONICS.forEach(({ ratio, gain: hGain }) => {
    const osc  = ac.createOscillator()
    const gNode = ac.createGain()
    osc.type = "sine"
    osc.frequency.value = freq * ratio
    gNode.gain.value = hGain
    osc.connect(gNode)
    gNode.connect(env)
    osc.start(now)
    osc.stop(now + dur)
  })
}

export class AudioEngine {
  constructor() {
    this._ctx = null
  }

  _getCtx() {
    if (!this._ctx) this._ctx = new window.AudioContext()
    return this._ctx
  }

  async play(chord, { sustain, intensity, spread, waveType = "piano" }) {
    const ac = this._getCtx()
    if (ac.state === "suspended") await ac.resume()

    const now  = ac.currentTime
    const dur  = Math.max(0.25, sustain)

    const midiNotes = buildChordMidi(chord.root, chord.intervals)
    const perNoteLevel = (intensity * 0.55) / Math.max(midiNotes.length, 3)

    if (waveType === "piano") {
      midiNotes.forEach((midi, i) => {
        playPianoNote(ac, midiToFreq(midi), now + i * spread, dur, perNoteLevel, ac.destination)
      })
    } else {
      // Classic oscillator modes
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
    }

    return midiNotes
  }
}
