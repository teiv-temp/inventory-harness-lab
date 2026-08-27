import { describe, expect, it } from 'vitest'
import { countExpiryStatuses } from '../../src/lib/inventory'

describe('Issue #14 — 만료 필터와 집계', () => {
  const makeProduct = (expiry: string, quantity = 1, type = 'OWN') => ({
    expiryAlertDays: 30,
    lots: [{ expiryDate: new Date(expiry), quantity, location: { type } }],
  })

  it('대표 로트 기준의 만료 상품 수를 계산한다', () => {
    const result = countExpiryStatuses([
      makeProduct('2020-01-01'),
      makeProduct('2020-02-01'),
      makeProduct('2020-03-01'),
      makeProduct('2026-09-15'),
    ])
    expect(result.expired).toBe(3)
    expect(result.soon).toBe(1)
  })

  it('가용 거점이 아닌 로트는 만료 상품 집계에 포함하지 않는다', () => {
    expect(countExpiryStatuses([makeProduct('2020-01-01', 1, 'POPUP')])).toEqual({ soon: 0, expired: 0 })
  })
})
