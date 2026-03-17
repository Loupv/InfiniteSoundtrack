import { useState, useRef } from "react"

export function useTimeline() {
  const [progression,        setProgression]        = useState([])
  const [dragOverIndex,      setDragOverIndex]      = useState(null)
  const [timelineDropActive, setTimelineDropActive] = useState(false)
  const dragSourceRef = useRef(null)

  function addChord(chord) {
    const id = crypto.randomUUID()
    setProgression(prev => [...prev, { id, ...chord }])
  }

  function removeChord(index) {
    setProgression(prev => prev.filter((_, i) => i !== index))
  }

  function clear() {
    setProgression([])
  }

  function loadProgression(entries) {
    // Re-stamp IDs so each entry is unique
    setProgression(entries.map(e => ({
      ...e,
      id: crypto.randomUUID(),
    })))
  }

  // ── drag sources ─────────────────────────────────────────────────────────────

  function onGridDragStart(e, chord) {
    dragSourceRef.current = { type: "grid", chord }
    e.dataTransfer.effectAllowed = "copy"
  }

  function onTimelineDragStart(e, index) {
    dragSourceRef.current = { type: "timeline", index }
    e.dataTransfer.effectAllowed = "move"
  }

  // ── drag over ────────────────────────────────────────────────────────────────

  function onSlotDragOver(e, slotIndex) {
    e.preventDefault()
    e.stopPropagation()
    setTimelineDropActive(true)
    setDragOverIndex(slotIndex)
  }

  function onZoneDragOver(e) {
    e.preventDefault()
    setTimelineDropActive(true)
    if (dragOverIndex === null) setDragOverIndex(progression.length)
  }

  function onZoneDragLeave(e) {
    if (!e.currentTarget.contains(e.relatedTarget)) {
      setTimelineDropActive(false)
      setDragOverIndex(null)
    }
  }

  // ── drop ─────────────────────────────────────────────────────────────────────

  function _commitDrop(targetSlot) {
    const src = dragSourceRef.current
    if (!src || targetSlot === null) return

    if (src.type === "grid") {
      const id = crypto.randomUUID()
      setProgression(prev => {
        const n = [...prev]
        n.splice(targetSlot, 0, { id, ...src.chord })
        return n
      })
    } else if (src.type === "timeline") {
      const from = src.index
      setProgression(prev => {
        if (from === targetSlot || from === targetSlot - 1) return prev
        const n    = [...prev]
        const [item] = n.splice(from, 1)
        n.splice(targetSlot > from ? targetSlot - 1 : targetSlot, 0, item)
        return n
      })
    }

    dragSourceRef.current = null
    setDragOverIndex(null)
    setTimelineDropActive(false)
  }

  function onZoneDrop(e) {
    e.preventDefault()
    _commitDrop(dragOverIndex ?? progression.length)
  }

  return {
    progression,
    dragOverIndex,
    timelineDropActive,
    addChord,
    removeChord,
    clear,
    loadProgression,
    onGridDragStart,
    onTimelineDragStart,
    onSlotDragOver,
    onZoneDragOver,
    onZoneDragLeave,
    onZoneDrop,
  }
}
