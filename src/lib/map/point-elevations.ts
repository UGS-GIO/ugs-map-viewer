import type { QueryClient } from '@tanstack/react-query'
import { elevationsAt } from './dem-elevation'

type Id = string | number

/**
 * Ground elevation for measured points: meters, null if the lookup failed, undefined while pending.
 * Points requested together share one DEM read and one `onResolved` (a loaded file can hold many).
 */
export class PointElevations {
  private values = new Map<Id, number | null | undefined>()
  private queued = new Map<Id, [number, number]>()

  constructor(private queryClient: QueryClient, private onResolved: (ids: Set<Id>) => void) {}

  get(id: Id) {
    return this.values.get(id)
  }

  /** Starts a lookup unless this point already has one. */
  request(id: Id, at: [number, number]) {
    if (this.values.has(id)) return
    this.values.set(id, undefined)
    if (!this.queued.size) queueMicrotask(this.lookUp)
    this.queued.set(id, at)
  }

  delete(id: Id) {
    this.values.delete(id)
  }

  // Ignored once the point is gone, so a late lookup doesn't bring it back
  private settle(id: Id, value: number | null) {
    if (this.values.has(id)) this.values.set(id, value)
  }

  private lookUp = () => {
    const batch = [...this.queued]
    this.queued.clear()
    elevationsAt(this.queryClient, batch.map(([, at]) => at))
      .then((es) => batch.forEach(([id], i) => this.settle(id, es[i])))
      // Keep the failure so later draw changes don't refetch it
      .catch((err) => {
        console.warn('[measure] point elevation lookup failed:', err)
        batch.forEach(([id]) => this.settle(id, null))
      })
      .finally(() => this.onResolved(new Set(batch.map(([id]) => id))))
  }
}
