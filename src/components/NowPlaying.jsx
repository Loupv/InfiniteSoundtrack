import { useEffect, useRef, useState } from "react"
import { NOTE_COLORS } from "../constants"

const SLOT_W = 82   // chip width (px)
const GAP    = 10   // gap between chips (px)
const STRIDE = SLOT_W + GAP

// Build the stable 9-slot display list
// Slots: 4 history (pos -4..-1) + 1 current (pos 0) + 4 upcoming (pos +1..+4)
function buildStable(history, current, queue) {
  const items = []
  for (let i = 0; i < 4; i++) {
    const c = history.slice(-4)[i] ?? null
    items.push({ chord: c, type: "history", pos: i - 4, key: `h${i}` })
  }
  items.push({ chord: current ?? null, type: "current", pos: 0, key: "cur" })
  for (let i = 0; i < 4; i++) {
    items.push({ chord: queue[i] ?? null, type: "future", pos: i + 1, key: `f${i}` })
  }
  return items  // always 9 items
}

// ── ChordTicker ───────────────────────────────────────────────────────────────

export function NowPlaying({ currentChord, history, queue, detectedKey, tempo, state }) {
  const isPlaying  = state === "playing" || state === "fadingIn" || state === "fadingOut"

  // ── Sliding ticker state ──
  const [displayed,  setDisplayed]  = useState(() => buildStable([], null, []))
  const [slideX,     setSlideX]     = useState(0)
  const [transition, setTransition] = useState("none")

  const animatingRef   = useRef(false)
  const prevChordRef   = useRef(null)
  const displayedRef   = useRef(displayed)
  displayedRef.current = displayed

  useEffect(() => {
    const newStable = buildStable(history, currentChord, queue)

    // First render or no current chord: just snap
    if (!currentChord || prevChordRef.current === null) {
      prevChordRef.current = currentChord?.name ?? null
      setDisplayed(newStable)
      return
    }

    if (currentChord.name !== prevChordRef.current) {
      // ── Chord advanced: slide animation ──
      prevChordRef.current = currentChord.name

      if (animatingRef.current) {
        // Already animating — snap immediately to new stable
        animatingRef.current = false
        setTransition("none")
        setSlideX(0)
        setDisplayed(newStable)
        return
      }

      animatingRef.current = true

      // Build extended: current 9 items + 1 entering from right
      const entering = newStable.at(-1)
      const extended = [
        ...displayedRef.current,
        { ...entering, key: `enter-${Date.now()}` },
      ]

      // 1. Snap to extended (no transition) so the entering chip is rendered off-screen
      setTransition("none")
      setSlideX(0)
      setDisplayed(extended)

      // 2. Next two frames: start slide
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          setTransition(`transform 0.38s cubic-bezier(0.25, 0.46, 0.45, 0.94)`)
          setSlideX(-STRIDE)
        })
      })

      // 3. After animation: snap to clean stable state
      setTimeout(() => {
        setTransition("none")
        setSlideX(0)
        setDisplayed(newStable)
        animatingRef.current = false
      }, 420)

    } else {
      // ── Same chord, only queue changed: update future slots in-place ──
      setDisplayed(prev =>
        prev.map(item => {
          if (item.type !== "future") return item
          const idx = item.pos - 1
          return { ...item, chord: queue[idx] ?? null }
        })
      )
    }
  }, [currentChord?.name, history.length, queue.map(c => c?.name).join(",")])

  // Viewport: exactly 9 slots visible, center slot is the current chord
  const viewportW = STRIDE * 9 - GAP

  return (
    <div style={{
      background: "#111",
      border: "1px solid #1e1e1e",
      borderRadius: 12,
      padding: "16px 20px",
      display: "flex",
      flexDirection: "column",
      gap: 16,
    }}>

      {/* Meta row */}
      <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontSize: 10, color: "#555", letterSpacing: "0.08em" }}>TONALITÉ</span>
          <span style={{ fontSize: 12, color: "#777" }}>{detectedKey ?? "—"}</span>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          <span style={{ fontSize: 10, color: "#555", letterSpacing: "0.08em" }}>TEMPO</span>
          <span style={{ fontSize: 12, color: "#777" }}>{tempo} bpm</span>
        </div>
        <div style={{ marginLeft: "auto" }}>
          {state === "fadingIn"  && <Badge label="FADE IN"  color="#4a8abf" />}
          {state === "fadingOut" && <Badge label="FADE OUT" color="#bf8a4a" />}
          {state === "playing"   && <PulseDot />}
        </div>
      </div>

      {/* Chord ticker */}
      <div style={{
        overflow: "hidden",
        width: Math.min(viewportW, "100%"),
        maxWidth: "100%",
        alignSelf: "center",
      }}>
        <div
          style={{
            display: "flex",
            gap: GAP,
            transform: `translateX(${slideX}px)`,
            transition,
            willChange: "transform",
          }}
        >
          {displayed.map(item => (
            <ChordChip key={item.key} item={item} isPlaying={isPlaying} />
          ))}
        </div>
      </div>

    </div>
  )
}

// ── ChordChip ─────────────────────────────────────────────────────────────────

function ChordChip({ item, isPlaying }) {
  const { chord, type, pos } = item
  const dist    = Math.abs(pos)
  const isCur   = type === "current"
  const isPast  = type === "history"
  const isFut   = type === "future"
  const color   = chord ? (NOTE_COLORS[chord.root] ?? "#555") : "#1e1e1e"

  const opacity = isCur
    ? (isPlaying ? 1 : 0.6)
    : isPast
      ? Math.max(0.12, 0.45 - dist * 0.07)
      : Math.max(0.18, 0.55 - dist * 0.08)

  const scale = isCur ? 1 : Math.max(0.82, 1 - dist * 0.04)

  return (
    <div style={{
      width:          SLOT_W,
      flexShrink:     0,
      height:         isCur ? 60 : 48,
      borderRadius:   8,
      display:        "flex",
      alignItems:     "center",
      justifyContent: "center",
      flexDirection:  "column",
      gap:            2,
      border:         `1.5px solid ${isCur && chord ? color : "#1e1e1e"}`,
      background:     isCur && chord ? `${color}14` : "transparent",
      boxShadow:      isCur && chord && isPlaying ? `0 0 16px ${color}44` : "none",
      opacity,
      transform:      `scale(${scale})`,
      transition:     "border-color 0.3s, box-shadow 0.3s, opacity 0.3s",
      userSelect:     "none",
    }}>
      {chord ? (
        <>
          <span style={{
            fontSize:      isCur ? 18 : 13,
            fontWeight:    700,
            letterSpacing: "0.03em",
            color:         isCur ? color : isPast ? "#444" : "#666",
            lineHeight:    1,
          }}>
            {chord.root}
            <span style={{ fontSize: isCur ? 12 : 9, fontWeight: 500 }}>
              {chord.suffix || ""}
            </span>
          </span>
          {isCur && (
            <span style={{ fontSize: 9, color: `${color}88`, letterSpacing: "0.06em" }}>
              {chord.root}{chord.suffix || ""}
            </span>
          )}
        </>
      ) : (
        <span style={{ fontSize: 16, color: "#222" }}>—</span>
      )}
    </div>
  )
}

function PulseDot() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <div style={{
        width: 6, height: 6, borderRadius: "50%",
        background: "#4a8abf", boxShadow: "0 0 5px #4a8abf",
        animation: "pulse 1.6s ease-in-out infinite",
      }} />
      <style>{`@keyframes pulse{0%,100%{opacity:1;transform:scale(1)}50%{opacity:0.35;transform:scale(0.65)}}`}</style>
      <span style={{ fontSize: 9, color: "#4a8abf", letterSpacing: "0.1em" }}>EN COURS</span>
    </div>
  )
}

function Badge({ label, color }) {
  return (
    <span style={{
      fontSize: 9, color,
      border: `1px solid ${color}55`,
      borderRadius: 4,
      padding: "2px 6px",
      letterSpacing: "0.08em",
    }}>
      {label}
    </span>
  )
}
