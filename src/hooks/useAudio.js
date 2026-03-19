import { useRef, useCallback } from "react"
import { AudioEngine } from "../engine/audio"
import { midiToPitchClass } from "../musicUtils"

export function useAudio({ soundRef, onNotesPlayed, onNotesClear }) {
  const engineRef   = useRef(null)
  const clearTimRef = useRef(null)

  function getEngine() {
    if (!engineRef.current) engineRef.current = new AudioEngine()
    return engineRef.current
  }

  const playChord = useCallback(async (chord) => {
    const { sustain, intensity, playMode = "block", tempo = 90, waveType = "default", arpeggioTarget = 4 } = soundRef.current
    const beatMs    = (60 / tempo) * 1000
    const midiNotes = await getEngine().play(chord, { sustain, intensity, playMode, beatMs, arpeggioTarget, waveType })
    const noteObjs  = midiNotes.map(midi => ({
      pc:  midiToPitchClass(midi),
      oct: Math.floor(midi / 12) - 1,
    }))
    onNotesPlayed(noteObjs)

    if (clearTimRef.current) clearTimeout(clearTimRef.current)
    clearTimRef.current = setTimeout(onNotesClear, Math.max(250, sustain * 1000))
  }, [soundRef, onNotesPlayed, onNotesClear])

  const preload = useCallback((waveType) => {
    getEngine().preload(waveType)
  }, [])

  return { playChord, preload }
}
