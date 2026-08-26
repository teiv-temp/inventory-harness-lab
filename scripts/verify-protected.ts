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

type Review = {
  state: string
  commit?: { oid?: string }
  user?: { login?: string }
}

type PullRequest = {
  number: number
  state: string
  headRefOid?: string
  reviews?: Review[]
}

function run(command: string, args: string[]) {
  return execFileSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
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
  const committed = run(git, ['diff', '--name-only', `${base}...${head}`])
    .split(/\r?\n/)
    .filter(Boolean)
  const staged = run(git, ['diff', '--cached', '--name-only']).split(/\r?\n/).filter(Boolean)
  const working = run(git, ['diff', '--name-only']).split(/\r?\n/).filter(Boolean)
  return [...new Set([...committed, ...staged, ...working].map(normalize))]
}

function findPullRequest(number?: number, branch?: string): PullRequest | null {
  try {
    const args = number
      ? ['pr', 'view', String(number), '--json', 'number,state,headRefOid,reviews']
      : ['pr', 'list', '--head', branch ?? '', '--state', 'open', '--json', 'number,state,headRefOid,reviews', '--limit', '1']
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

if (process.env.GITHUB_EVENT_NAME === 'push' && process.env.GITHUB_REF === 'refs/heads/main') {
  console.log('Protected 통과: 승인된 변경이 main에 반영되었습니다.')
  process.exit(0)
}

const branch = process.env.GITHUB_HEAD_REF || run(git, ['branch', '--show-current'])
let pullRequestNumber: number | undefined
if (process.env.GITHUB_EVENT_PATH && existsSync(process.env.GITHUB_EVENT_PATH)) {
  try {
    const event = JSON.parse(readFileSync(process.env.GITHUB_EVENT_PATH, 'utf8'))
    pullRequestNumber = event.pull_request?.number
  } catch {
    pullRequestNumber = undefined
  }
}

const pr = findPullRequest(pullRequestNumber, branch)
const approved = pr?.reviews?.some(
  (review) => review.state.toUpperCase() === 'APPROVED' && review.commit?.oid === head,
) ?? false
const headMatches = Boolean(pr?.headRefOid && pr.headRefOid === head)

if (!pr || pr.state !== 'OPEN' || !approved || !headMatches) {
  console.error('Protected 실패: 승인되지 않은 보호 경로 변경입니다.')
  console.error(`- 기준: ${base}`)
  console.error(`- 대상: ${head}`)
  console.error(`- 변경 경로: ${protectedChanges.join(', ')}`)
  console.error('- 상태: NEEDS_HUMAN')
  console.error('- 사람의 GitHub PR 승인을 확인한 뒤 다시 실행하세요.')
  process.exit(1)
}

console.log(`Protected 통과: GitHub PR #${pr.number}에서 사람의 승인을 확인했습니다.`)
