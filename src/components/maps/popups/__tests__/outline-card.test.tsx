import { describe, it, expect } from 'vitest'
import { OutlineCard } from '../outline-card'
import type { DisplayField } from '@/lib/types/mapping-types'
import type { ReactElement } from 'react'

describe('OutlineCard', () => {
  const displayFields: DisplayField[] = [
    { field: 'projectcode', label: 'Project Code' },
    { field: 'count', label: 'Total Count', format: 'number' },
    { field: 'notes' },
    {
      field: 'custom',
      label: 'Custom',
      transform: (v) => (v ? `Custom: ${v}` : '—'),
    },
  ]

  it('renders card with field labels and formatted values', () => {
    const row = {
      projectcode: 'PRJ-100',
      count: 1500,
      notes: 'Some notes',
      custom: 'foo',
    }

    const result = OutlineCard({
      recordIndex: 0,
      totalRecords: 1,
      row,
      displayFields,
    })

    expect(result).toBeDefined()
    // Since totalRecords is 1, header is not rendered
    expect(result.props.children[0]).toBe(false)

    const fields = result.props.children[1]
    expect(fields).toHaveLength(4)
    expect(fields[0].props.children[0].props.children).toBe('Project Code')
    expect(fields[0].props.children[1].props.children).toBe('PRJ-100')
    expect(fields[1].props.children[0].props.children).toBe('Total Count')
    expect(fields[1].props.children[1].props.children).toBe('1,500')
    expect(fields[2].props.children[0].props.children).toBe('notes')
    expect(fields[2].props.children[1].props.children).toBe('Some notes')
    expect(fields[3].props.children[0].props.children).toBe('Custom')
    expect(fields[3].props.children[1].props.children).toBe('Custom: foo')
  })

  it('renders record index header when totalRecords > 1', () => {
    const row = { projectcode: 'PRJ-100' }

    const result = OutlineCard({
      recordIndex: 1,
      totalRecords: 3,
      row,
      displayFields: [{ field: 'projectcode', label: 'Project Code' }],
    })

    const header = result.props.children[0]
    expect(header).toBeTruthy()
    expect(header.props.children).toEqual(['Record ', 2, ' of ', 3])
  })

  it('falls back to em dash when value is empty, null, or undefined', () => {
    const row = {
      projectcode: null,
      count: '',
      notes: undefined,
    }

    const result = OutlineCard({
      recordIndex: 0,
      totalRecords: 1,
      row,
      displayFields: [
        { field: 'projectcode', label: 'Project Code' },
        { field: 'count', label: 'Count' },
        { field: 'notes', label: 'Notes' },
      ],
    })

    const fields = result.props.children[1]
    expect(fields).toHaveLength(3)
    fields.forEach((fieldElement: ReactElement) => {
      const valueDiv = fieldElement.props.children[1]
      expect(valueDiv.props.children).toBe('—')
    })
  })

  it('preserves valid falsy values like 0 and false', () => {
    const row = {
      zeroVal: 0,
      falseVal: false,
    }

    const result = OutlineCard({
      recordIndex: 0,
      totalRecords: 1,
      row,
      displayFields: [
        { field: 'zeroVal', label: 'Zero' },
        { field: 'falseVal', label: 'False' },
      ],
    })

    const fields = result.props.children[1]
    expect(fields[0].props.children[1].props.children).toBe('0')
    expect(fields[1].props.children[1].props.children).toBe('false')
  })
})
