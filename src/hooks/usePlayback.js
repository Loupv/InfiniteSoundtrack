import { useRef, useCallback } from "react"

/**
 * Manages sequential playback of a chord progression with optional looping.
 *
 * The loop is driven by a plain async function stored in a ref so it can read
 * the *latest* progression / beatMs on every iteration without stale closures.
 *
 * stopRef is the sole brake: setting it to true causes the inner loop to exit
 * cleanly after the current chord finishes, regardless of how many times the
 * outer do-while would otherwise keep going.
 */
export function usePlayback({ progressionRef, beatMsRef, playChord, onStart, onStop, onChordStart }) {
  const stopRef      = useRef(false)
  const runningRef   = useRef(false)

  const stop = useCallback(() => {
    stopRef.current = true
  }, [])

  const start = useCallback((loop) => {
    if (runningRef.current) return

    runningRef.current = true
    stopRef.current    = false
    onStart?.()

    ;(async () => {
      do {
        const snap = [...progressionRef.current]
        for (const entry of snap) {
          if (stopRef.current) break
          onChordStart?.(entry.id)
          await playChord(entry)
          // wait one beat; poll stopRef every 16 ms so we react quickly
          const target = Date.now() + beatMsRef.current
          while (Date.now() < target) {
            if (stopRef.current) break
            await new Promise(r => setTimeout(r, 16))
          }
          if (stopRef.current) break
        }
      } while (loop && !stopRef.current)

      runningRef.current = false
      stopRef.current    = false
      onStop?.()
    })()
  }, [playChord, progressionRef, beatMsRef, onStart, onStop, onChordStart])

  const toggle = useCallback((loop) => {
    if (runningRef.current) stop()
    else start(loop)
  }, [start, stop])

  return { start, stop, toggle, isRunning: () => runningRef.current }
}
