// React 19 renders `inert`; @types/react 18 doesn't declare it yet. Delete once the types are on 19.
import 'react'

declare module 'react' {
  // T must match React's declaration for the interfaces to merge.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface HTMLAttributes<T> {
    inert?: boolean
  }
}
