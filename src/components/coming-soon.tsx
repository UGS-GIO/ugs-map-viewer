import { Image } from '@/components/ui/image'
import { SimpleRouteList } from '@/components/ui/route-list'
import utahLogo from '@/assets/utah-logo.png'

export default function ComingSoon() {
  return (
    <div className='min-h-full flex flex-col items-center justify-center p-4'>
      <div className="mb-4">
        <Image
          src={utahLogo}
          alt="Utah Geological Survey Logo"
          className="h-24 w-auto rounded object-contain dark:bg-white dark:p-1"
        />
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