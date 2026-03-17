import { buildChordMidi, midiToFreq } from "../musicUtils"

function makeImpulseResponse(ac, seconds) {
  const len = Math.max(1, Math.floor(ac.sampleRate * seconds))
  const buf = ac.createBuffer(2, len, ac.sampleRate)
  for (let ch = 0; ch < 2; ch++) {
    const d = buf.getChannelData(ch)
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.2)
  }
  return buf
}

export class AudioEngine {
  constructor() {
    this._ctx       = null
    this._convolver = null
    this._reverbKey = ""
  }

  _getCtx() {
    if (!this._ctx) this._ctx = new window.AudioContext()
    return this._ctx
  }

  _getConvolver(ac, reverb) {
    if (!this._convolver) this._convolver = ac.createConvolver()
    const key = `${ac.sampleRate}-${reverb.toFixed(3)}`
    if (this._reverbKey !== key) {
      this._convolver.buffer = makeImpulseResponse(ac, 0.4 + reverb * 3.6)
      this._reverbKey = key
    }
    return this._convolver
  }

  async play(chord, { sustain, intensity, reverb, spread }) {
    const ac = this._getCtx()
    if (ac.state === "suspended") await ac.resume()

    const now  = ac.currentTime
    const dur  = Math.max(0.25, sustain)
    const dry  = ac.createGain()
    const wet  = ac.createGain()
    const master = ac.createGain()
    const conv = this._getConvolver(ac, reverb)

    dry.gain.value = 1 - Math.min(reverb, 0.9)
    wet.gain.value = Math.min(reverb * 1.4, 1)
    master.gain.setValueAtTime(0.0001, now)
    master.gain.exponentialRampToValueAtTime(0.15 + intensity * 0.35, now + 0.03)
    master.gain.exponentialRampToValueAtTime(0.0001, now + dur)

    dry.connect(master)
    wet.connect(conv)
    conv.connect(master)
    master.connect(ac.destination)

    const midiNotes = buildChordMidi(chord.root, chord.intervals)

    midiNotes.forEach((midi, i) => {
      const osc  = ac.createOscillator()
      const gain = ac.createGain()
      osc.type          = "triangle"
      osc.frequency.value = midiToFreq(midi)
      gain.gain.value   = (0.65 * intensity) / Math.max(midiNotes.length, 3)
      osc.connect(gain)
      gain.connect(dry)
      gain.connect(wet)
      osc.start(now + i * spread)
      osc.stop(now + dur)
    })

    return midiNotes
  }
}
