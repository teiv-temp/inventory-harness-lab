import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

const root = process.cwd()
const git = process.platform === 'win32' ? 'git.exe' : 'git'
const gh = process.platform === 'win32' ? 'gh.exe' : 'gh'
const protectedPaths = [
  'docs/01-requirements.md',
  'docs/06-architecture.md',
  'docs/harness/',
  'AGENTS.md',
  'CLAUDE.md',
]

type Review = { state: string; user?: { login?: string }; commit?: { oid?: string } }
type PullRequest = {
  number: number
  state: string
  author?: { login?: string }
  baseRefOid?: string
  headRefOid?: string
  reviews?: Review[]
}

function run(command: string, args: string[]) {
  return execFileSync(command, args, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}

function normalize(file: string) {
  return file.replaceAll('\\', '/').replace(/^\.\//, '').toLowerCase()
}

function isProtected(file: string) {
  const normalized = normalize(file)
  return protectedPaths.some((entry) => {
    const rule = normalize(entry)
    return rule.endsWith('/') ? normalized.startsWith(rule) : normalized === rule
  })
}

function changedFiles(base: string, head: string) {
  const committed = run(git, ['diff', '--name-only', `${base}...${head}`]).split(/\r?\n/).filter(Boolean)
  const staged = run(git, ['diff', '--cached', '--name-only']).split(/\r?\n/).filter(Boolean)
  const working = run(git, ['diff', '--name-only']).split(/\r?\n/).filter(Boolean)
  return [...new Set([...committed, ...staged, ...working].map(normalize))]
}

function findPullRequest(head: string, number?: number): PullRequest | null {
  if (!process.env.GITHUB_ACTIONS && !existsSync(path.join(root, '.git'))) return null
  try {
    const args = number
      ? ['pr', 'view', String(number), '--json', 'number,state,author,baseRefOid,headRefOid,reviews']
      : ['pr', 'list', '--head', head, '--state', 'open', '--json', 'number,state,author,baseRefOid,headRefOid,reviews', '--limit', '1']
    const output = run(gh, args)
    if (number) return JSON.parse(output) as PullRequest
    const prs = JSON.parse(output || '[]') as PullRequest[]
    return prs[0] ?? null
  } catch {
    return null
  }
}

function currentHead() {
  return process.env.GITHUB_SHA || run(git, ['rev-parse', 'HEAD'])
}

function currentBase() {
  if (process.env.GITHUB_BASE_SHA) return process.env.GITHUB_BASE_SHA
  if (process.env.GITHUB_EVENT_NAME === 'push' && process.env.GITHUB_EVENT_PATH) {
    try {
      const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'))
      if (event.before && event.before !== '0'.repeat(40)) return event.before
    } catch {
      return ''
    }
  }
  try {
    return run(git, ['merge-base', 'HEAD', 'origin/main'])
  } catch {
    return ''
  }
}

const base = currentBase()
const head = currentHead()
if (!base || !head) {
  console.error('Protected 실패: base/head 커밋을 확인할 수 없습니다.')
  process.exit(1)
}

let files: string[]
try {
  files = changedFiles(base, head)
} catch (error) {
  console.error('Protected 실패: 변경 범위를 계산할 수 없습니다.')
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
}

const protectedChanges = files.filter(isProtected)
if (protectedChanges.length === 0) {
  console.log('Protected 통과: 보호 경로 변경이 없습니다.')
  process.exit(0)
}

const isMainPush = process.env.GITHUB_EVENT_NAME === 'push' && process.env.GITHUB_REF === 'refs/heads/main'
if (isMainPush) {
  console.log('Protected 통과: 보호된 변경이 승인된 main 브랜치에 반영되었습니다.')
  process.exit(0)
}

const branch = process.env.GITHUB_HEAD_REF || run(git, ['branch', '--show-current'])
const pr = process.env.GITHUB_EVENT_PATH && existsSync(process.env.GITHUB_EVENT_PATH)
  ? (() => {
      try {
        const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'))
        return event.pull_request ? {
          number: event.pull_request.number,
          state: event.pull_request.state,
          author: { login: event.pull_request.user?.login },
          baseRefOid: event.pull_request.base?.sha,
          headRefOid: event.pull_request.head?.sha,
          reviews: [],
        } satisfies PullRequest : findPullRequest(branch, event.pull_request?.number)
      } catch {
        return findPullRequest(branch)
      }
    })()
  : findPullRequest(branch)

const author = pr?.author?.login
const approved = pr?.reviews?.some((review) =>
  review.state.toUpperCase() === 'APPROVED' && review.user?.login && review.user.login !== author,
)
const headMatches = !pr?.headRefOid || pr.headRefOid === head

if (!pr || pr.state !== 'OPEN' || !approved || !headMatches) {
  console.error('Protected 실패: 승인되지 않은 보호 경로 변경입니다.')
  console.error(`- 기준: ${base}`)
  console.error(`- 대상: ${head}`)
  console.error(`- 변경 경로: ${protectedChanges.join(', ')}`)
  console.error('- 상태: NEEDS_HUMAN')
  console.error('- 사람의 GitHub PR 승인 후 다시 실행하세요. 작성자 자기 승인은 인정하지 않습니다.')
  process.exit(1)
}

console.log(`Protected 통과: GitHub PR #${pr.number}에서 사람의 승인을 확인했습니다.`)
