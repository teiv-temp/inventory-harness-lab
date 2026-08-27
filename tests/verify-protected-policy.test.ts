import { describe, expect, it } from 'vitest'
import { changedProtectedFiles, isProtected, parseScope, validApproval } from '../scripts/verify/protected-policy'

describe('Protected 경로', () => {
  it('정확한 파일과 하위 경로만 보호한다', () => {
    expect(isProtected('./docs\\harness\\01-ssot.md')).toBe(true)
    expect(isProtected('docs/harnesses/01-ssot.md')).toBe(false)
    expect(isProtected('docs/01-requirements.md.bak')).toBe(false)
    expect(changedProtectedFiles(['src/app.ts', 'AGENTS.md', 'AGENTS.md'])).toEqual(['agents.md'])
  })
})

describe('Protected 승인 범위', () => {
  it('구조화된 보호 범위만 읽고 보호 경로 밖 범위를 거부한다', () => {
    expect(parseScope('Protected-Scope: docs/harness/01-ssot.md, AGENTS.md')).toEqual([
      'docs/harness/01-ssot.md',
      'agents.md',
    ])
    expect(parseScope('Protected-Scope: *')).toBeNull()
    expect(parseScope('Protected-Scope: src/app.ts')).toBeNull()
  })

  it('현재 head의 사람 승인만 변경 범위를 승인한다', () => {
    const base = {
      number: 1,
      state: 'OPEN',
      headRefOid: 'head',
      author: { login: 'author' },
    }
    expect(validApproval({ ...base, reviews: [{ state: 'APPROVED', commit: { oid: 'head' }, user: { login: 'reviewer', type: 'User' }, body: 'Protected-Scope: AGENTS.md' }] }, 'head', ['agents.md'])).toBe(true)
    expect(validApproval({ ...base, reviews: [{ state: 'APPROVED', commit: { oid: 'old' }, user: { login: 'reviewer', type: 'User' }, body: 'Protected-Scope: AGENTS.md' }] }, 'head', ['agents.md'])).toBe(false)
    expect(validApproval({ ...base, reviews: [{ state: 'APPROVED', commit: { oid: 'head' }, user: { login: 'author', type: 'User' }, body: 'Protected-Scope: AGENTS.md' }] }, 'head', ['agents.md'])).toBe(false)
    expect(validApproval({ ...base, reviews: [{ state: 'APPROVED', commit: { oid: 'head' }, user: { login: 'automation[bot]', type: 'Bot' }, body: 'Protected-Scope: AGENTS.md' }] }, 'head', ['agents.md'])).toBe(false)
  })
})
