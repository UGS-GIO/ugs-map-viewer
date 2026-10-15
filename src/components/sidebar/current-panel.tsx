import { Suspense } from 'react'
import { Spinner } from '@/components/ui/loading-spinner'
import { useSidebar } from '@/hooks/use-sidebar'

/** The panel the `tab` URL param names, as the desktop sidebar and the phone sheet both show it. */
export function CurrentPanel() {
  const Panel = useSidebar().currentContent?.component
  return <Suspense fallback={<Spinner />}>{Panel ? <Panel /> : <Spinner />}</Suspense>
}
