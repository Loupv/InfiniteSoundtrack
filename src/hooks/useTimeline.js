import { useState } from "react"
import { arrayMove } from "@dnd-kit/sortable"

export function useTimeline() {
  const [progression, setProgression] = useState([])

  function addChord(chord) {
    const id = crypto.randomUUID()
    setProgression(prev => [...prev, { id, ...chord }])
  }

  function insertChordAt(chord, index) {
    const id = crypto.randomUUID()
    setProgression(prev => {
      const n = [...prev]
      n.splice(index, 0, { id, ...chord })
      return n
    })
  }

  function reorderChords(oldIndex, newIndex) {
    setProgression(prev => arrayMove(prev, oldIndex, newIndex))
  }

  function updateEntry(id, updates) {
    setProgression(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e))
  }

  function removeChord(index) {
    setProgression(prev => prev.filter((_, i) => i !== index))
  }

  function clear() {
    setProgression([])
  }

  function loadProgression(entries) {
    setProgression(entries.map(e => ({ ...e, id: crypto.randomUUID() })))
  }

  return {
    progression,
    addChord,
    insertChordAt,
    reorderChords,
    updateEntry,
    removeChord,
    clear,
    loadProgression,
  }
}
