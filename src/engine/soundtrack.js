import { NOTES, CHORD_TYPES, SCALES } from "../constants"
import { buildAllChords } from "../musicUtils"
import { computeSuggestionsWithMood, detectKey } from "./suggestions"
import { AudioEngine } from "./audio"
import { RhythmEngine } from "./rhythm"

const ALL_CHORDS      = buildAllChords(NOTES, CHORD_TYPES)
const LOOKAHEAD_SEC   = 0.5    // schedule this many seconds ahead
const TICK_MS         = 200    // scheduler interval
const MIN_QUEUE_AHEAD = 8      // keep at least this many chords generated ahead

// ── Scale pools by valence ────────────────────────────────────────────────────
const SCALE_CURVE = [
  ["harmMinor",  3.0, 0.5, 0.0],
  ["minor",      3.0, 2.5, 0.2],
  ["phrygian",   1.0, 0.3, 0.0],
  ["dorian",     0.8, 1.0, 0.5],
  ["locrian",    0.2, 0.0, 0.0],
  ["major",      0.2, 3.0, 4.5],
  ["mixolydian", 0.0, 0.5, 1.5],
  ["lydian",     0.0, 0.2, 2.5],
]

function lerp(a, b, t) { return a + (b - a) * t }

function sampleScale(valence) {
  const pool = SCALE_CURVE.map(([name, wNeg, wNeu, wPos]) => {
    const w = valence < 0
      ? lerp(wNeu, wNeg, -valence)
      : lerp(wNeu, wPos,  valence)
    return [name, Math.max(0, w)]
  })
  const total = pool.reduce((s, [, w]) => s + w, 0)
  let rand = Math.random() * total
  for (const [name, w] of pool) {
    rand -= w
    if (rand <= 0) return SCALES.find(([n]) => n === name)
  }
  return SCALES[0]
}

function pickWeighted(scoreMap, exclude = new Set()) {
  const candidates = [...scoreMap.entries()]
    .filter(([name]) => !exclude.has(name))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 14)
  if (!candidates.length) return null
  const total = candidates.reduce((s, [, v]) => s + v, 0)
  let rand = Math.random() * total
  for (const [name, score] of candidates) {
    rand -= score
    if (rand <= 0) return name
  }
  return candidates[0][0]
}

function chordForLayer(chord, layer) {
  const octShift = (layer.octave - 4) * 12
  const intervals = layer.role === "bass"
    ? [octShift]
    : chord.intervals.map(i => i + octShift)
  return { ...chord, intervals }
}

// ── Default layer definitions ─────────────────────────────────────────────────

export const DEFAULT_LAYERS = [
  { id: "harmony", name: "Harmonie", waveType: "piano",   playMode: "block",    octave: 4, volume: 0.7,  enabled: true,  role: "full" },
  { id: "melody",  name: "Mélodie",  waveType: "harp",    playMode: "arpeggio", octave: 5, volume: 0.45, enabled: true,  role: "full" },
  { id: "bass",    name: "Basse",    waveType: "default", playMode: "block",    octave: 2, volume: 0.55, enabled: true,  role: "bass" },
  { id: "pad",     name: "Pad",      waveType: "default", playMode: "block",    octave: 3, volume: 0.3,  enabled: false, role: "full" },
]

// ── SoundtrackEngine ──────────────────────────────────────────────────────────

export class SoundtrackEngine {
  constructor() {
    this._ac         = null
    this._masterGain = null
    this._rhythmGain = null

    this._state      = "stopped"  // "stopped" | "playing" | "fadingOut"

    this._mood       = { valence: 0, tension: 0, energy: 0, color: 0 }
    this._layers     = DEFAULT_LAYERS.map(l => ({ ...l }))
    this._layerNodes = {}          // id → { engine, gainNode }

    this._rhythmEngine  = new RhythmEngine()
    this._rhythmPattern = "none"
    this._rhythmVolume  = 0.5

    // Continuous queue
    // _fullQueue[_playHead]  = currently playing chord
    // _fullQueue[0.._playHead-1] = played chords (keep last few for context)
    // _fullQueue[_schedHead..]  = not yet scheduled
    this._fullQueue  = []
    this._playHead   = 0    // index of currently playing chord
    this._schedHead  = 0    // index of next chord to schedule

    this._nextTime   = 0    // Web Audio clock for next chord to schedule
    this._tickTimer  = null

    // Public callbacks
    this.onChordChange = null  // (current, history[4], queue[7]) => void
    this.onStateChange = null  // (state) => void
  }

  get state()   { return this._state }
  get tempo()   { return this._moodToTempo() }
  get beatSec() { return 60 / this.tempo }

  // ── Mood → audio mappings ──────────────────────────────────────────────────

  _moodToTempo()     { return Math.round(55 + (this._mood.energy + 1) * 0.5 * 85) }
  _moodToIntensity() { return 0.4  + (this._mood.energy + 1) * 0.5 * 0.6 }
  _moodToSustain()   { return 3.5  - (this._mood.energy + 1) * 0.5 * 2.7 }

  // ── Audio init ─────────────────────────────────────────────────────────────

  _initAudio() {
    if (this._ac) return
    const AC = window.AudioContext || window.webkitAudioContext
    this._ac = new AC()

    this._masterGain = this._ac.createGain()
    this._masterGain.gain.value = 1.0
    this._masterGain.connect(this._ac.destination)

    this._layers.forEach(layer => {
      const gainNode = this._ac.createGain()
      gainNode.gain.value = layer.volume
      gainNode.connect(this._masterGain)
      const engine = new AudioEngine()
      engine.setContext(this._ac, gainNode)
      this._layerNodes[layer.id] = { engine, gainNode }
    })

    this._rhythmGain = this._ac.createGain()
    this._rhythmGain.gain.value = this._rhythmVolume
    this._rhythmGain.connect(this._masterGain)
    this._rhythmEngine.setContext(this._ac, this._rhythmGain)
  }

  // ── Queue generation ───────────────────────────────────────────────────────

  /** Generate one chord and append to _fullQueue */
  _generateNext() {
    const { valence, tension } = this._mood

    if (!this._fullQueue.length) {
      // Bootstrap: pick a starting chord
      const scale     = sampleScale(valence)
      const rootName  = NOTES[Math.floor(Math.random() * 12)]
      const suffix    = valence >= 0 ? "" : "m"
      const start     = ALL_CHORDS.find(c => c.root === rootName && c.suffix === suffix)
                     ?? ALL_CHORDS.find(c => c.root === rootName)
      if (start) this._fullQueue.push(start)
      return
    }

    // Use the last 8 chords as harmonic context
    const ctx     = this._fullQueue.slice(Math.max(0, this._fullQueue.length - 8))
    const exclude = new Set(this._fullQueue.slice(-3).map(c => c.name))
    const suggs   = computeSuggestionsWithMood(ctx, ALL_CHORDS, { valence, tension })
    const name    = pickWeighted(suggs, exclude)
    const next    = name ? ALL_CHORDS.find(c => c.name === name) : null

    if (next) {
      this._fullQueue.push(next)
    } else {
      // Fallback: modulate by fifth
      const lastRoot = NOTES.indexOf(this._fullQueue.at(-1).root)
      const newRoot  = NOTES[(lastRoot + 7) % 12]
      const suffix   = valence >= 0 ? "" : "m"
      const fallback = ALL_CHORDS.find(c => c.root === newRoot && c.suffix === suffix)
      if (fallback) this._fullQueue.push(fallback)
    }
  }

  /** Fill queue up to MIN_QUEUE_AHEAD chords ahead of _schedHead */
  _fillQueue() {
    while (this._fullQueue.length < this._schedHead + MIN_QUEUE_AHEAD) {
      this._generateNext()
    }
  }

  /** Trim old played chords to avoid unbounded memory growth */
  _compact() {
    const KEEP_HISTORY = 10
    if (this._playHead > KEEP_HISTORY * 2) {
      const trim        = this._playHead - KEEP_HISTORY
      this._fullQueue   = this._fullQueue.slice(trim)
      this._schedHead  -= trim
      this._playHead   -= trim
    }
  }

  /** Build the UI snapshot arrays from current state */
  _snapshot() {
    const current = this._fullQueue[this._playHead] ?? null
    const history = this._fullQueue.slice(Math.max(0, this._playHead - 4), this._playHead)
    const queue   = this._fullQueue.slice(this._playHead + 1, this._playHead + 1 + MIN_QUEUE_AHEAD - 1)
    return { current, history, queue }
  }

  _notify() {
    const { current, history, queue } = this._snapshot()
    this.onChordChange?.(current, history, queue)
  }

  // ── Invalidate future queue on mood change ─────────────────────────────────

  _invalidateQueue() {
    // Keep only the chords that have been/are being scheduled (up to schedHead)
    // Unscheduled future chords are discarded and regenerated with new mood
    this._fullQueue = this._fullQueue.slice(0, this._schedHead)
    this._fillQueue()
    this._notify()
  }

  // ── Scheduler ─────────────────────────────────────────────────────────────

  _tick() {
    if (this._state === "stopped") return

    const ac       = this._ac
    const now      = ac.currentTime
    const beatSec  = this.beatSec
    const chordDur = beatSec * 4   // 1 bar = 4 beats
    const beatMs   = beatSec * 1000
    const sustain  = Math.min(this._moodToSustain(), chordDur * 0.92)
    const intensity = this._moodToIntensity()

    this._fillQueue()

    while (this._nextTime < now + LOOKAHEAD_SEC) {
      if (this._schedHead >= this._fullQueue.length) {
        this._fillQueue()
        if (this._schedHead >= this._fullQueue.length) break
      }

      const chord    = this._fullQueue[this._schedHead]
      const chordIdx = this._schedHead

      // Schedule each enabled layer
      this._layers.forEach(layer => {
        if (!layer.enabled) return
        const { engine } = this._layerNodes[layer.id] ?? {}
        if (!engine) return
        engine.play(chordForLayer(chord, layer), {
          startTime:      this._nextTime,
          sustain,
          intensity,
          playMode:       layer.playMode,
          beatMs,
          arpeggioTarget: Math.max(4, chord.intervals?.length ?? 3),
          waveType:       layer.waveType,
        })
      })

      // Schedule rhythm
      if (this._rhythmPattern !== "none") {
        this._rhythmEngine.scheduleBar(this._nextTime, beatSec, 1)
      }

      // UI callback when this chord actually starts playing
      const delay = Math.max(0, (this._nextTime - now) * 1000 - 30)
      setTimeout(() => {
        if (this._state === "stopped") return
        this._playHead = chordIdx
        this._compact()
        this._notify()
      }, delay)

      this._schedHead++
      this._nextTime += chordDur
    }

    this._tickTimer = setTimeout(() => this._tick(), TICK_MS)
  }

  _stopTick() {
    clearTimeout(this._tickTimer)
    this._tickTimer = null
  }

  _setState(s) {
    this._state = s
    this.onStateChange?.(s)
  }

  // ── Public API ─────────────────────────────────────────────────────────────

  start() {
    this._initAudio()
    if (this._ac.state === "suspended") this._ac.resume()
    if (this._state !== "stopped") return

    this._masterGain.gain.cancelScheduledValues(this._ac.currentTime)
    this._masterGain.gain.setValueAtTime(1, this._ac.currentTime)

    // Generate initial queue if empty
    if (!this._fullQueue.length) {
      this._fillQueue()
      this._playHead  = 0
      this._schedHead = 0
    }

    this._nextTime = this._ac.currentTime + 0.05
    this._setState("playing")
    this._tick()
    this._notify()

    // Preload soundfonts in background
    this._layers.forEach(layer => {
      const { engine } = this._layerNodes[layer.id] ?? {}
      if (engine && ["piano","harp","marimba"].includes(layer.waveType)) {
        engine.preload(layer.waveType)
      }
    })
  }

  stop() {
    this._stopTick()
    if (this._masterGain) {
      const now = this._ac.currentTime
      this._masterGain.gain.cancelScheduledValues(now)
      this._masterGain.gain.setValueAtTime(0.001, now)
    }
    this._setState("stopped")
  }

  fadeIn(durationSec = 3) {
    this._initAudio()
    if (this._ac.state === "suspended") this._ac.resume()

    const now = this._ac.currentTime
    this._masterGain.gain.cancelScheduledValues(now)
    this._masterGain.gain.setValueAtTime(0.001, now)
    this._masterGain.gain.linearRampToValueAtTime(1, now + durationSec)

    if (this._state === "stopped") {
      if (!this._fullQueue.length) {
        this._fillQueue()
        this._playHead  = 0
        this._schedHead = 0
      }
      this._nextTime = now + 0.05
    }
    this._setState("playing")
    if (!this._tickTimer) this._tick()
    this._notify()
  }

  fadeOut(durationSec = 3) {
    if (!this._masterGain || this._state === "stopped") return
    const now = this._ac.currentTime
    this._setState("fadingOut")
    this._masterGain.gain.cancelScheduledValues(now)
    this._masterGain.gain.setValueAtTime(this._masterGain.gain.value, now)
    this._masterGain.gain.linearRampToValueAtTime(0.001, now + durationSec)
    setTimeout(() => this.stop(), durationSec * 1000 + 100)
  }

  reroll() {
    if (this._state === "stopped") return
    // Discard everything after the currently-scheduled head
    this._fullQueue  = this._fullQueue.slice(0, this._schedHead)
    this._fillQueue()
    this._notify()
  }

  setMood(mood) {
    this._mood = { ...this._mood, ...mood }
    // Pre-generate updated upcoming chords so the UI updates immediately
    // (only if not stopped)
    if (this._fullQueue.length) {
      this._invalidateQueue()
    }
  }

  /** Pre-generate the visible queue without starting playback (for UI preview) */
  pregenerate() {
    this._fillQueue()
    this._notify()
  }

  setLayers(layers) {
    this._layers = layers
    if (!this._ac) return
    layers.forEach(layer => {
      const node = this._layerNodes[layer.id]
      if (node) node.gainNode.gain.setTargetAtTime(layer.volume, this._ac.currentTime, 0.05)
    })
  }

  setRhythmPattern(pattern) {
    this._rhythmPattern = pattern
    this._rhythmEngine.setPattern(pattern)
  }

  setRhythmVolume(v) {
    this._rhythmVolume = v
    this._rhythmEngine.setVolume(v)
    if (this._rhythmGain) {
      this._rhythmGain.gain.setTargetAtTime(v, this._ac.currentTime, 0.05)
    }
  }

  unlock() {
    this._initAudio()
    if (this._ac.state === "suspended") this._ac.resume()
  }
}
