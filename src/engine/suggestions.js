import { NOTES, SCALES } from "../constants"
import { chordPitchClasses } from "../musicUtils"

function chordFitsScale(chordPCs, scaleRoot, scaleIntervals) {
  const scalePCs = new Set(scaleIntervals.map(i => (scaleRoot + i) % 12))
  let n = 0
  for (const pc of chordPCs) if (scalePCs.has(pc)) n++
  return n / chordPCs.size
}

function voiceLeadingDistance(pcsA, pcsB) {
  let total = 0
  for (const pa of pcsA) {
    let best = 12
    for (const pb of pcsB) {
      const d = Math.min(Math.abs(pa - pb), 12 - Math.abs(pa - pb))
      if (d < best) best = d
    }
    total += best
  }
  return total
}

function commonNotes(pcsA, pcsB) {
  let n = 0
  for (const pc of pcsA) if (pcsB.has(pc)) n++
  return n
}

function isTritoneSubOf(chord, ref) {
  return (
    Math.abs(NOTES.indexOf(chord.root) - NOTES.indexOf(ref.root)) === 6 &&
    (chord.suffix === "7" || chord.suffix === "9")
  )
}

function isSecondaryDominant(chord, keyRoot, scaleIntervals) {
  if (chord.suffix !== "7" && chord.suffix !== "9") return false
  const cRoot = NOTES.indexOf(chord.root)
  for (const i of scaleIntervals)
    if (((keyRoot + i - 7) + 12) % 12 === cRoot) return true
  return false
}

function scoreChord(candidate, lastChord, keyRoot, keyScale) {
  if (candidate.name === lastChord.name) return 0
  const lastPCs = chordPitchClasses(lastChord)
  const candPCs = chordPitchClasses(candidate)

  const scaleFit = chordFitsScale(candPCs, keyRoot, keyScale)
  const vlScore  = Math.max(0, 1 - voiceLeadingDistance(lastPCs, candPCs) / (lastPCs.size * 6))
  const common   = commonNotes(lastPCs, candPCs) / Math.max(lastPCs.size, candPCs.size)

  let bonus = 0
  if (isTritoneSubOf(candidate, lastChord)) bonus += 0.3
  if (candidate.root === lastChord.root && candidate.suffix !== lastChord.suffix) bonus += 0.15
  if (NOTES.indexOf(candidate.root) === (keyRoot + 1) % 12 && candidate.suffix === "") bonus += 0.2
  if (isSecondaryDominant(candidate, keyRoot, keyScale)) bonus += 0.25

  const lr = NOTES.indexOf(lastChord.root)
  const cr = NOTES.indexOf(candidate.root)
  if (
    (lastChord.suffix === "7" || lastChord.suffix === "9") &&
    ((lr + 5) % 12 === cr || (lr - 7 + 12) % 12 === cr)
  ) bonus += 0.35

  return Math.min(scaleFit * 0.35 + vlScore * 0.25 + common * 0.15 + bonus, 1)
}

export function detectKey(chords) {
  if (!chords.length) return { root: 0, scale: SCALES[0][1] }
  let best = { root: 0, scale: SCALES[0][1] }, bestScore = -1
  for (const [, si] of SCALES)
    for (let r = 0; r < 12; r++) {
      const s = chords.reduce((acc, c) => acc + chordFitsScale(chordPitchClasses(c), r, si), 0)
      if (s > bestScore) { bestScore = s; best = { root: r, scale: si } }
    }
  return best
}

export function computeSuggestions(progression, allChords, topN = 40) {
  if (!progression.length) return new Map()
  const last = progression[progression.length - 1]
  const { root, scale } = detectKey(progression)
  return new Map(
    allChords
      .map(c => [c.name, scoreChord(c, last, root, scale)])
      .filter(([, s]) => s > 0.1)
      .sort((a, b) => b[1] - a[1])
      .slice(0, topN)
  )
}
