import { useState, useRef } from "react"
import { arrayMove } from "@dnd-kit/sortable"

export function useTimeline() {
  const [progression, setProgression] = useState([])
  const [canUndo,     setCanUndo]     = useState(false)
  const historyRef = useRef([])

  // ── history helpers ──────────────────────────────────────────────────────────

  function saveHistory(current) {
    historyRef.current = [...historyRef.current.slice(-29), current]
    setCanUndo(true)
  }

  function mutate(fn) {
    setProgression(prev => {
      saveHistory(prev)
      return fn(prev)
    })
  }

  // ── public actions ───────────────────────────────────────────────────────────

  function addChord(chord) {
    mutate(prev => [...prev, { id: crypto.randomUUID(), ...chord }])
  }

  function insertChordAt(chord, index) {
    mutate(prev => {
      const n = [...prev]
      n.splice(index, 0, { id: crypto.randomUUID(), ...chord })
      return n
    })
  }

  function reorderChords(oldIndex, newIndex) {
    mutate(prev => arrayMove(prev, oldIndex, newIndex))
  }

  function updateEntry(id, updates) {
    // updateEntry is non-destructive (fine-tuning), skip history
    setProgression(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e))
  }

  function removeChord(index) {
    mutate(prev => prev.filter((_, i) => i !== index))
  }

  function clear() {
    mutate(() => [])
  }

  function loadProgression(entries) {
    mutate(() => entries.map(e => ({ ...e, id: crypto.randomUUID() })))
  }

  function undo() {
    if (!historyRef.current.length) return
    const prev = historyRef.current[historyRef.current.length - 1]
    historyRef.current = historyRef.current.slice(0, -1)
    setCanUndo(historyRef.current.length > 0)
    setProgression(prev)
  }

  return {
    progression,
    canUndo,
    addChord,
    insertChordAt,
    reorderChords,
    updateEntry,
    removeChord,
    clear,
    loadProgression,
    undo,
  }
}
