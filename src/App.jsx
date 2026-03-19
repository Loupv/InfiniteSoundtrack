import { useEffect, useMemo, useRef, useState, useCallback } from "react"
import {
  DndContext, DragOverlay,
  PointerSensor, TouchSensor,
  useSensor, useSensors,
  closestCenter,
} from "@dnd-kit/core"

import { NOTES, CHORD_TYPES, NOTE_COLORS, SCALES, TEXT, NOTE_TO_PC, NOTE_FR } from "./constants"
import { t } from "./i18n"
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

const LS_KEY      = "chord-explorer-last-progression"
const LS_NOTATION = "chord-explorer-notation"
function loadSaved() { try { return JSON.parse(localStorage.getItem(LS_KEY)) ?? [] } catch { return [] } }
function saveProg(p) { try { localStorage.setItem(LS_KEY, JSON.stringify(p)) } catch {} }

function track(eventName, params = {}) {
  try { window.gtag?.("event", eventName, params) } catch {}
}

function encodeProgression(progression) {
  const data = progression.map(e => {
    const obj = { n: e.name }
    if ((e.beats     ?? 1) !== 1) obj.b = e.beats
    if ((e.octave    ?? 4) !== 4) obj.o = e.octave
    if ((e.inversion ?? 0) !== 0) obj.i = e.inversion
    return obj
  })
  return btoa(JSON.stringify(data))
}

function decodeProgression(encoded, allChords) {
  try {
    const data = JSON.parse(atob(encoded))
    if (!Array.isArray(data)) return null
    return data.map(item => {
      const chord = allChords.find(c => c.name === item.n)
      if (!chord) return null
      return { ...chord, beats: item.b ?? 1, octave: item.o ?? 4, inversion: item.i ?? 0 }
    }).filter(Boolean)
  } catch { return null }
}

function pickWeightedName(suggMap, exclude = new Set()) {
  const candidates = [...suggMap.entries()]
    .filter(([name]) => !exclude.has(name))
    .sort((a, b) => b[1] - a[1])
    .slice(0, 12)
  if (!candidates.length) return null
  const total = candidates.reduce((s, [, v]) => s + v, 0)
  let rand = Math.random() * total
  for (const [name, score] of candidates) {
    rand -= score
    if (rand <= 0) return name
  }
  return candidates[0][0]
}

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
  const [notation,            setNotation]            = useState(() => localStorage.getItem(LS_NOTATION) ?? "english")
  const [showSettings,        setShowSettings]        = useState(false)

  const [shareCopied, setShareCopied] = useState(false)

  const [sound, setSound] = useState({ sustain: 1.8, intensity: 0.75, spread: 0.015, tempo: 90, waveType: "default" })
  const [loadingInstrument, setLoadingInstrument] = useState(false)

  function setSoundKey(key, val) {
    setSound(s => ({ ...s, [key]: val }))
    if (key === "waveType") {
      const SF = { piano: true, harp: true, marimba: true }
      if (SF[val]) {
        setLoadingInstrument(true)
        preload(val)
        // resolve loading once first chord plays, or after timeout
        setTimeout(() => setLoadingInstrument(false), 3000)
      } else {
        setLoadingInstrument(false)
      }
    }
  }

  const soundRef  = useRef(sound)
  useEffect(() => { soundRef.current = sound }, [sound])

  const beatMs    = useMemo(() => (60 / sound.tempo) * 1000, [sound.tempo])
  const beatMsRef = useRef(beatMs)
  useEffect(() => { beatMsRef.current = beatMs }, [beatMs])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(TouchSensor,   { activationConstraint: { delay: 150, tolerance: 5 } }),
  )

  const [activeDragData, setActiveDragData] = useState(null)

  const timeline       = useTimeline()
  function handleDragStart({ active }) {
    setActiveDragData(active.data.current ?? null)
  }

  function handleDragEnd({ active, over }) {
    setActiveDragData(null)
    if (!over) return

    const activeId = active.id
    const overId   = over.id

    // Grid chip → timeline
    if (typeof activeId === "string" && activeId.startsWith("grid:")) {
      const chord = active.data.current?.chord
      if (!chord) return
      if (overId === "timeline-zone") {
        timeline.addChord(chord)
      } else {
        const overIndex = timeline.progression.findIndex(e => e.id === overId)
        if (overIndex !== -1) {
          timeline.insertChordAt(chord, overIndex)
        } else {
          timeline.addChord(chord)
        }
      }
      track("chord_added", { chord_name: chord.name, method: "drag" })
      return
    }

    // Timeline reorder
    if (activeId !== overId) {
      const oldIndex = timeline.progression.findIndex(e => e.id === activeId)
      const newIndex = timeline.progression.findIndex(e => e.id === overId)
      if (oldIndex !== -1 && newIndex !== -1) {
        timeline.reorderChords(oldIndex, newIndex)
      }
    }
  }

  // Load progression from URL on startup
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const encoded = params.get("p")
    if (!encoded) return
    const prog = decodeProgression(encoded, allChords)
    if (prog?.length) timeline.loadProgression(prog)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleShare() {
    const encoded = encodeProgression(timeline.progression)
    const url = `${window.location.origin}${window.location.pathname}?p=${encoded}`
    navigator.clipboard.writeText(url).then(() => {
      setShareCopied(true)
      setTimeout(() => setShareCopied(false), 2000)
      track("progression_shared", { chord_count: timeline.progression.length })
    })
  }

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

  const { playChord, preload } = useAudio({
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

  const loopModeRef    = useRef(loopMode)
  useEffect(() => { loopModeRef.current = loopMode }, [loopMode])
  const pendingStartRef = useRef(false)
  // Autoplay after a programmatic progression load
  useEffect(() => {
    if (pendingStartRef.current && timeline.progression.length > 0) {
      pendingStartRef.current = false
      playback.start(loopModeRef.current)
    }
  }, [timeline.progression])

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
    const rootName = NOTES[root]
    const displayRoot = notation === "french" ? (NOTE_FR[rootName] ?? rootName) : rootName
    return `${displayRoot} ${scaleName}`
  }, [timeline.progression, notation])

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
    track("chord_added", { chord_name: chord.name, method: "right_click" })
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
  function handleTogglePlayback() {
    if (!timeline.progression.length) return
    playback.toggle(loopMode)
    if (!isPlaying) track("progression_played", { chord_count: timeline.progression.length, loop: loopMode })
  }
  function handleClear() { playback.stop(); timeline.clear() }
  function handleExportMidi() {
    downloadMidi(timeline.progression, sound.tempo)
    track("midi_exported", { chord_count: timeline.progression.length, tempo: sound.tempo })
  }

  function handleRandomize4() {
    // Always reset to 4 new chords and autoplay
    playback.stop()
    const starts = allChords.filter(c =>
      c.intervals.join(",") === "0,4,7" || c.intervals.join(",") === "0,3,7"
    )
    const first = starts[Math.floor(Math.random() * starts.length)]
    const localProg = [first]
    for (let i = 0; i < 3; i++) {
      const suggs = computeSuggestions(localProg, allChords)
      const name  = pickWeightedName(suggs, new Set(localProg.map(c => c.name)))
      const next  = name ? allChords.find(c => c.name === name) : null
      if (next) localProg.push(next)
    }
    pendingStartRef.current = true
    timeline.loadProgression(localProg)
    track("progression_randomized", { chord_count: localProg.length })
  }

  function handleRandomizeOne() {
    // Add 1 suggested chord and play it immediately
    const source = timeline.progression.length > 0 ? timeline.progression : (() => {
      const starts = allChords.filter(c =>
        c.intervals.join(",") === "0,4,7" || c.intervals.join(",") === "0,3,7"
      )
      return [starts[Math.floor(Math.random() * starts.length)]]
    })()
    const suggs   = computeSuggestions(source, allChords)
    const existing = new Set(timeline.progression.map(e => e.name))
    const name    = pickWeightedName(suggs, existing)
    const next    = name ? allChords.find(c => c.name === name) : null
    if (next) {
      timeline.addChord(next)
      playChord(next)
      track("chord_randomized_one", { chord_name: next.name })
    }
  }
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
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
    >
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
        .coffee-btn-mobile { display: none !important; }
        .footer-bar { justify-content: center !important; }
        @media (max-width: 600px) {
          .kbd-hints { display: none !important; }
          .coffee-btn-header { display: none !important; }
          .coffee-btn-mobile { display: inline-flex !important; }
          .footer-bar { justify-content: space-between !important; }
          .settings-dropdown { right: auto !important; left: 0 !important; }
        }
      `}</style>

      {/* ── Header ── */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 8, flexWrap: "wrap" }}>
          <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: "0.08em", color: "#fff" }}>
            CHORDS EXPLORER
          </h1>
          <span style={{ fontSize: 11, color: TEXT.faint, letterSpacing: "0.06em", fontWeight: 700 }}>v1.3</span>
          <div className="kbd-hints" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {[["Click", t("clickHint",notation)],["Right-click", t("rclickHint",notation)],["Drag", t("dragHint",notation)],["Space", t("spaceHint",notation)]].map(([k,d]) => (
              <span key={k} style={{ fontSize: 11, color: TEXT.secondary, whiteSpace: "nowrap" }}>
                <span style={{
                  display: "inline-block", background: "#1e1e1e", border: "1px solid #2e2e2e",
                  borderRadius: 4, padding: "1px 5px", marginRight: 4, color: TEXT.primary, fontSize: 10,
                }}>{k}</span>{d}
              </span>
            ))}
          </div>
          {/* Settings gear */}
          <div style={{ marginLeft: "auto", position: "relative", flexShrink: 0 }}>
            <button
              onClick={() => setShowSettings(s => !s)}
              title={t("settings", notation)}
              style={{
                width: 28, height: 28, borderRadius: 6, border: showSettings ? "1px solid #4a8abf" : "1px solid #2a2a2a",
                background: showSettings ? "#0e1a24" : "#1a1a1a", color: showSettings ? "#4a8abf" : TEXT.muted,
                fontSize: 14, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              }}
            >⚙</button>
            {showSettings && (
              <div className="settings-dropdown" style={{
                position: "absolute", top: 34, right: 0, zIndex: 100,
                background: "#141414", border: "1px solid #2a2a2a", borderRadius: 8,
                padding: "12px 16px", minWidth: 180, boxShadow: "0 4px 20px #000a",
              }}>
                <p style={{ margin: "0 0 8px", fontSize: 10, color: TEXT.muted, letterSpacing: "0.1em" }}>NOTATION</p>
                {[
                  { value: "english", label: "English", sub: "C, D, Em, Cmaj7…" },
                  { value: "french",  label: "Français", sub: "Do, Ré, Mim, Domaj7…" },
                ].map(({ value, label, sub }) => {
                  const active = notation === value
                  return (
                    <label key={value} style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", marginBottom: 6 }}>
                      <input
                        type="radio" name="notation" value={value} checked={active}
                        onChange={() => {
                          setNotation(value)
                          try { localStorage.setItem(LS_NOTATION, value) } catch {}
                        }}
                        style={{ accentColor: "#4a8abf" }}
                      />
                      <span>
                        <span style={{ fontSize: 12, color: active ? TEXT.primary : TEXT.secondary }}>{label}</span>
                        <span style={{ fontSize: 10, color: TEXT.faint, marginLeft: 6 }}>{sub}</span>
                      </span>
                    </label>
                  )
                })}
              </div>
            )}
          </div>
          <a
            className="coffee-btn-header"
            href="https://buymeacoffee.com/loupv"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex", alignItems: "center", gap: 5,
              background: "#FFDD00", color: "#000", fontFamily: "inherit",
              fontWeight: 700, fontSize: 11, letterSpacing: "0.05em",
              padding: "5px 11px", borderRadius: 6, textDecoration: "none", flexShrink: 0,
            }}
          >
            ☕ Buy me a coffee
          </a>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: 6 }}>
          {[
            { icon: "♩", title: t("browseTitle",notation),  body: t("browseBody",notation) },
            { icon: "⟶", title: t("buildTitle",notation),   body: t("buildBody",notation) },
            { icon: "▶", title: t("playTitle",notation),    body: t("playBody",notation) },
            { icon: "◉", title: t("suggestTitle",notation), body: t("suggestBody",notation) },
            { icon: "⚄", title: t("randomTitle",notation),  body: t("randomBody",notation) },
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
            onRandomize={handleRandomize4}
            onRandomizeOne={handleRandomizeOne}
            onLoadSaved={handleLoadSaved}
            canUndo={timeline.canUndo}
            onUndo={timeline.undo}
            shareCopied={shareCopied}
            onShare={handleShare}
            onRemove={timeline.removeChord}
            onChordPlay={handleTimelineChordPlay}
            notation={notation}
          />
        </div>

        {/* Chord detail */}
        <ChordDetail
          chord={selectedChord}
          octave={selectedOctave}
          inversion={inversion}
          beats={selectedBeats}
          notation={notation}
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

        <SoundControls values={sound} onChange={setSoundKey} loadingInstrument={loadingInstrument} />
      </div>

      {/* ── Chord grid ── */}
      <ChordGrid
        groupedChords={groupedChords}
        allChords={allChords}
        selectedChordName={selectedChordName}
        timelineNameSet={timelineNameSet}
        suggestions={suggestions}
        showSuggestions={showSuggestions}
        notation={notation}
        onChordClick={handleChordClick}
        onChordContextMenu={handleChordContextMenu}
      />

      {/* ── Footer ── */}
      <div className="footer-bar" style={{
        marginTop: 16, padding: "12px 16px",
        borderTop: "1px solid #252525",
        background: "#0d0d0d", borderRadius: "0 0 10px 10px",
        display: "flex", alignItems: "center", flexWrap: "wrap", gap: 10,
      }}>
        <span style={{ fontSize: 10, color: TEXT.muted, letterSpacing: "0.04em" }}>
          Loup Vuarnesson &nbsp;·&nbsp;{" "}
          <a href="mailto:loup.vuarnesson@pm.me" style={{ color: TEXT.secondary, textDecoration: "none" }}>
            loup.vuarnesson@pm.me
          </a>
        </span>
        <a
          className="coffee-btn-mobile"
          href="https://buymeacoffee.com/loupv"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: "inline-flex", alignItems: "center", gap: 5,
            background: "#1c1800", color: "#c8a800", fontFamily: "inherit",
            fontWeight: 600, fontSize: 10, letterSpacing: "0.04em",
            padding: "5px 10px", borderRadius: 5, textDecoration: "none",
            border: "1px solid #3a3000",
          }}
        >
          ☕ Buy me a coffee
        </a>
      </div>
    </div>

    {/* Drag overlay — floating chip that follows the cursor/finger */}
    <DragOverlay dropAnimation={null}>
      {activeDragData?.type === "grid" && activeDragData.chord ? (
        <div style={{
          display: "inline-flex", alignItems: "center", justifyContent: "center",
          padding: "4px 7px", minWidth: 42, minHeight: 30, borderRadius: 6,
          fontSize: 12, fontFamily: "'Courier New', monospace", fontWeight: 700,
          letterSpacing: "0.03em", userSelect: "none",
          background: NOTE_COLORS[activeDragData.chord.root] ?? "#888",
          color: "#fff",
          border: `2px solid ${NOTE_COLORS[activeDragData.chord.root] ?? "#888"}`,
          boxShadow: `0 4px 16px ${NOTE_COLORS[activeDragData.chord.root] ?? "#888"}66`,
          cursor: "grabbing",
        }}>
          {activeDragData.chord.root}{activeDragData.chord.name.slice(activeDragData.chord.root.length)}
        </div>
      ) : null}
    </DragOverlay>
    </DndContext>
  )
}
