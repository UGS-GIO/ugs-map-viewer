import { Image } from '@/components/ui/image'
import { SimpleRouteList } from '@/components/ui/route-list'

export default function ComingSoon() {
  return (
    <div className='min-h-svh flex flex-col items-center justify-center p-4'>
      <div className="w-10/12 max-w-xs sm:max-w-sm mb-4">
        <Image
          src="/logo_main.png"
          alt="UGS Logo"
          className="w-full h-auto object-contain"
        />
      </div>
      <h1 className='text-4xl font-bold leading-tight text-center'>Coming Soon</h1>
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