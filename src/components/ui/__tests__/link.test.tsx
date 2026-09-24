import { describe, it, expect } from 'vitest'
import { linkIfUrl } from '../link'
import { isValidElement, type ReactElement, type ReactNode } from 'react'

type LinkElementProps = { to: string; children: ReactNode }

describe('linkIfUrl', () => {
  it('returns a Link element when value is an http/https URL', () => {
    const transform = linkIfUrl('View Report')
    const result = transform('https://doi.org/10.34191/RI-291')
    expect(isValidElement(result)).toBe(true)
    const linkElem = result as ReactElement<LinkElementProps>
    expect(linkElem.props.to).toBe('https://doi.org/10.34191/RI-291')
    expect(linkElem.props.children).toBe('View Report')
  })

  it('uses the URL itself as the link label when no label is provided', () => {
    const transform = linkIfUrl()
    const url = 'https://geology.utah.gov'
    const result = transform(url)
    expect(isValidElement(result)).toBe(true)
    const linkElem = result as ReactElement<LinkElementProps>
    expect(linkElem.props.to).toBe(url)
    expect(linkElem.props.children).toBe(url)
  })

  it('returns the raw value when value is not an http/https URL', () => {
    const transform = linkIfUrl('View Report')
    expect(transform('user@example.com')).toBe('user@example.com')
    expect(transform('javascript:alert(1)')).toBe('javascript:alert(1)')
    expect(transform('Not a link')).toBe('Not a link')
    expect(transform('')).toBe('')
    expect(transform(null)).toBe(null)
    expect(transform(undefined)).toBe(undefined)
  })
})
