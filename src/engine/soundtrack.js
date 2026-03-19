import { NOTES, CHORD_TYPES, SCALES } from "../constants"
import { buildAllChords } from "../musicUtils"
import { computeSuggestionsWithMood, detectKey } from "./suggestions"
import { AudioEngine } from "./audio"
import { RhythmEngine } from "./rhythm"

const ALL_CHORDS = buildAllChords(NOTES, CHORD_TYPES)

const LOOKAHEAD_SEC  = 0.5   // schedule this far ahead
const TICK_MS        = 200   // scheduler interval
const PROG_LENGTH    = 4     // chords per progression

// ── Scale pools by valence ────────────────────────────────────────────────────
// [[scaleName, weightAt-1, weightAt0, weightAt+1], ...]
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

function sampleScalePool(valence) {
  // valence: -1..1 → interpolate weights between negative/neutral/positive
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

// ── Helpers ───────────────────────────────────────────────────────────────────

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
  let intervals = chord.intervals
  if (layer.role === "bass") {
    intervals = [octShift]  // root only
  } else {
    intervals = intervals.map(i => i + octShift)
  }
  return { ...chord, intervals }
}

// ── Default layer definitions ─────────────────────────────────────────────────

export const DEFAULT_LAYERS = [
  { id: "harmony", name: "Harmonie", waveType: "piano",   playMode: "block",   octave: 4, volume: 0.7,  enabled: true,  role: "full" },
  { id: "melody",  name: "Mélodie",  waveType: "harp",    playMode: "arpeggio",octave: 5, volume: 0.45, enabled: true,  role: "full" },
  { id: "bass",    name: "Basse",    waveType: "default", playMode: "block",   octave: 2, volume: 0.55, enabled: true,  role: "bass" },
  { id: "pad",     name: "Pad",      waveType: "default", playMode: "block",   octave: 3, volume: 0.3,  enabled: false, role: "full" },
]

// ── SoundtrackEngine ──────────────────────────────────────────────────────────

export class SoundtrackEngine {
  constructor() {
    this._ac          = null
    this._masterGain  = null
    this._rhythmGain  = null

    this._state       = "stopped"   // "stopped" | "playing" | "fadingIn" | "fadingOut"

    this._mood        = { valence: 0, tension: 0, energy: 0, color: 0 }
    this._layers      = DEFAULT_LAYERS.map(l => ({ ...l }))
    this._layerNodes  = {}   // id → { engine: AudioEngine, gainNode: GainNode }

    this._rhythmEngine  = new RhythmEngine()
    this._rhythmPattern = "none"
    this._rhythmVolume  = 0.5

    this._progression = []
    this._progIndex   = 0
    this._nextTime    = 0   // Web Audio clock for next chord
    this._rerollFlag  = false

    this._tickTimer   = null

    // Callbacks (set by useSoundtrack)
    this.onChordChange  = null   // (chord, index, progression) => void
    this.onStateChange  = null   // (state) => void
    this.onProgChange   = null   // (progression) => void
  }

  // ── Accessors ──────────────────────────────────────────────────────────────

  get state()    { return this._state }
  get tempo()    { return this._moodToTempo() }
  get beatSec()  { return 60 / this.tempo }
  get layers()   { return this._layers }

  // ── Mood → audio mappings ──────────────────────────────────────────────────

  _moodToTempo() {
    // energy -1..1 → 55..140 bpm
    return Math.round(55 + (this._mood.energy + 1) * 0.5 * 85)
  }

  _moodToIntensity() {
    // energy -1..1 → 0.4..1.0
    return 0.4 + (this._mood.energy + 1) * 0.5 * 0.6
  }

  _moodToSustain() {
    // energy -1..1 → 3.5..0.8 (softer = longer sustain)
    return 3.5 - (this._mood.energy + 1) * 0.5 * 2.7
  }

  _moodToArpTarget() {
    return 6
  }

  // ── Audio context setup ────────────────────────────────────────────────────

  _initAudio() {
    if (this._ac) return
    const AC = window.AudioContext || window.webkitAudioContext
    this._ac = new AC()

    this._masterGain = this._ac.createGain()
    this._masterGain.gain.value = 1.0
    this._masterGain.connect(this._ac.destination)

    // Build layer gain nodes + engines
    this._layers.forEach(layer => {
      const gainNode = this._ac.createGain()
      gainNode.gain.value = layer.volume
      gainNode.connect(this._masterGain)

      const engine = new AudioEngine()
      engine.setContext(this._ac, gainNode)

      this._layerNodes[layer.id] = { engine, gainNode }
    })

    // Rhythm gain
    this._rhythmGain = this._ac.createGain()
    this._rhythmGain.gain.value = this._rhythmVolume
    this._rhythmGain.connect(this._masterGain)
    this._rhythmEngine.setContext(this._ac, this._rhythmGain)
  }

  // ── Progression generation ─────────────────────────────────────────────────

  _generateProgression(fromChord = null) {
    const { valence, tension } = this._mood
    const scale    = sampleScalePool(valence)
    const rootIdx  = Math.floor(Math.random() * 12)
    const rootName = NOTES[rootIdx]

    // Pick starting chord: quality matches valence
    let startChord
    if (fromChord) {
      startChord = fromChord
    } else {
      const wantSuffix = valence >= 0 ? "" : "m"
      startChord =
        ALL_CHORDS.find(c => c.root === rootName && c.suffix === wantSuffix) ??
        ALL_CHORDS.find(c => c.root === rootName)
    }

    if (!startChord) return []

    const prog = [startChord]
    const seen = new Set([startChord.name])

    for (let i = 1; i < PROG_LENGTH; i++) {
      const suggs = computeSuggestionsWithMood(prog, ALL_CHORDS, { valence, tension })
      const name  = pickWeighted(suggs, seen)
      const next  = name ? ALL_CHORDS.find(c => c.name === name) : null
      if (next) { prog.push(next); seen.add(next.name) }
    }

    return prog
  }

  // ── Scheduler ─────────────────────────────────────────────────────────────

  _tick() {
    if (this._state === "stopped") return

    const ac  = this._ac
    const now = ac.currentTime

    // Ensure we always have a valid progression
    if (!this._progression.length) {
      this._progression = this._generateProgression()
      this._progIndex   = 0
      this._nextTime    = now + 0.05
      this.onProgChange?.(this._progression)
    }

    while (this._nextTime < now + LOOKAHEAD_SEC) {
      const chord    = this._progression[this._progIndex]
      const beatSec  = this.beatSec
      const chordDur = beatSec * 4   // 1 bar = 4 beats
      const beatMs   = beatSec * 1000
      const sustain  = Math.min(this._moodToSustain(), chordDur * 0.9)
      const intensity = this._moodToIntensity()

      // Schedule each enabled layer
      this._layers.forEach(layer => {
        if (!layer.enabled) return
        const { engine } = this._layerNodes[layer.id] ?? {}
        if (!engine) return

        const layerChord = chordForLayer(chord, layer)
        engine.play(layerChord, {
          startTime:     this._nextTime,
          sustain,
          intensity,
          playMode:      layer.playMode,
          beatMs,
          arpeggioTarget: this._moodToArpTarget(),
          waveType:      layer.waveType,
        })
      })

      // Schedule rhythm (1 bar, aligned with chord)
      if (this._rhythmPattern !== "none") {
        this._rhythmEngine.scheduleBar(this._nextTime, beatSec, 1)
      }

      // Schedule UI update callback
      const delay = Math.max(0, (this._nextTime - now) * 1000 - 50)
      const chordSnapshot = { ...chord }
      const idx = this._progIndex
      const progSnapshot = [...this._progression]
      setTimeout(() => {
        if (this._state !== "stopped") {
          this.onChordChange?.(chordSnapshot, idx, progSnapshot)
        }
      }, delay)

      this._nextTime += chordDur
      this._progIndex = (this._progIndex + 1) % this._progression.length

      // Reroll: regenerate on next cycle start
      if (this._progIndex === 0 && this._rerollFlag) {
        this._rerollFlag  = false
        const last = this._progression[this._progression.length - 1]
        this._progression = this._generateProgression(last)
        this.onProgChange?.(this._progression)
      }
    }

    this._tickTimer = setTimeout(() => this._tick(), TICK_MS)
  }

  _stopTick() {
    if (this._tickTimer) {
      clearTimeout(this._tickTimer)
      this._tickTimer = null
    }
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

    this._progression = this._generateProgression()
    this._progIndex   = 0
    this._nextTime    = this._ac.currentTime + 0.05
    this.onProgChange?.(this._progression)

    this._setState("playing")
    this._tick()

    // Preload soundfont instruments in background
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
      this._progression = this._generateProgression()
      this._progIndex   = 0
      this._nextTime    = now + 0.05
      this.onProgChange?.(this._progression)
    }
    this._setState("playing")
    if (!this._tickTimer) this._tick()
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
    this._rerollFlag = true
  }

  setMood(mood) {
    this._mood = { ...this._mood, ...mood }
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
