import { buildChordMidi } from "../musicUtils"

// Variable-length encoding for MIDI delta times
function varLen(n) {
  if (n < 0x80) return [n]
  const bytes = []
  let v = n
  bytes.unshift(v & 0x7F)
  v >>= 7
  while (v > 0) {
    bytes.unshift((v & 0x7F) | 0x80)
    v >>= 7
  }
  return bytes
}

function uint32BE(n) {
  return [(n >> 24) & 0xFF, (n >> 16) & 0xFF, (n >> 8) & 0xFF, n & 0xFF]
}

function uint16BE(n) {
  return [(n >> 8) & 0xFF, n & 0xFF]
}

// Build the MIDI notes for a timeline entry (applies inversion + octave)
function entryMidiNotes(entry) {
  const inv = entry.inversion ?? 0
  const oct = entry.octave ?? 4
  const intervals = entry.intervals
  const count = intervals.length
  const rot = ((inv % count) + count) % count
  const invIntervals = rot === 0 ? intervals
    : [...intervals.slice(rot), ...intervals.slice(0, rot).map(i => i + 12)]
  const octShift = (oct - 4) * 12
  return buildChordMidi(entry.root, invIntervals).map(m => m + octShift)
}

export function exportMidi(progression, tempo) {
  const TICKS = 480  // ticks per quarter note (noire)
  const microsecondsPerBeat = Math.round(60_000_000 / tempo)

  // Collect all events with absolute tick positions
  const events = []

  // Tempo event at tick 0
  events.push({
    tick: 0,
    data: [
      0xFF, 0x51, 0x03,
      (microsecondsPerBeat >> 16) & 0xFF,
      (microsecondsPerBeat >> 8) & 0xFF,
      microsecondsPerBeat & 0xFF,
    ],
  })

  let tick = 0
  for (const entry of progression) {
    const beats = entry.beats ?? 1
    const durTicks = Math.round(beats * TICKS)
    const notes = entryMidiNotes(entry)

    for (const note of notes) events.push({ tick,            data: [0x90, note, 80] })
    for (const note of notes) events.push({ tick: tick + durTicks, data: [0x80, note, 0] })

    tick += durTicks
  }

  // End of track
  events.push({ tick, data: [0xFF, 0x2F, 0x00] })

  // Sort by tick (stable: note-offs before note-ons at same tick)
  events.sort((a, b) => a.tick !== b.tick ? a.tick - b.tick
    : (a.data[0] === 0x80 ? -1 : b.data[0] === 0x80 ? 1 : 0))

  // Convert to delta-time bytes
  const trackBytes = []
  let lastTick = 0
  for (const ev of events) {
    trackBytes.push(...varLen(ev.tick - lastTick), ...ev.data)
    lastTick = ev.tick
  }

  const header = [
    0x4D, 0x54, 0x68, 0x64,  // MThd
    ...uint32BE(6),
    ...uint16BE(0),           // format 0
    ...uint16BE(1),           // 1 track
    ...uint16BE(TICKS),
  ]

  const track = [
    0x4D, 0x54, 0x72, 0x6B,  // MTrk
    ...uint32BE(trackBytes.length),
    ...trackBytes,
  ]

  return new Uint8Array([...header, ...track])
}

export function downloadMidi(progression, tempo, filename = "progression.mid") {
  const bytes = exportMidi(progression, tempo)
  const blob = new Blob([bytes], { type: "audio/midi" })
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
