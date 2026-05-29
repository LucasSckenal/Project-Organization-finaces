'use client'

import {
  createContext, useContext, useRef, useCallback,
  useState, useEffect, type ReactNode,
} from 'react'

export type SoundName = 'click' | 'success' | 'error' | 'notify' | 'open' | 'close' | 'boot' | 'nav'

interface SoundContextValue {
  play:       (name: SoundName) => void
  muted:      boolean
  toggleMute: () => void
}

const SoundContext = createContext<SoundContextValue | null>(null)

// ── Synthesizer ───────────────────────────────────────────────────────────────
// All sounds are procedurally generated — no audio files needed.
function synth(ctx: AudioContext, master: GainNode, name: SoundName) {
  const t = ctx.currentTime

  const osc  = (freq: number, type: OscillatorType, start: number, dur: number, vol: number) => {
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = type
    o.frequency.setValueAtTime(freq, start)
    g.gain.setValueAtTime(vol,   start)
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur)
    o.connect(g); g.connect(master)
    o.start(start); o.stop(start + dur + 0.01)
  }

  const sweep = (f0: number, f1: number, type: OscillatorType, start: number, dur: number, vol: number) => {
    const o = ctx.createOscillator()
    const g = ctx.createGain()
    o.type = type
    o.frequency.setValueAtTime(f0, start)
    o.frequency.exponentialRampToValueAtTime(f1, start + dur)
    g.gain.setValueAtTime(vol,   start)
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur)
    o.connect(g); g.connect(master)
    o.start(start); o.stop(start + dur + 0.01)
  }

  switch (name) {
    case 'click':
      sweep(1400, 700, 'sine', t, 0.04, 0.10)
      break

    case 'nav':
      sweep(500, 900, 'sine', t, 0.09, 0.07)
      break

    case 'open':
      sweep(380, 760, 'sine', t,      0.10, 0.08)
      sweep(560, 880, 'sine', t + 0.04, 0.08, 0.05)
      break

    case 'close':
      sweep(760, 380, 'sine', t, 0.10, 0.07)
      break

    case 'success':
      osc(523, 'sine', t,        0.14, 0.10)
      osc(659, 'sine', t + 0.09, 0.14, 0.10)
      osc(784, 'sine', t + 0.18, 0.20, 0.12)
      break

    case 'error':
      sweep(280, 160, 'sawtooth', t,        0.16, 0.06)
      sweep(200, 120, 'sawtooth', t + 0.10, 0.20, 0.04)
      break

    case 'notify':
      osc(880,  'sine', t,        0.18, 0.08)
      osc(1100, 'sine', t + 0.12, 0.18, 0.07)
      break

    case 'boot': {
      // Four-note rising arpeggio — warm, cinematic
      const chord = [261, 329, 392, 523]
      chord.forEach((f, i) => osc(f, 'sine', t + i * 0.18, 0.5 - i * 0.05, 0.10))
      // Low pad drone underneath
      sweep(80, 90, 'sine', t, chord.length * 0.18 + 0.5, 0.07)
      break
    }
  }
}

// ── Provider ──────────────────────────────────────────────────────────────────
export function SoundProvider({ children }: { children: ReactNode }) {
  const ctxRef    = useRef<AudioContext | null>(null)
  const masterRef = useRef<GainNode | null>(null)

  const [muted, setMuted] = useState<boolean>(false)

  useEffect(() => {
    setMuted(localStorage.getItem('ma-muted') === '1')
  }, [])

  const getAudio = useCallback(() => {
    if (!ctxRef.current) {
      ctxRef.current  = new AudioContext()
      masterRef.current = ctxRef.current.createGain()
      masterRef.current.gain.value = 0.35
      masterRef.current.connect(ctxRef.current.destination)
    }
    return { ctx: ctxRef.current, master: masterRef.current! }
  }, [])

  const play = useCallback((name: SoundName) => {
    if (muted || typeof window === 'undefined') return
    try {
      const { ctx, master } = getAudio()
      if (ctx.state === 'suspended') ctx.resume()
      synth(ctx, master, name)
    } catch { /* AudioContext blocked by browser */ }
  }, [muted, getAudio])

  const toggleMute = useCallback(() => {
    setMuted((v) => {
      const next = !v
      localStorage.setItem('ma-muted', next ? '1' : '0')
      return next
    })
  }, [])

  return (
    <SoundContext.Provider value={{ play, muted, toggleMute }}>
      {children}
    </SoundContext.Provider>
  )
}

export function useSound() {
  const ctx = useContext(SoundContext)
  if (!ctx) throw new Error('useSound must be used inside SoundProvider')
  return ctx
}
