const TRANSLATIONS = {
  english: {
    // ChordDetail
    selectChord:   "Select a chord",
    octave:        "Octave",
    inversion:     "Inversion",
    prevInversion: "Previous inversion",
    nextInversion: "Next inversion",
    resetInv:      "reset",
    duration:      "Duration",
    invRoot:       "Root",
    inv1st:        "1st inv.",
    inv2nd:        "2nd inv.",
    inv3rd:        "3rd inv.",
    // Duration names (tooltips)
    dur016:        "sixteenth note",
    dur05:         "eighth note",
    dur1:          "quarter note",
    dur2:          "half note",
    dur4:          "whole note",
    // Timeline
    timeline:      "TIMELINE",
    key:           "key:",
    generate4:     "Generate 4 chords (reset)",
    addOne:        "Add a chord",
    loopTooltip:   "Loop — replay continuously",
    exportMidi:    "Export as MIDI file",
    loadPrefix:    "Load: ",
    dragHere:      "Drag chords here…",
    suggHint:      "Chords with a coloured border are suggested next chords — brighter = stronger fit (voice-leading, scale, tritone subs).",
    // App
    settings:      "Settings",
    clickHint:     "play",
    rclickHint:    "add",
    dragHint:      "timeline",
    spaceHint:     "play/stop",
    // Feature cards
    browseTitle:   "BROWSE",
    browseBody:    "168 chords · 12 roots · 14 types. Click to hear.",
    buildTitle:    "BUILD",
    buildBody:     "Drag into timeline. Reorder freely. Key detected live.",
    playTitle:     "PLAY",
    playBody:      "Space or Play. Tempo & all params apply live.",
    suggestTitle:  "SUGGEST",
    suggestBody:   "Coloured border = suggested next chord. Brighter = stronger fit.",
    randomTitle:   "RANDOMIZE",
    randomBody:    "⚄ generates 4 chords, ⚄+ adds one. Music-theory aware: key, voice-leading & common progressions.",
  },
  french: {
    // ChordDetail
    selectChord:   "Sélectionner un accord",
    octave:        "Octave",
    inversion:     "Renversement",
    prevInversion: "Renversement précédent",
    nextInversion: "Renversement suivant",
    resetInv:      "réinit.",
    duration:      "Durée",
    invRoot:       "Fond.",
    inv1st:        "1er ren.",
    inv2nd:        "2e ren.",
    inv3rd:        "3e ren.",
    // Duration names (tooltips)
    dur016:        "double croche",
    dur05:         "croche",
    dur1:          "noire",
    dur2:          "blanche",
    dur4:          "ronde",
    // Timeline
    timeline:      "SÉQUENCE",
    key:           "ton :",
    generate4:     "Générer 4 accords (reset)",
    addOne:        "Ajouter un accord",
    loopTooltip:   "Boucle — rejouer en continu",
    exportMidi:    "Exporter en fichier MIDI",
    loadPrefix:    "Charger : ",
    dragHere:      "Glisser des accords ici…",
    suggHint:      "Les accords avec un contour coloré sont les prochains accords suggérés — plus lumineux = meilleur enchaînement.",
    // App
    settings:      "Paramètres",
    clickHint:     "jouer",
    rclickHint:    "ajouter",
    dragHint:      "séquence",
    spaceHint:     "jouer/stop",
    // Feature cards
    browseTitle:   "PARCOURIR",
    browseBody:    "168 accords · 12 toniques · 14 types. Cliquer pour écouter.",
    buildTitle:    "COMPOSER",
    buildBody:     "Glisser dans la séquence. Réordonner librement. Tonalité détectée en direct.",
    playTitle:     "JOUER",
    playBody:      "Espace ou Jouer. Tempo & paramètres appliqués en direct.",
    suggestTitle:  "SUGGÉRER",
    suggestBody:   "Contour coloré = prochain accord suggéré. Plus lumineux = meilleur enchaînement.",
    randomTitle:   "ALÉATOIRE",
    randomBody:    "⚄ génère 4 accords, ⚄+ en ajoute un. Basé sur la théorie : tonalité, conduite des voix & progressions courantes.",
  },
}

export function t(key, notation = "english") {
  return TRANSLATIONS[notation]?.[key] ?? TRANSLATIONS.english[key] ?? key
}

// Map DURATIONS beats value → translation key
const BEATS_KEY = { 0.25: "dur016", 0.5: "dur05", 1: "dur1", 2: "dur2", 4: "dur4" }
export function durName(beats, notation) {
  return t(BEATS_KEY[beats] ?? "dur1", notation)
}
