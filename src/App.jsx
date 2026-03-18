import { useEffect, useMemo, useRef, useState, useCallback } from "react"

import { NOTES, CHORD_TYPES, NOTE_COLORS, SCALES, TEXT, NOTE_TO_PC } from "./constants"
import { buildChordMidi, midiToFreq, midiToPitchClass, buildAllChords, buildGroupedChords, recognizeChord } from "./musicUtils"
import { detectKey, computeSuggestions } from "./engine/suggestions"
import { downloadMidi } from "./engine/midi"
import { useAudio }    from "./hooks/useAudio"
import { usePlayback } from "./hooks/usePlayback"
import { useTimeline } from "./hooks/useTimeline"

import { Timeline }        from "./components/Timeline"
import { KeyboardDisplay } from "./components/KeyboardDisplay"
import { SoundControls }   from "./components/SoundControls"
import { ChordGrid }       from "./components/ChordGrid"
import { ChordDetail }     from "./components/ChordDetail"

const LS_KEY = "chord-explorer-last-progression"
function loadSaved() { try { return JSON.parse(localStorage.getItem(LS_KEY)) ?? [] } catch { return [] } }
function saveProg(p) { try { localStorage.setItem(LS_KEY, JSON.stringify(p)) } catch {} }

export default function App() {
  const allChords     = useMemo(() => buildAllChords(NOTES, CHORD_TYPES),    [])
  const groupedChords = useMemo(() => buildGroupedChords(NOTES, CHORD_TYPES), [])

  const [selectedChordName,  setSelectedChordName]  = useState("")
  const [selectedOctave,     setSelectedOctave]     = useState(4)
  const [inversion,          setInversion]          = useState(0)
  // currentPlayedNotes: array of {pc, oct} to support per-octave highlight on 2-octave keyboard
  const [currentPlayedNotes, setCurrentPlayedNotes] = useState([])
  const [playingTimelineId,  setPlayingTimelineId]  = useState(null)
  const [isPlaying,          setIsPlaying]          = useState(false)
  const [showSuggestions,    setShowSuggestions]    = useState(true)
  const [loopMode,           setLoopMode]           = useState(false)
  const [savedProg,          setSavedProg]          = useState(() => loadSaved())

  const [keyboardActiveNotes, setKeyboardActiveNotes] = useState(new Set())
  const [selectedTimelineId,  setSelectedTimelineId]  = useState(null)
  const [selectedBeats,       setSelectedBeats]       = useState(1)

  const [sound, setSound] = useState({ sustain: 1.8, intensity: 0.75, spread: 0.015, tempo: 90, waveType: "triangle" })
  function setSoundKey(key, val) { setSound(s => ({ ...s, [key]: val })) }

  const soundRef  = useRef(sound)
  useEffect(() => { soundRef.current = sound }, [sound])

  const beatMs    = useMemo(() => (60 / sound.tempo) * 1000, [sound.tempo])
  const beatMsRef = useRef(beatMs)
  useEffect(() => { beatMsRef.current = beatMs }, [beatMs])

  const timeline       = useTimeline()
  const progressionRef = useRef([])
  useEffect(() => {
    progressionRef.current = timeline.progression
    if (timeline.progression.length > 0) {
      saveProg(timeline.progression)
      setSavedProg(timeline.progression)
    }
  }, [timeline.progression])

  // Audio context ref for playing single notes from keyboard
  const audioCtxRef = useRef(null)
  function getAudioCtx() {
    if (!audioCtxRef.current) {
      try {
        audioCtxRef.current = new window.AudioContext()
      } catch (e) {
        console.error("AudioContext creation failed:", e)
        return null
      }
    }
    return audioCtxRef.current
  }

  const { playChord } = useAudio({
    soundRef,
    onNotesPlayed: useCallback(notes => setCurrentPlayedNotes(notes), []),
    onNotesClear:  useCallback(()    => setCurrentPlayedNotes([]),    []),
  })

  // Play a chord with octave + inversion applied
  const playChordShifted = useCallback(async (chord, octave, inv) => {
    // inline inversion logic to avoid circular import
    const intervals = chord.intervals
    const count = intervals.length
    const rot = ((inv % count) + count) % count
    const invIntervals = rot === 0 ? intervals
      : [...intervals.slice(rot), ...intervals.slice(0, rot).map(i => i + 12)]
    const octShift = (octave - 4) * 12
    const shifted = { ...chord, intervals: invIntervals.map(i => i + octShift) }
    await playChord(shifted)
  }, [playChord])

  // Play a single note (from keyboard click) and toggle it in the active recognition set
  const playSingleNote = useCallback(async (noteName, oct) => {
    const ac = getAudioCtx()
    if (!ac) return
    if (ac.state === "suspended") await ac.resume()
    const pc   = NOTE_TO_PC[noteName]
    const midi = 12 * (oct + 1) + pc
    const freq = midiToFreq(midi)
    const { sustain, intensity, waveType = "triangle" } = soundRef.current
    const now = ac.currentTime
    const osc  = ac.createOscillator()
    const gain = ac.createGain()
    osc.type = waveType
    osc.frequency.value = freq
    gain.gain.setValueAtTime(0.0001, now)
    gain.gain.exponentialRampToValueAtTime(0.2 * intensity, now + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, now + Math.max(0.3, sustain))
    osc.connect(gain)
    gain.connect(ac.destination)
    osc.start(now)
    osc.stop(now + Math.max(0.3, sustain))
    // light up that specific key briefly
    setCurrentPlayedNotes([{ pc, oct }])
    setTimeout(() => setCurrentPlayedNotes([]), Math.max(300, sustain * 1000))
    // toggle this specific note (per-octave) in the recognition set
    const noteKey = `${pc}-${oct}`
    setKeyboardActiveNotes(prev => {
      const next = new Set(prev)
      if (next.has(noteKey)) next.delete(noteKey); else next.add(noteKey)
      return next
    })
  }, [])

  // Plays a timeline entry respecting its stored octave + inversion
  const playTimelineEntry = useCallback(async (entry) => {
    const inv = entry.inversion ?? 0
    const oct = entry.octave ?? 4
    await playChordShifted(entry, oct, inv)
  }, [playChordShifted])

  const playback = usePlayback({
    progressionRef, beatMsRef, playChord: playTimelineEntry,
    onStart:      useCallback(() => setIsPlaying(true),  []),
    onStop:       useCallback(() => { setIsPlaying(false); setPlayingTimelineId(null) }, []),
    onChordStart: useCallback(id  => setPlayingTimelineId(id), []),
  })

  useEffect(() => {
    const handler = e => {
      if (e.code !== "Space") return
      if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return
      e.preventDefault()
      if (progressionRef.current.length > 0) playback.toggle(loopMode)
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [loopMode, playback.toggle])

  useEffect(() => { if (!loopMode && isPlaying) playback.stop() }, [loopMode])

  const selectedChord = useMemo(() =>
    allChords.find(c => c.name === selectedChordName) ?? null, [allChords, selectedChordName])

  // MIDI notes of the selected chord with current inversion + octave (for exact keyboard highlighting)
  const selectedChordMidiNotes = useMemo(() => {
    if (!selectedChord) return []
    const count = selectedChord.intervals.length
    const rot = ((inversion % count) + count) % count
    const invIntervals = rot === 0 ? selectedChord.intervals
      : [...selectedChord.intervals.slice(rot), ...selectedChord.intervals.slice(0, rot).map(i => i + 12)]
    const octShift = (selectedOctave - 4) * 12
    return buildChordMidi(selectedChord.root, invIntervals).map(m => m + octShift)
  }, [selectedChord, inversion, selectedOctave])

  // Keyboard octaves — dynamically cover all notes of the current chord
  const keyboardOctaves = useMemo(() => {
    if (!selectedChordMidiNotes.length) return [3, 4]
    const minOct = Math.min(...selectedChordMidiNotes.map(m => Math.floor(m / 12) - 1))
    const maxOct = Math.max(...selectedChordMidiNotes.map(m => Math.floor(m / 12) - 1))
    const startOct = Math.max(0, minOct)
    const endOct = Math.max(startOct + 1, maxOct)
    return Array.from({ length: endOct - startOct + 1 }, (_, i) => startOct + i)
  }, [selectedChordMidiNotes])

  const timelineNameSet = useMemo(() =>
    new Set(timeline.progression.map(e => e.name)), [timeline.progression])

  const suggestions = useMemo(() => {
    if (!showSuggestions || !timeline.progression.length) return new Map()
    return computeSuggestions(timeline.progression, allChords)
  }, [timeline.progression, allChords, showSuggestions])

  const detectedKey = useMemo(() => {
    if (!timeline.progression.length) return null
    const { root, scale } = detectKey(timeline.progression)
    const scaleName = SCALES.find(([, s]) => s.join() === scale.join())?.[0] ?? "?"
    return `${NOTES[root]} ${scaleName}`
  }, [timeline.progression])

  const recognizedChord = useMemo(() => {
    const pcs = new Set([...keyboardActiveNotes].map(k => parseInt(k.split("-")[0])))
    return recognizeChord(pcs, allChords)
  }, [keyboardActiveNotes, allChords])

  function handleChordClick(chord) {
    setSelectedChordName(chord.name)
    setSelectedTimelineId(null)
    setInversion(0)
    setSelectedOctave(4)
    playChord(chord)
  }
  function handleChordContextMenu(chord) {
    setSelectedChordName(chord.name)
    setSelectedTimelineId(null)
    setInversion(0)
    setSelectedOctave(4)
    playChord(chord)
    timeline.addChord(chord)
  }
  function handleTimelineChordPlay(chord) {
    const inv = chord.inversion ?? 0
    const oct = chord.octave ?? 4
    setSelectedChordName(chord.name)
    setSelectedTimelineId(chord.id)
    setInversion(inv)
    setSelectedOctave(oct)
    setSelectedBeats(chord.beats ?? 1)
    playChordShifted(chord, oct, inv)
  }
  function handleTogglePlayback() { if (timeline.progression.length) playback.toggle(loopMode) }
  function handleClear() { playback.stop(); timeline.clear() }
  function handleExportMidi() { downloadMidi(timeline.progression, sound.tempo) }
  function handleLoadSaved() {
    if (!savedProg.length) return
    playback.stop()
    timeline.loadProgression(savedProg)
  }

  // Keyboard highlight helpers — now per-octave aware
  function isPlayedPitchWithOct(pc, oct) {
    return currentPlayedNotes.some(n => n.pc === pc && n.oct === oct)
  }
  function isSelectedPitchWithOct(pc, oct) {
    return selectedChordMidiNotes.some(
      midi => midiToPitchClass(midi) === pc && Math.floor(midi / 12) - 1 === oct
    )
  }

  const hasSaved = savedProg.length > 0 && (
    savedProg.length !== timeline.progression.length ||
    savedProg.some((e, i) => e.name !== timeline.progression[i]?.name)
  )

  return (
    <div style={{
      fontFamily: "'Courier New', monospace",
      padding: "12px 16px 24px",
      maxWidth: 1400, margin: "0 auto",
      backgroundColor: "#0d0d0d", color: TEXT.primary,
      minHeight: "100vh",
    }}>
      <style>{`
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { height: 4px; width: 4px; background: #111; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
        input[type=range] { accent-color: #4a8abf; }
      `}</style>

      {/* ── Header ── */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 8, flexWrap: "wrap" }}>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: "0.08em", color: "#fff" }}>
            CHORD EXPLORER
          </h1>
          <span style={{ fontSize: 11, color: TEXT.faint, letterSpacing: "0.06em", fontWeight: 700 }}>v1.0</span>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {[["Click","play"],["Right-click","add"],["Drag","timeline"],["Space","play/stop"]].map(([k,d]) => (
              <span key={k} style={{ fontSize: 11, color: TEXT.secondary, whiteSpace: "nowrap" }}>
                <span style={{
                  display: "inline-block", background: "#1e1e1e", border: "1px solid #2e2e2e",
                  borderRadius: 4, padding: "1px 5px", marginRight: 4, color: TEXT.primary, fontSize: 10,
                }}>{k}</span>{d}
              </span>
            ))}
          </div>
          <a
            href="https://buymeacoffee.com/loupv"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              marginLeft: "auto",
              display: "inline-flex", alignItems: "center", gap: 5,
              background: "#FFDD00", color: "#000", fontFamily: "inherit",
              fontWeight: 700, fontSize: 11, letterSpacing: "0.05em",
              padding: "5px 11px", borderRadius: 6, textDecoration: "none", flexShrink: 0,
            }}
          >
            ☕ Buy me a coffee
          </a>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 6 }}>
          {[
            { icon: "♩", title: "BROWSE", body: "168 chords · 12 roots · 14 types. Click to hear." },
            { icon: "⟶", title: "BUILD",  body: "Drag into timeline. Reorder freely. Key detected live." },
            { icon: "▶", title: "PLAY",   body: "Space or Play. Tempo & all params apply live." },
            { icon: "◉", title: "SUGGEST",body: "Coloured border = suggested next chord. Brighter = stronger fit." },
          ].map(({ icon, title, body }) => (
            <div key={title} style={{ background: "#111", border: "1px solid #1e1e1e", borderRadius: 8, padding: "7px 9px", display: "flex", gap: 7 }}>
              <span style={{ fontSize: 12, color: "#4a8abf", flexShrink: 0 }}>{icon}</span>
              <div>
                <div style={{ fontSize: 10, fontWeight: 700, color: TEXT.primary, letterSpacing: "0.05em", marginBottom: 2 }}>{title}</div>
                <p style={{ margin: 0, fontSize: 10, color: TEXT.secondary, lineHeight: 1.45 }}>{body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── Controls strip ── */}
      {/* Row 1: timeline + chord detail */}
      <div style={{ display: "flex", gap: 10, marginBottom: 10, flexWrap: "wrap", alignItems: "stretch" }}>
        <div style={{ flex: "1 1 300px", minWidth: 0 }}>
          <Timeline
            progression={timeline.progression}
            dragOverIndex={timeline.dragOverIndex}
            timelineDropActive={timeline.timelineDropActive}
            detectedKey={detectedKey}
            showSuggestions={showSuggestions}
            suggestions={suggestions}
            loopMode={loopMode}
            isPlaying={isPlaying}
            playingTimelineId={playingTimelineId}
            hasSaved={hasSaved}
            savedProgSummary={savedProg.slice(0,5).map(e=>e.name).join(" › ")}
            onToggleSuggestions={() => setShowSuggestions(s => !s)}
            onToggleLoop={() => setLoopMode(l => !l)}
            onTogglePlayback={handleTogglePlayback}
            onClear={handleClear}
            onExportMidi={handleExportMidi}
            onLoadSaved={handleLoadSaved}
            onRemove={timeline.removeChord}
            onChordPlay={handleTimelineChordPlay}
            onTimelineDragStart={timeline.onTimelineDragStart}
            onSlotDragOver={timeline.onSlotDragOver}
            onZoneDragOver={timeline.onZoneDragOver}
            onZoneDragLeave={timeline.onZoneDragLeave}
            onZoneDrop={timeline.onZoneDrop}
          />
        </div>

        {/* Chord detail */}
        <ChordDetail
          chord={selectedChord}
          octave={selectedOctave}
          inversion={inversion}
          beats={selectedBeats}
          onOctaveChange={oct => {
            setSelectedOctave(oct)
            if (selectedTimelineId) timeline.updateEntry(selectedTimelineId, { octave: oct })
            playChordShifted(selectedChord, oct, inversion)
          }}
          onInversionChange={inv => {
            setInversion(inv)
            if (selectedTimelineId) timeline.updateEntry(selectedTimelineId, { inversion: inv })
            playChordShifted(selectedChord, selectedOctave, inv)
          }}
          onBeatsChange={selectedTimelineId ? beats => {
            setSelectedBeats(beats)
            timeline.updateEntry(selectedTimelineId, { beats })
          } : null}
          onPlay={playChordShifted}
        />

      </div>
      {/* Row 2: keyboard + sound controls */}
      <div style={{ display: "flex", gap: 10, marginBottom: 14, alignItems: "stretch" }}>
        <KeyboardDisplay
          octaves={keyboardOctaves}
          isPlayedPitchWithOct={isPlayedPitchWithOct}
          isSelectedPitchWithOct={isSelectedPitchWithOct}
          onNoteClick={playSingleNote}
          selectedChordName={selectedChordName}
          selectedChordColor={selectedChord ? NOTE_COLORS[selectedChord.root] : TEXT.faint}
          keyboardActiveNotes={keyboardActiveNotes}
          recognizedChord={recognizedChord}
          activeNoteCount={new Set([...keyboardActiveNotes].map(k => parseInt(k.split("-")[0]))).size}
          recognizedChordColor={recognizedChord ? NOTE_COLORS[recognizedChord.root] : TEXT.faint}
          onClearKeyboardNotes={() => setKeyboardActiveNotes(new Set())}
          onRecognizedChordClick={chord => { handleChordClick(chord); setKeyboardActiveNotes(new Set()) }}
        />

        <SoundControls values={sound} onChange={setSoundKey} />
      </div>

      {/* ── Chord grid ── */}
      <ChordGrid
        groupedChords={groupedChords}
        allChords={allChords}
        selectedChordName={selectedChordName}
        timelineNameSet={timelineNameSet}
        suggestions={suggestions}
        showSuggestions={showSuggestions}
        onChordClick={handleChordClick}
        onChordContextMenu={handleChordContextMenu}
        onChordDragStart={timeline.onGridDragStart}
      />
    </div>
  )
}
