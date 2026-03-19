import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { NOTES, SCALES } from "../constants"
import { SoundtrackEngine, DEFAULT_LAYERS } from "../engine/soundtrack"
import { detectKey } from "../engine/suggestions"

function getKeyLabel(chords) {
  if (!chords.length) return null
  const { root, scale } = detectKey(chords)
  const scaleName = SCALES.find(([, s]) => s.join() === scale.join())?.[0] ?? "?"
  return `${NOTES[root]} ${scaleName}`
}

export function useSoundtrack() {
  const engineRef = useRef(null)

  const [state,         setState]        = useState("stopped")
  const [currentChord,  setCurrentChord] = useState(null)
  const [history,       setHistory]      = useState([])   // last 4 played chords
  const [queue,         setQueue]        = useState([])   // upcoming chords
  const [mood,          setMoodState]    = useState({ valence: 0, tension: 0, energy: 0, color: 0 })
  const [layers,        setLayersState]  = useState(() => DEFAULT_LAYERS.map(l => ({ ...l })))
  const [rhythmPattern, setRhythmPattern] = useState("none")
  const [rhythmVolume,  setRhythmVolume]  = useState(0.5)

  function _getEngine() {
    if (!engineRef.current) {
      const eng = new SoundtrackEngine()
      eng.onChordChange = (current, hist, q) => {
        setCurrentChord(current)
        setHistory([...hist])
        setQueue([...q])
      }
      eng.onStateChange = s => setState(s)
      engineRef.current = eng
      // Pre-generate queue so UI shows upcoming chords immediately
      eng.pregenerate()
    }
    return engineRef.current
  }

  // Init engine on mount so upcoming chords are visible before play
  useEffect(() => { _getEngine() }, [])

  // Push layer config into engine whenever it changes
  useEffect(() => {
    engineRef.current?.setLayers(layers)
  }, [layers])

  const tempo       = useMemo(() => Math.round(55 + (mood.energy + 1) * 0.5 * 85), [mood.energy])
  const detectedKey = useMemo(() => {
    const context = [...history, currentChord].filter(Boolean)
    return getKeyLabel(context)
  }, [history, currentChord])

  // ── Transport ─────────────────────────────────────────────────────────────

  const play    = useCallback(() => _getEngine().start(),          [])
  const stop    = useCallback(() => _getEngine().stop(),           [])
  const fadeIn  = useCallback((s = 3) => _getEngine().fadeIn(s),  [])
  const fadeOut = useCallback((s = 3) => _getEngine().fadeOut(s), [])
  const reroll  = useCallback(() => _getEngine().reroll(),         [])
  const unlock  = useCallback(() => _getEngine().unlock(),         [])

  // ── Mood ──────────────────────────────────────────────────────────────────

  const setMood = useCallback((key, value) => {
    setMoodState(prev => {
      const next = { ...prev, [key]: value }
      engineRef.current?.setMood(next)
      return next
    })
  }, [])

  // ── Layers ────────────────────────────────────────────────────────────────

  const setLayer = useCallback((id, updates) => {
    setLayersState(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l))
  }, [])

  const applyPreset = useCallback((presetLayers) => {
    setLayersState(presetLayers.map(l => ({ ...l })))
    engineRef.current?.setLayers(presetLayers)
  }, [])

  // ── Rhythm ────────────────────────────────────────────────────────────────

  const setRhythm = useCallback((pattern) => {
    setRhythmPattern(pattern)
    engineRef.current?.setRhythmPattern(pattern)
  }, [])

  const setRhythmVol = useCallback((v) => {
    setRhythmVolume(v)
    engineRef.current?.setRhythmVolume(v)
  }, [])

  return {
    state,
    currentChord,
    history,
    queue,
    detectedKey,
    mood,
    layers,
    rhythmPattern,
    rhythmVolume,
    tempo,
    play,
    stop,
    fadeIn,
    fadeOut,
    reroll,
    unlock,
    setMood,
    setLayer,
    applyPreset,
    setRhythm,
    setRhythmVol,
  }
}
