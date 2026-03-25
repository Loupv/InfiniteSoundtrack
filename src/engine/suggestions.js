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

function bassMotionScore(rootA, rootB) {
  const d = Math.min(Math.abs(rootA - rootB), 12 - Math.abs(rootA - rootB))
  if (d === 5 || d === 7) return 1.0   // P4/P5
  if (d <= 2) return 0.85              // step
  if (d === 3 || d === 4) return 0.65  // 3rd
  if (d === 6) return 0.35             // tritone
  return 0.15
}

function commonNotes(pcsA, pcsB) {
  let n = 0
  for (const pc of pcsA) if (pcsB.has(pc)) n++
  return n
}

// ── Diatonic degree helpers ──────────────────────────────────────────────────

function chordDegree(chordRoot, keyRoot) {
  return ((chordRoot - keyRoot) + 12) % 12
}

// Map semitone degree → Roman numeral index (0-based)
// 0=I, 2=II, 3=bIII, 4=III, 5=IV, 7=V, 8=bVI, 9=VI, 10=bVII, 11=VII
function isDiatonic(chordRoot, suffix, keyRoot, scaleIntervals) {
  const scalePCs = new Set(scaleIntervals.map(i => (keyRoot + i) % 12))
  const pcs = chordPitchClasses({ root: NOTES[chordRoot], intervals: suffixToIntervals(suffix) })
  let fit = 0
  for (const pc of pcs) if (scalePCs.has(pc)) fit++
  return fit === pcs.size
}

function suffixToIntervals(suffix) {
  const map = {
    "": [0,4,7], "m": [0,3,7], "dim": [0,3,6], "aug": [0,4,8],
    "sus2": [0,2,7], "sus4": [0,5,7], "6": [0,4,7,9], "m6": [0,3,7,9],
    "7": [0,4,7,10], "maj7": [0,4,7,11], "m7": [0,3,7,10],
    "9": [0,4,7,10,14], "11": [0,4,7,10,14,17], "12": [0,4,7,12],
  }
  return map[suffix] ?? [0,4,7]
}

// ── Functional harmony ───────────────────────────────────────────────────────

function harmonicFunction(chordRoot, suffix, keyRoot) {
  const degree = chordDegree(chordRoot, keyRoot)
  if (degree === 0 || degree === 4 || degree === 9) return "T"
  if (degree === 7 || degree === 11) return "D"
  if (degree === 5 || degree === 2) return "S"
  if (suffix === "7" || suffix === "9") return "D"
  return "O"
}

// ── Progression templates ────────────────────────────────────────────────────
// Common chord progressions as degree sequences (semitones from key root).
// These are "magnetic" — if the recent progression matches the start of a
// template, candidates that continue it get a strong bonus.

const PROG_TEMPLATES = [
  // Pop / Rock
  [0, 7, 9, 5],           // I-V-vi-IV
  [0, 5, 7, 0],           // I-IV-V-I
  [0, 5, 2, 7],           // I-IV-ii-V
  [0, 9, 5, 7],           // I-vi-IV-V
  // Jazz / Classic
  [2, 7, 0],              // ii-V-I
  [9, 2, 7, 0],           // vi-ii-V-I
  [0, 4, 9, 2, 7, 0],    // I-iii-vi-ii-V-I (circle)
  [0, 7, 9, 4],           // I-V-vi-iii
  // Minor key
  [0, 5, 3, 7],           // i-iv-III-V (minor)
  [0, 3, 5, 7],           // i-III-iv-V
  [0, 7, 8, 5],           // i-v-VI-iv
  [0, 8, 5, 7],           // i-VI-iv-V
  // Descending bass
  [0, 11, 9, 7, 5],       // I-vii-vi-V-IV (descending)
  [0, 10, 9, 7],          // I-bVII-vi-V
  // Plagal
  [0, 5, 0, 5],           // I-IV-I-IV (shuttle)
  [0, 2, 5, 0],           // I-ii-IV-I
]

function progressionTemplateBonus(candidate, progression, keyRoot) {
  if (progression.length < 1) return 0
  const candDeg = chordDegree(NOTES.indexOf(candidate.root), keyRoot)
  const recentDegs = progression.slice(-5).map(c => chordDegree(NOTES.indexOf(c.root), keyRoot))

  let bestBonus = 0

  for (const template of PROG_TEMPLATES) {
    // Try to match the end of recentDegs + candDeg against a window in the template
    for (let matchLen = 1; matchLen <= Math.min(recentDegs.length, template.length - 1); matchLen++) {
      const progSlice = recentDegs.slice(-matchLen)
      // Find this slice in the template
      for (let start = 0; start <= template.length - matchLen - 1; start++) {
        let match = true
        for (let i = 0; i < matchLen; i++) {
          if (template[start + i] !== progSlice[i]) { match = false; break }
        }
        if (match && template[start + matchLen] === candDeg) {
          // Longer matches get stronger bonuses
          const bonus = 0.15 + matchLen * 0.12
          if (bonus > bestBonus) bestBonus = bonus
        }
      }
    }
  }

  return bestBonus
}

// ── Tension/resolution arc ───────────────────────────────────────────────────

function tensionResolutionBonus(candidate, progression, keyRoot) {
  if (progression.length < 2) return 0
  const candRoot = NOTES.indexOf(candidate.root)
  const candFunc = harmonicFunction(candRoot, candidate.suffix, keyRoot)
  const recentFuncs = progression.slice(-3).map(c =>
    harmonicFunction(NOTES.indexOf(c.root), c.suffix ?? "", keyRoot)
  )
  let bonus = 0

  if (recentFuncs.at(-1) === "D" && candFunc === "T") bonus += 0.25
  if (recentFuncs.at(-1) === "S" && candFunc === "D") bonus += 0.18
  if (recentFuncs.length >= 2 && recentFuncs.at(-2) === "S" &&
      recentFuncs.at(-1) === "D" && candFunc === "T") bonus += 0.3
  if (candFunc === "T" && recentFuncs.filter(f => f === "T").length >= 2) bonus -= 0.2
  if (candFunc === "D" && recentFuncs.filter(f => f === "D").length >= 2) bonus -= 0.25

  return bonus
}

// ── Cadence patterns ─────────────────────────────────────────────────────────

function cadenceBonus(candidate, lastChord, keyRoot) {
  const candRoot = NOTES.indexOf(candidate.root)
  const lastRoot = NOTES.indexOf(lastChord.root)
  const lastDeg  = chordDegree(lastRoot, keyRoot)
  const candDeg  = chordDegree(candRoot, keyRoot)
  let bonus = 0

  // V(7) → I
  if (lastDeg === 7 && candDeg === 0 &&
      (lastChord.suffix === "7" || lastChord.suffix === "" || lastChord.suffix === "9") &&
      (candidate.suffix === "" || candidate.suffix === "maj7")) bonus += 0.35
  // IV → I
  if (lastDeg === 5 && candDeg === 0) bonus += 0.2
  // V → vi (deceptive)
  if (lastDeg === 7 && candDeg === 9 &&
      (candidate.suffix === "m" || candidate.suffix === "m7")) bonus += 0.2
  // → V (half cadence)
  if (candDeg === 7 && (candidate.suffix === "" || candidate.suffix === "7")) bonus += 0.12

  return bonus
}

// ── Modal interchange ────────────────────────────────────────────────────────

function modalInterchangeBonus(candidate, keyRoot, keyScale) {
  const candPCs = chordPitchClasses(candidate)
  if (chordFitsScale(candPCs, keyRoot, keyScale) >= 0.8) return 0
  let bestAltFit = 0
  for (const [, altScale] of SCALES) {
    if (altScale === keyScale) continue
    const fit = chordFitsScale(candPCs, keyRoot, altScale)
    if (fit > bestAltFit) bestAltFit = fit
  }
  if (bestAltFit >= 0.9) return 0.08
  if (bestAltFit >= 0.75) return 0.04
  return 0
}

// ── Repetition penalty ───────────────────────────────────────────────────────

function repetitionPenalty(candidate, progression) {
  if (progression.length < 2) return 0
  let penalty = 0
  const recent = progression.slice(-6)

  const sameCount = recent.filter(c => c.name === candidate.name).length
  if (sameCount >= 1) penalty += 0.2 * sameCount

  const sameRootCount = recent.filter(c => c.root === candidate.root).length
  if (sameRootCount >= 2) penalty += 0.15 * sameRootCount

  // Ping-pong
  if (progression.length >= 3) {
    const last3 = progression.slice(-3)
    if (last3[0].name === last3[2].name && last3[1].name === candidate.name) {
      penalty += 0.3
    }
  }

  return penalty
}

// ── Chromatic approach / secondary dominants ─────────────────────────────────

function isSecondaryDominant(chord, keyRoot, scaleIntervals) {
  if (chord.suffix !== "7" && chord.suffix !== "9") return false
  const cRoot = NOTES.indexOf(chord.root)
  for (const i of scaleIntervals) {
    const target = (keyRoot + i) % 12
    if ((target + 5) % 12 === cRoot || (target - 7 + 12) % 12 === cRoot) return true
  }
  return false
}

// ── Main scoring ─────────────────────────────────────────────────────────────

function scoreChord(candidate, lastChord, progression, keyRoot, keyScale) {
  if (candidate.name === lastChord.name) return 0

  const lastPCs  = chordPitchClasses(lastChord)
  const candPCs  = chordPitchClasses(candidate)
  const lastRoot = NOTES.indexOf(lastChord.root)
  const candRoot = NOTES.indexOf(candidate.root)

  // ── Scale fit is now DOMINANT — diatonic chords heavily preferred ──────
  const scaleFit = chordFitsScale(candPCs, keyRoot, keyScale)

  // Hard gate: chords with <50% scale fit are mostly rejected
  if (scaleFit < 0.5) return 0

  const vlScore   = Math.max(0, 1 - voiceLeadingDistance(lastPCs, candPCs) / (lastPCs.size * 6))
  const bassScore = bassMotionScore(lastRoot, candRoot)
  const common    = commonNotes(lastPCs, candPCs) / Math.max(lastPCs.size, candPCs.size)

  // ── Bonuses ────────────────────────────────────────────────────────────
  let bonus = 0

  // Progression template matching (strongest structural force)
  bonus += progressionTemplateBonus(candidate, progression, keyRoot)

  // Functional harmony
  bonus += cadenceBonus(candidate, lastChord, keyRoot)
  bonus += tensionResolutionBonus(candidate, progression, keyRoot)

  // Secondary dominants (controlled chromaticism)
  if (isSecondaryDominant(candidate, keyRoot, keyScale)) bonus += 0.12

  // Same root, different quality (color change)
  if (candidate.root === lastChord.root && candidate.suffix !== lastChord.suffix) bonus += 0.06

  // Modal interchange (subtle, not chaotic)
  bonus += modalInterchangeBonus(candidate, keyRoot, keyScale)

  // Circle of fifths dominant resolution
  if ((lastChord.suffix === "7" || lastChord.suffix === "9") &&
      ((lastRoot + 5) % 12 === candRoot || (lastRoot - 7 + 12) % 12 === candRoot)) {
    bonus += 0.3
  }

  // ── Penalties ──────────────────────────────────────────────────────────
  const penalty = repetitionPenalty(candidate, progression)

  // ── Weighted sum — scale fit is king ───────────────────────────────────
  const raw = scaleFit  * 0.40 +
              vlScore   * 0.12 +
              bassScore * 0.14 +
              common    * 0.08 +
              bonus -
              penalty

  return Math.max(0, Math.min(raw, 1))
}

// ── Key detection with recency weighting ─────────────────────────────────────

export function detectKey(chords) {
  if (!chords.length) return { root: 0, scale: SCALES[0][1] }
  let best = { root: 0, scale: SCALES[0][1] }, bestScore = -1

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

// ── Mood-biased scoring ──────────────────────────────────────────────────────

function moodBias(candidate, mood = {}) {
  const { valence = 0, tension = 0 } = mood
  const s = candidate.suffix
  let bias = 0

  if (valence > 0) {
    if (s === "" || s === "maj7" || s === "6" || s === "sus2" || s === "sus4") bias += valence * 0.2
    if (s === "m" || s === "dim" || s === "m7") bias -= valence * 0.15
  } else if (valence < 0) {
    if (s === "m" || s === "m7" || s === "dim") bias += Math.abs(valence) * 0.2
    if (s === "" || s === "maj7" || s === "6")  bias -= Math.abs(valence) * 0.15
  }

  if (tension > 0) {
    if (["7","9","11","aug","dim","m7","maj7"].includes(s)) bias += tension * 0.15
    if (["","m","sus2","sus4"].includes(s))                 bias -= tension * 0.08
  } else if (tension < 0) {
    if (["","m","sus2","sus4"].includes(s))                 bias += Math.abs(tension) * 0.15
    if (["7","9","11","aug","dim"].includes(s))             bias -= Math.abs(tension) * 0.1
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
