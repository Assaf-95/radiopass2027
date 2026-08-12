/**
 * React bindings for the simulation clock.
 *
 * The split matters for performance: `useSimulation` re-renders only when the
 * configuration or transport state changes, while `useFrame` hands a callback
 * straight to the animation loop and never triggers a render at all.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react'
import { useSearchParams } from 'react-router-dom'

import {
  DEFAULT_TISSUE_IDS,
  orderTissueIds,
  presetConfig,
  resolveTissues,
  TISSUES,
  type SequenceConfig,
  type Tissue,
  type TissueId,
} from '../engine'
import { resetLiveNotes } from '../components/LiveNotes'
import { MriSimulation, type SimulationSnapshot } from './simulation'

export type LearnerMode = 'guided' | 'advanced'

type MriContextValue = {
  simulation: MriSimulation
  selectedTissues: TissueId[]
  setSelectedTissues: (ids: TissueId[]) => void
  focusTissue: TissueId
  setFocusTissue: (id: TissueId) => void
  /**
   * A second tissue drawn in full beside the focus one.
   *
   * Contrast is a statement about two tissues, never one, and the chamber
   * previously drew one vector properly and reduced everything else to a dot
   * on the z axis. Holding a comparison here means fat and CSF can be watched
   * separating from each other rather than each being read off in turn.
   */
  compareTissue: TissueId | null
  setCompareTissue: (id: TissueId | null) => void
  mode: LearnerMode
  setMode: (mode: LearnerMode) => void
  showLabels: boolean
  setShowLabels: (value: boolean) => void
}

const MriContext = createContext<MriContextValue | null>(null)

export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function MriProvider({
  children,
  initialConfig,
  initialTissues = DEFAULT_TISSUE_IDS,
  initialFocus,
  initialCompare,
  initialMode = 'guided',
  autoPlay = true,
}: {
  children: ReactNode
  initialConfig?: SequenceConfig
  initialTissues?: TissueId[]
  initialFocus?: TissueId
  /** A second tissue to open already drawn in full beside the focus one. */
  initialCompare?: TissueId | null
  initialMode?: LearnerMode
  autoPlay?: boolean
}) {
  const [simulation] = useState(
    () =>
      new MriSimulation(initialConfig ?? presetConfig('t1-se'), {
        reducedMotion: prefersReducedMotion(),
      }),
  )
  const [selectedTissues, setSelectedTissuesState] = useState<TissueId[]>(() =>
    orderTissueIds(initialTissues),
  )
  const [focusTissue, setFocusTissue] = useState<TissueId>(
    initialFocus ?? initialTissues[0] ?? 'fat',
  )
  const [compareTissue, setCompareTissue] = useState<TissueId | null>(initialCompare ?? null)
  const [mode, setMode] = useState<LearnerMode>(initialMode)
  const [showLabels, setShowLabels] = useState(true)

  const setSelectedTissues = useCallback((ids: TissueId[]) => {
    setSelectedTissuesState(orderTissueIds(ids))
  }, [])

  // Deep links from the comparison matrix: ?focus=csf&t=2372 opens a sequence
  // paused at the moment that matters for that cell.
  const [searchParams] = useSearchParams()
  const focusParam = searchParams.get('focus')
  const timeParam = searchParams.get('t')

  useEffect(() => {
    if (focusParam && TISSUES.some((tissue) => tissue.id === focusParam)) {
      setFocusTissue(focusParam as TissueId)
      setSelectedTissuesState((current) =>
        current.includes(focusParam as TissueId)
          ? current
          : orderTissueIds([...current, focusParam as TissueId]),
      )
    }
    if (timeParam !== null) {
      const time = Number(timeParam)
      if (Number.isFinite(time)) {
        simulation.pause()
        simulation.seekTime(time)
        return
      }
    }
    if (autoPlay && !prefersReducedMotion()) simulation.play()
  }, [simulation, autoPlay, focusParam, timeParam])

  // A live note belongs to the screen the interaction happened on, so each
  // laboratory starts with an empty slot rather than inheriting the last one.
  useEffect(() => {
    resetLiveNotes()
    return () => simulation.destroy()
  }, [simulation])

  // Honour a change of the operating-system motion preference while open.
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return
    const query = window.matchMedia('(prefers-reduced-motion: reduce)')
    const handler = () => simulation.setReducedMotion(query.matches)
    query.addEventListener?.('change', handler)
    return () => query.removeEventListener?.('change', handler)
  }, [simulation])

  const value = useMemo(
    () => ({
      simulation,
      selectedTissues,
      setSelectedTissues,
      focusTissue,
      setFocusTissue,
      compareTissue,
      setCompareTissue,
      mode,
      setMode,
      showLabels,
      setShowLabels,
    }),
    [simulation, selectedTissues, setSelectedTissues, focusTissue, compareTissue, mode, showLabels],
  )

  return <MriContext.Provider value={value}>{children}</MriContext.Provider>
}

export function useMri(): MriContextValue {
  const context = useContext(MriContext)
  if (!context) throw new Error('useMri must be used inside an MriProvider')
  return context
}

/** Re-renders only on configuration or transport changes. */
export function useSimulation(): SimulationSnapshot {
  const { simulation } = useMri()
  return useSyncExternalStore(simulation.subscribe, simulation.getSnapshot, simulation.getSnapshot)
}

/**
 * Runs a callback on every animation frame without re-rendering.
 *
 * The callback is held in a ref so that a component can close over fresh props
 * without resubscribing — resubscribing every render would restart the draw
 * loop constantly.
 */
export function useFrame(callback: (snapshot: SimulationSnapshot) => void) {
  const { simulation } = useMri()
  const ref = useRef(callback)
  ref.current = callback

  useEffect(() => {
    return simulation.subscribeFrame((snapshot) => ref.current(snapshot))
  }, [simulation])
}

/**
 * Samples simulated time at a limited rate for text readouts.
 *
 * Numbers beside a slider do not need 60 updates a second, and rendering React
 * that often is exactly what the performance requirements rule out.
 */
export function useSampledTime(hz = 12): number {
  const { simulation } = useMri()
  const [time, setTime] = useState(() => simulation.getSnapshot().time)
  const lastRef = useRef(0)

  useEffect(() => {
    const interval = 1000 / hz
    return simulation.subscribeFrame((snapshot) => {
      const now = performance.now()
      if (now - lastRef.current < interval) return
      lastRef.current = now
      setTime(snapshot.time)
    })
  }, [simulation, hz])

  return time
}

/** Resolved tissue objects for the current field strength and learner edits. */
export function useTissues(): Tissue[] {
  const { selectedTissues } = useMri()
  const { config } = useSimulation()
  return useMemo(
    () => resolveTissues(selectedTissues, config.fieldT, config.tissueOverrides),
    [selectedTissues, config.fieldT, config.tissueOverrides],
  )
}

/** The tissue currently being inspected. */
export function useFocusTissue(): Tissue {
  const { focusTissue } = useMri()
  const { config } = useSimulation()
  return useMemo(
    () => resolveTissues([focusTissue], config.fieldT, config.tissueOverrides)[0],
    [focusTissue, config.fieldT, config.tissueOverrides],
  )
}

/** The second tissue drawn in full, when one has been chosen. */
export function useCompareTissue(): Tissue | null {
  const { compareTissue, focusTissue } = useMri()
  const { config } = useSimulation()
  return useMemo(() => {
    // Comparing a tissue with itself would draw two vectors on top of each
    // other and read as a rendering fault.
    if (!compareTissue || compareTissue === focusTissue) return null
    return resolveTissues([compareTissue], config.fieldT, config.tissueOverrides)[0] ?? null
  }, [compareTissue, focusTissue, config.fieldT, config.tissueOverrides])
}
