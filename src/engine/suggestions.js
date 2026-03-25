import { NOTES, SCALES } from "../constants"
import { chordPitchClasses } from "../musicUtils"

// ── Core helpers ─────────────────────────────────────────────────────────────

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

// Bass motion quality — smooth bass lines are critical for a soundtrack feel
function bassMotionScore(rootA, rootB) {
  const d = Math.min(Math.abs(rootA - rootB), 12 - Math.abs(rootA - rootB))
  if (d === 5 || d === 7) return 1.0   // P4/P5: strongest bass motion
  if (d <= 2) return 0.85              // step: very smooth
  if (d === 3 || d === 4) return 0.65  // 3rd: acceptable
  if (d === 6) return 0.45             // tritone: dramatic
  return 0.2                           // large leap
}

function commonNotes(pcsA, pcsB) {
  let n = 0
  for (const pc of pcsA) if (pcsB.has(pc)) n++
  return n
}

// ── Functional harmony ───────────────────────────────────────────────────────

function harmonicFunction(chordRoot, suffix, keyRoot) {
  const degree = ((chordRoot - keyRoot) + 12) % 12
  if (degree === 0 || degree === 4 || degree === 9) return "T" // I, iii, vi
  if (degree === 7 || degree === 11) return "D"                // V, vii
  if (degree === 5 || degree === 2) return "S"                 // IV, ii
  if (suffix === "7" || suffix === "9") return "D"             // dominant types
  return "O"
}

// Tension/resolution arc — rewards natural harmonic motion
function tensionResolutionBonus(candidate, progression, keyRoot) {
  if (progression.length < 2) return 0
  const candRoot = NOTES.indexOf(candidate.root)
  const candFunc = harmonicFunction(candRoot, candidate.suffix, keyRoot)
  const recentFuncs = progression.slice(-3).map(c =>
    harmonicFunction(NOTES.indexOf(c.root), c.suffix ?? "", keyRoot)
  )
  let bonus = 0

  // D → T resolution
  if (recentFuncs.at(-1) === "D" && candFunc === "T") bonus += 0.2
  // S → D motion (building tension)
  if (recentFuncs.at(-1) === "S" && candFunc === "D") bonus += 0.15
  // ii-V-I chain
  if (recentFuncs.length >= 2 && recentFuncs.at(-2) === "S" &&
      recentFuncs.at(-1) === "D" && candFunc === "T") bonus += 0.25
  // Penalise tonic stagnation
  if (candFunc === "T" && recentFuncs.filter(f => f === "T").length >= 2) bonus -= 0.15
  // Penalise unresolved dominant chains
  if (candFunc === "D" && recentFuncs.filter(f => f === "D").length >= 2) bonus -= 0.2

  return bonus
}

// Cadence patterns — reward classical resolutions
function cadenceBonus(candidate, lastChord, keyRoot) {
  const candRoot = NOTES.indexOf(candidate.root)
  const lastRoot = NOTES.indexOf(lastChord.root)
  const lastDeg  = (lastRoot - keyRoot + 12) % 12
  const candDeg  = (candRoot - keyRoot + 12) % 12
  let bonus = 0

  // Perfect: V(7) → I
  if (lastDeg === 7 && candDeg === 0 &&
      (lastChord.suffix === "7" || lastChord.suffix === "" || lastChord.suffix === "9") &&
      (candidate.suffix === "" || candidate.suffix === "maj7")) bonus += 0.3
  // Plagal: IV → I
  if (lastDeg === 5 && candDeg === 0) bonus += 0.15
  // Deceptive: V → vi
  if (lastDeg === 7 && candDeg === 9 &&
      (candidate.suffix === "m" || candidate.suffix === "m7")) bonus += 0.2
  // Half: → V
  if (candDeg === 7 && (candidate.suffix === "" || candidate.suffix === "7")) bonus += 0.1

  return bonus
}

// Modal interchange — borrowed chords from parallel modes
function modalInterchangeBonus(candidate, keyRoot, keyScale) {
  const candPCs = chordPitchClasses(candidate)
  if (chordFitsScale(candPCs, keyRoot, keyScale) >= 0.8) return 0
  let bestAltFit = 0
  for (const [, altScale] of SCALES) {
    if (altScale === keyScale) continue
    const fit = chordFitsScale(candPCs, keyRoot, altScale)
    if (fit > bestAltFit) bestAltFit = fit
  }
  if (bestAltFit >= 0.9) return 0.12
  if (bestAltFit >= 0.75) return 0.06
  return 0
}

// Repetition penalty — prevent monotonous loops
function repetitionPenalty(candidate, progression) {
  if (progression.length < 2) return 0
  let penalty = 0
  const recent = progression.slice(-5)

  // Same chord in recent history
  const sameCount = recent.filter(c => c.name === candidate.name).length
  if (sameCount >= 1) penalty += 0.15 * sameCount

  // Same root too often
  const sameRootCount = recent.filter(c => c.root === candidate.root).length
  if (sameRootCount >= 2) penalty += 0.1 * sameRootCount

  // Ping-pong pattern (A-B-A-B)
  if (progression.length >= 3) {
    const last3 = progression.slice(-3)
    if (last3[0].name === last3[2].name && last3[1].name === candidate.name) {
      penalty += 0.2
    }
  }

  return penalty
}

// Tritone sub — only when functionally valid
function isTritoneSubOf(chord, ref, keyRoot) {
  const cRoot = NOTES.indexOf(chord.root)
  const rRoot = NOTES.indexOf(ref.root)
  const dist = Math.min(Math.abs(cRoot - rRoot), 12 - Math.abs(cRoot - rRoot))
  if (dist !== 6) return false
  if (chord.suffix !== "7" && chord.suffix !== "9") return false
  const targetRoot = (cRoot + 11) % 12
  return targetRoot === keyRoot || (rRoot + 5) % 12 === keyRoot
}

function isSecondaryDominant(chord, keyRoot, scaleIntervals) {
  if (chord.suffix !== "7" && chord.suffix !== "9") return false
  const cRoot = NOTES.indexOf(chord.root)
  for (const i of scaleIntervals) {
    const target = (keyRoot + i) % 12
    if ((target + 5) % 12 === cRoot || (target - 7 + 12) % 12 === cRoot) return true
  }
  return false
}

// ── Main scoring (now takes full progression for context) ────────────────────

function scoreChord(candidate, lastChord, progression, keyRoot, keyScale) {
  if (candidate.name === lastChord.name) return 0

  const lastPCs  = chordPitchClasses(lastChord)
  const candPCs  = chordPitchClasses(candidate)
  const lastRoot = NOTES.indexOf(lastChord.root)
  const candRoot = NOTES.indexOf(candidate.root)

  // Core metrics
  const scaleFit  = chordFitsScale(candPCs, keyRoot, keyScale)
  const vlScore   = Math.max(0, 1 - voiceLeadingDistance(lastPCs, candPCs) / (lastPCs.size * 6))
  const bassScore = bassMotionScore(lastRoot, candRoot)
  const common    = commonNotes(lastPCs, candPCs) / Math.max(lastPCs.size, candPCs.size)

  // Harmonic bonuses
  let bonus = 0
  if (isTritoneSubOf(candidate, lastChord, keyRoot)) bonus += 0.2
  if (candidate.root === lastChord.root && candidate.suffix !== lastChord.suffix) bonus += 0.08
  if (isSecondaryDominant(candidate, keyRoot, keyScale)) bonus += 0.18

  // Circle of fifths dominant resolution
  if ((lastChord.suffix === "7" || lastChord.suffix === "9") &&
      ((lastRoot + 5) % 12 === candRoot || (lastRoot - 7 + 12) % 12 === candRoot)) {
    bonus += 0.3
  }

  // Context-aware bonuses (use full progression)
  bonus += cadenceBonus(candidate, lastChord, keyRoot)
  bonus += tensionResolutionBonus(candidate, progression, keyRoot)
  bonus += modalInterchangeBonus(candidate, keyRoot, keyScale)

  // Penalties
  const penalty = repetitionPenalty(candidate, progression)

  // Weighted sum
  const raw = scaleFit  * 0.26 +
              vlScore   * 0.16 +
              bassScore * 0.14 +
              common    * 0.10 +
              bonus -
              penalty

  return Math.max(0, Math.min(raw, 1))
}

// ── Key detection with recency weighting ─────────────────────────────────────

export function detectKey(chords) {
  if (!chords.length) return { root: 0, scale: SCALES[0][1] }
  let best = { root: 0, scale: SCALES[0][1] }, bestScore = -1

  // Recent chords matter more for a continuous soundtrack
  const weights = chords.map((_, i) => 0.3 + 0.7 * ((i + 1) / chords.length))

  for (const [, si] of SCALES) {
    for (let r = 0; r < 12; r++) {
      let s = 0
      for (let i = 0; i < chords.length; i++) {
        s += chordFitsScale(chordPitchClasses(chords[i]), r, si) * weights[i]
      }
      if (s > bestScore) { bestScore = s; best = { root: r, scale: si } }
    }
  }
  return best
}

// ── Public API ───────────────────────────────────────────────────────────────

export function computeSuggestions(progression, allChords, topN = 40) {
  if (!progression.length) return new Map()
  const last = progression[progression.length - 1]
  const { root, scale } = detectKey(progression)
  return new Map(
    allChords
      .map(c => [c.name, scoreChord(c, last, progression, root, scale)])
      .filter(([, s]) => s > 0.05)
      .sort((a, b) => b[1] - a[1])
      .slice(0, topN)
  )
}

// ── Mood-biased scoring (used by SoundtrackEngine) ───────────────────────────

function moodBias(candidate, mood = {}) {
  const { valence = 0, tension = 0 } = mood
  const s = candidate.suffix
  let bias = 0

  if (valence > 0) {
    if (s === "" || s === "maj7" || s === "6" || s === "sus2" || s === "sus4") bias += valence * 0.3
    if (s === "m" || s === "dim" || s === "m7") bias -= valence * 0.2
  } else if (valence < 0) {
    if (s === "m" || s === "m7" || s === "dim") bias += Math.abs(valence) * 0.3
    if (s === "" || s === "maj7" || s === "6")  bias -= Math.abs(valence) * 0.2
  }

  if (tension > 0) {
    if (["7","9","11","aug","dim","m7","maj7"].includes(s)) bias += tension * 0.25
    if (["","m","sus2","sus4"].includes(s))                 bias -= tension * 0.1
  } else if (tension < 0) {
    if (["","m","sus2","sus4"].includes(s))                 bias += Math.abs(tension) * 0.2
    if (["7","9","11","aug","dim"].includes(s))             bias -= Math.abs(tension) * 0.15
  }

  return bias
}

export function computeSuggestionsWithMood(progression, allChords, mood = {}, topN = 40) {
  if (!progression.length) return new Map()
  const last = progression[progression.length - 1]
  const { root, scale } = detectKey(progression)
  return new Map(
    allChords
      .map(c => [c.name, Math.min(1, Math.max(0,
        scoreChord(c, last, progression, root, scale) + moodBias(c, mood)
      ))])
      .filter(([, s]) => s > 0.05)
      .sort((a, b) => b[1] - a[1])
      .slice(0, topN)
  )
}
