import { useCallback } from 'react'
import { useNavigate, useSearch } from '@tanstack/react-router'
import type { UnitSystem } from '@/lib/map/measure-store'

/** US or metric units for measurements, kept in the URL like the coordinate format. */
export function useUnits() {
  const navigate = useNavigate()
  const units = useSearch({ from: '/_map', select: (s) => s.units ?? 'us' })
  const setUnits = useCallback(
    (next: UnitSystem) => navigate({ to: '.', search: (prev) => ({ ...prev, units: next }), replace: true }),
    [navigate],
  )
  return { units, setUnits }
}
