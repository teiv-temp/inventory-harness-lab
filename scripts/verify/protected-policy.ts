import path from 'node:path'

export const protectedPaths = [
  'docs/01-requirements.md',
  'docs/06-architecture.md',
  'docs/harness/',
  'AGENTS.md',
  'CLAUDE.md',
]

export type Review = {
  state?: string
  commit?: { oid?: string }
  submittedAt?: string
  user?: { login?: string; type?: string; isBot?: boolean }
  body?: string
}

export type PullRequest = {
  number: number
  state: string
  headRefOid?: string
  author?: { login?: string }
  reviews?: Review[]
}

export function normalize(file: string) {
  return file.replaceAll('\\', '/').replace(/^\.\//, '').toLowerCase()
}

export function isProtected(file: string) {
  const normalized = normalize(file)
  return protectedPaths.some((entry) => {
    const rule = normalize(entry)
    return rule.endsWith('/') ? normalized.startsWith(rule) : normalized === rule
  })
}

export function parseScope(body: string | undefined): string[] | null {
  const line = body?.split(/\r?\n/).find((value) => /^protected-scope:/i.test(value.trim()))
  if (!line) return null
  const value = line.replace(/^protected-scope:\s*/i, '').trim()
  if (!value || value === '*') return null
  const scope = value.split(',').map((file) => normalize(file.trim())).filter(Boolean)
  return scope.length > 0 && scope.every(isProtected) ? [...new Set(scope)] : null
}

function isHumanUser(review: Review) {
  return review.user?.type === 'User' && review.user.isBot !== true && !review.user.login?.endsWith('[bot]')
}

export function validApproval(pr: PullRequest, head: string, changed: string[]) {
  const scope = pr.reviews
    ?.filter((review) => review.state?.toUpperCase() === 'APPROVED')
    .filter((review) => review.commit?.oid === head)
    .filter((review) => isHumanUser(review))
    .filter((review) => review.user?.login && review.user.login !== pr.author?.login)
    .map((review) => ({ review, scope: parseScope(review.body) }))
    .find(({ scope }) => scope && changed.every((file) => scope.includes(file)))

  return Boolean(scope)
}

export function changedProtectedFiles(files: string[]) {
  return [...new Set(files.map(normalize))].filter(isProtected)
}

export function gitPath(file: string) {
  return path.resolve(file)
}
