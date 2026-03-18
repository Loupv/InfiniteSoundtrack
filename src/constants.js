export const NOTES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"]

export const CHORD_TYPES = [
  { suffix: "",     intervals: [0, 4, 7] },
  { suffix: "m",    intervals: [0, 3, 7] },
  { suffix: "dim",  intervals: [0, 3, 6] },
  { suffix: "aug",  intervals: [0, 4, 8] },
  { suffix: "sus2", intervals: [0, 2, 7] },
  { suffix: "sus4", intervals: [0, 5, 7] },
  { suffix: "6",    intervals: [0, 4, 7, 9] },
  { suffix: "m6",   intervals: [0, 3, 7, 9] },
  { suffix: "7",    intervals: [0, 4, 7, 10] },
  { suffix: "maj7", intervals: [0, 4, 7, 11] },
  { suffix: "m7",   intervals: [0, 3, 7, 10] },
  { suffix: "9",    intervals: [0, 4, 7, 10, 14] },
  { suffix: "11",   intervals: [0, 4, 7, 10, 14, 17] },
  { suffix: "12",   intervals: [0, 4, 7, 12] },
]

export const WHITE_KEYS     = ["C", "D", "E", "F", "G", "A", "B"]
export const BLACK_KEYS     = ["C#", "Eb", "F#", "Ab", "Bb"]
export const BLACK_POSITIONS = { "C#": 0.7, "Eb": 1.7, "F#": 3.7, "Ab": 4.7, "Bb": 5.7 }

export const NOTE_COLORS = {
  "C":"#e85d5d","C#":"#e8875d","D":"#e8b45d","Eb":"#d4c84a","E":"#8fcc52","F":"#4abf8a",
  "F#":"#4ab8bf","G":"#4a8abf","Ab":"#5d6ee8","A":"#8a5de8","Bb":"#c05de8","B":"#e85dbb",
}

export const TEXT = {
  primary:   "#f0f0f0",  // near-white, all main labels
  secondary: "#b8b8b8",  // values, secondary info
  muted:     "#787878",  // section headers, hints
  faint:     "#484848",  // placeholders, separators
}

export const NOTE_TO_PC = { C:0,"C#":1,D:2,Eb:3,E:4,F:5,"F#":6,G:7,Ab:8,A:9,Bb:10,B:11 }

// French (solfège) note names
export const NOTE_FR = {
  "C":"Do","C#":"Do#","D":"Ré","Eb":"Mib","E":"Mi",
  "F":"Fa","F#":"Fa#","G":"Sol","Ab":"Lab","A":"La","Bb":"Sib","B":"Si",
}
// Chromatic scale in French for note cards (index = pitch class 0–11)
export const PC_NAMES_FR = ["Do","Do#","Ré","Mib","Mi","Fa","Fa#","Sol","Lab","La","Sib","Si"]

export const SUGGESTION_STYLE = {
  BG_ALPHA_MIN:  20,   // visible even for low scores
  BG_ALPHA_RANGE: 200, // range: 20–220
  BDR_ALPHA_MIN:  80,  // clearly visible border at all scores
  BDR_ALPHA_RANGE: 175,// range: 80–255
  BDR_WIDTH_MIN:  2,   // minimum border width in px
  BDR_WIDTH_RANGE: 2,  // range: 2–4px
  GLOW_PX_MIN:  4,     // slight glow even for low scores
  GLOW_PX_RANGE: 28,   // range: 4–32px
}

// Duration values in beats (1 beat = 1 noire / quarter note at current tempo)
export const DURATIONS = [
  { beats: 0.25, label: "\u266C\uFE0E", name: "double croche" },
  { beats: 0.5,  label: "\u266A\uFE0E", name: "croche" },
  { beats: 1,    label: "\u2669\uFE0E", name: "noire" },
  { beats: 2,    label: "\u25D1",       name: "blanche" },
  { beats: 4,    label: "\u25CB",       name: "ronde" },
]

export const SCALES = [
  ["major",      [0,2,4,5,7,9,11]],
  ["minor",      [0,2,3,5,7,8,10]],
  ["harmMinor",  [0,2,3,5,7,8,11]],
  ["melodicMin", [0,2,3,5,7,9,11]],
  ["dorian",     [0,2,3,5,7,9,10]],
  ["phrygian",   [0,1,3,5,7,8,10]],
  ["lydian",     [0,2,4,6,7,9,11]],
  ["mixolydian", [0,2,4,5,7,9,10]],
  ["locrian",    [0,1,3,5,6,8,10]],
  ["wholetone",  [0,2,4,6,8,10]],
  ["diminished", [0,2,3,5,6,8,9,11]],
]
