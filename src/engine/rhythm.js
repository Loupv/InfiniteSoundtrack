// ── Synthesized rhythm engine ─────────────────────────────────────────────────
// Uses Web Audio oscillators and noise buffers — no samples needed.

function playKick(ac, dest, time, vol = 0.8) {
  const osc  = ac.createOscillator()
  const gain = ac.createGain()
  osc.frequency.setValueAtTime(120, time)
  osc.frequency.exponentialRampToValueAtTime(40, time + 0.15)
  gain.gain.setValueAtTime(vol, time)
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.35)
  osc.connect(gain)
  gain.connect(dest)
  osc.start(time)
  osc.stop(time + 0.35)
}

function playSnare(ac, dest, time, vol = 0.45) {
  const bufSize = Math.floor(ac.sampleRate * 0.12)
  const buf     = ac.createBuffer(1, bufSize, ac.sampleRate)
  const data    = buf.getChannelData(0)
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1

  const src    = ac.createBufferSource()
  src.buffer   = buf
  const filter = ac.createBiquadFilter()
  filter.type  = "bandpass"
  filter.frequency.value = 2000
  filter.Q.value         = 0.8
  const gain = ac.createGain()
  gain.gain.setValueAtTime(vol, time)
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.12)
  src.connect(filter)
  filter.connect(gain)
  gain.connect(dest)
  src.start(time)
  src.stop(time + 0.12)
}

function playHihat(ac, dest, time, vol = 0.25, open = false) {
  const duration = open ? 0.25 : 0.055
  const bufSize  = Math.floor(ac.sampleRate * duration)
  const buf      = ac.createBuffer(1, bufSize, ac.sampleRate)
  const data     = buf.getChannelData(0)
  for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1

  const src    = ac.createBufferSource()
  src.buffer   = buf
  const filter = ac.createBiquadFilter()
  filter.type  = "highpass"
  filter.frequency.value = 8000
  const gain = ac.createGain()
  gain.gain.setValueAtTime(vol, time)
  gain.gain.exponentialRampToValueAtTime(0.001, time + duration)
  src.connect(filter)
  filter.connect(gain)
  gain.connect(dest)
  src.start(time)
  src.stop(time + duration)
}

function playRim(ac, dest, time, vol = 0.3) {
  const osc  = ac.createOscillator()
  const gain = ac.createGain()
  osc.type = "triangle"
  osc.frequency.value = 400
  gain.gain.setValueAtTime(vol, time)
  gain.gain.exponentialRampToValueAtTime(0.001, time + 0.04)
  osc.connect(gain)
  gain.connect(dest)
  osc.start(time)
  osc.stop(time + 0.04)
}

// ── Pattern library ───────────────────────────────────────────────────────────
// Each pattern is an array of { beat, type, vol? } for one bar of 4 beats.

export const RHYTHM_PATTERNS = {
  none: [],

  pulse: [
    { beat: 0,   type: "kick",  vol: 0.6 },
    { beat: 2,   type: "kick",  vol: 0.4 },
  ],

  simple: [
    { beat: 0,   type: "kick",  vol: 0.8 },
    { beat: 2,   type: "snare", vol: 0.5 },
  ],

  groove: [
    { beat: 0,    type: "kick",  vol: 0.9 },
    { beat: 0.5,  type: "hihat", vol: 0.2 },
    { beat: 1,    type: "hihat", vol: 0.2 },
    { beat: 1.5,  type: "hihat", vol: 0.25 },
    { beat: 2,    type: "snare", vol: 0.55 },
    { beat: 2.5,  type: "hihat", vol: 0.2 },
    { beat: 3,    type: "kick",  vol: 0.5 },
    { beat: 3.5,  type: "hihat", vol: 0.2 },
  ],

  half: [
    { beat: 0,   type: "kick",  vol: 0.7 },
    { beat: 1,   type: "rim",   vol: 0.25 },
    { beat: 2,   type: "snare", vol: 0.5 },
    { beat: 3,   type: "hihat", vol: 0.2 },
    { beat: 3.5, type: "hihat", vol: 0.15 },
  ],
}

// ── RhythmEngine class ────────────────────────────────────────────────────────

export class RhythmEngine {
  constructor() {
    this._ac      = null
    this._dest    = null
    this._pattern = "none"
    this._volume  = 0.5
  }

  setContext(ac, dest) {
    this._ac   = ac
    this._dest = dest
  }

  setPattern(pattern) { this._pattern = pattern }
  setVolume(v)        { this._volume  = v       }

  /**
   * Schedule `bars` consecutive bars of rhythm.
   * @param {number} barStart   Web Audio clock time for bar 1 beat 1
   * @param {number} beatSec    Duration of one beat in seconds
   * @param {number} bars       Number of bars to schedule (default 1)
   */
  scheduleBar(barStart, beatSec, bars = 1) {
    const ac   = this._ac
    const dest = this._dest
    if (!ac || !dest) return

    const hits = RHYTHM_PATTERNS[this._pattern] ?? []
    if (!hits.length) return

    const barDur = beatSec * 4  // 4/4 time
    for (let b = 0; b < bars; b++) {
      hits.forEach(({ beat, type, vol = 1 }) => {
        const t = barStart + b * barDur + beat * beatSec
        const v = vol * this._volume
        if      (type === "kick")  playKick(ac, dest, t, v)
        else if (type === "snare") playSnare(ac, dest, t, v)
        else if (type === "hihat") playHihat(ac, dest, t, v)
        else if (type === "rim")   playRim(ac, dest, t, v)
      })
    }
  }
}
