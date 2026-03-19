import { useSoundtrack } from "./hooks/useSoundtrack"
import { NowPlaying }     from "./components/NowPlaying"
import { EmotionalSliders } from "./components/EmotionalSliders"
import { InstrumentPanel }  from "./components/InstrumentPanel"
import { EventButtons }     from "./components/EventButtons"

function track(name, params = {}) {
  try { window.gtag?.("event", name, params) } catch {}
}

export default function App() {
  const {
    state, currentChord, history, queue, detectedKey, tempo,
    mood, layers, rhythmPattern, rhythmVolume,
    play, stop, fadeIn, fadeOut, reroll, unlock,
    setMood, setLayer, setRhythm, setRhythmVol,
  } = useSoundtrack()

  function handlePlay() {
    unlock()
    play()
    track("soundtrack_play")
  }

  function handleStop() {
    stop()
    track("soundtrack_stop")
  }

  function handleFadeIn() {
    unlock()
    fadeIn()
    track("soundtrack_fadein")
  }

  function handleFadeOut() {
    fadeOut()
    track("soundtrack_fadeout")
  }

  function handleReroll() {
    reroll()
    track("soundtrack_reroll")
  }

  return (
    <div style={{
      fontFamily: "'Courier New', monospace",
      backgroundColor: "#0d0d0d",
      color: "#f0f0f0",
      minHeight: "100vh",
      padding: "20px 16px 40px",
    }}>
      <style>{`
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { height: 4px; width: 4px; background: #111; }
        ::-webkit-scrollbar-thumb { background: #333; border-radius: 3px; }
        input[type=range] { -webkit-appearance: none; appearance: none; height: 4px; border-radius: 2px; background: #2a2a2a; }
        input[type=range]::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 13px; height: 13px; border-radius: 50%; background: currentColor; cursor: pointer; }
        input[type=range]::-moz-range-thumb { width: 13px; height: 13px; border-radius: 50%; border: none; cursor: pointer; }
        select { -webkit-appearance: none; }
      `}</style>

      <div style={{ maxWidth: 960, margin: "0 auto" }}>
        {/* ── Header ── */}
        <div style={{
          display: "flex",
          alignItems: "baseline",
          gap: 12,
          marginBottom: 24,
        }}>
          <h1 style={{ margin: 0, fontSize: 16, fontWeight: 700, letterSpacing: "0.1em", color: "#fff" }}>
            INFINITE SOUNDTRACK
          </h1>
          <span style={{ fontSize: 10, color: "#333", letterSpacing: "0.06em" }}>v2.0</span>
          <a
            href="https://buymeacoffee.com/loupv"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => track("coffee_click")}
            style={{
              marginLeft: "auto",
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              background: "#1c1800",
              color: "#c8a800",
              fontFamily: "inherit",
              fontWeight: 600,
              fontSize: 10,
              letterSpacing: "0.04em",
              padding: "4px 9px",
              borderRadius: 5,
              textDecoration: "none",
              border: "1px solid #3a3000",
            }}
          >
            ☕ Soutenir
          </a>
        </div>

        {/* ── Now Playing ── */}
        <div style={{ marginBottom: 12 }}>
          <NowPlaying
            currentChord={currentChord}
            history={history}
            queue={queue}
            detectedKey={detectedKey}
            tempo={tempo}
            state={state}
          />
        </div>

        {/* ── Controls ── */}
        <div style={{ marginBottom: 12 }}>
          <EventButtons
            state={state}
            onPlay={handlePlay}
            onStop={handleStop}
            onFadeIn={handleFadeIn}
            onFadeOut={handleFadeOut}
            onReroll={handleReroll}
          />
        </div>

        {/* ── Main two-column layout ── */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: 12,
        }}>
          <EmotionalSliders mood={mood} onChange={setMood} />
          <InstrumentPanel
            layers={layers}
            onLayerChange={setLayer}
            rhythmPattern={rhythmPattern}
            rhythmVolume={rhythmVolume}
            onRhythmChange={setRhythm}
            onRhythmVolumeChange={setRhythmVol}
          />
        </div>

        {/* ── Footer ── */}
        <div style={{
          marginTop: 32,
          paddingTop: 12,
          borderTop: "1px solid #1a1a1a",
          display: "flex",
          justifyContent: "center",
          gap: 16,
          flexWrap: "wrap",
        }}>
          <span style={{ fontSize: 10, color: "#333" }}>
            Loup Vuarnesson &nbsp;·&nbsp;
            <a href="mailto:loup.vuarnesson@pm.me" style={{ color: "#444", textDecoration: "none" }}>
              loup.vuarnesson@pm.me
            </a>
          </span>
        </div>
      </div>
    </div>
  )
}
