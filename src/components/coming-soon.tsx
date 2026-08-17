import { SimpleRouteList } from '@/components/ui/route-list'
import { UgsLogo } from '@/components/ugs-logo'

export default function ComingSoon() {
  return (
    <div className='min-h-full flex flex-col items-center justify-center p-4'>
      <div className="mb-6">
        <UgsLogo className="h-16 w-auto max-w-full object-contain sm:h-20" />
      </div>
      <h1 className='font-display text-4xl font-bold leading-tight text-center'>Coming Soon</h1>
      <p className='text-center text-muted-foreground'>
        This page has not been created yet. <br />
        Stay tuned!
      </p>
      <p className='text-center text-muted-foreground mt-4'>
        In the meantime, check out our other interactive maps.
      </p>
      <div className="container mx-auto py-8">
        <SimpleRouteList />
      </div>
    </div>
  )
}