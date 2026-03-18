import { buildChordMidi, midiToFreq } from "../musicUtils"

export class AudioEngine {
  constructor() {
    this._ctx = null
  }

  _getCtx() {
    if (!this._ctx) this._ctx = new window.AudioContext()
    return this._ctx
  }

  async play(chord, { sustain, intensity, spread, waveType = "triangle" }) {
    const ac = this._getCtx()
    if (ac.state === "suspended") await ac.resume()

    const now    = ac.currentTime
    const dur    = Math.max(0.25, sustain)
    const master = ac.createGain()
    master.gain.setValueAtTime(0.0001, now)
    master.gain.exponentialRampToValueAtTime(0.15 + intensity * 0.35, now + 0.03)
    master.gain.exponentialRampToValueAtTime(0.0001, now + dur)
    master.connect(ac.destination)

    const midiNotes = buildChordMidi(chord.root, chord.intervals)

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

    return midiNotes
  }
}
