import { execFileSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import { changedProtectedFiles, validApproval, type PullRequest } from './verify/protected-policy'

const root = process.cwd()
const git = process.platform === 'win32' ? 'git.exe' : 'git'
const gh = process.platform === 'win32' ? 'gh.exe' : 'gh'

function run(command: string, args: string[]) {
  return execFileSync(command, args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim()
}

function changedFiles(base: string, head: string) {
  return run(git, ['diff', '--name-only', `${base}...${head}`])
    .split(/\r?\n/)
    .filter(Boolean)
}

function findPullRequest(number?: number, branch?: string): PullRequest | null {
  try {
    const args = number
      ? [
          'pr',
          'view',
          String(number),
          '--json',
          'number,state,headRefOid,author,reviews',
        ]
      : [
          'pr',
          'list',
          '--head',
          branch ?? '',
          '--state',
          'open',
          '--json',
          'number,state,headRefOid,author,reviews',
          '--limit',
          '1',
        ]
    const output = run(gh, args)
    if (!output) return null
    const parsed = JSON.parse(output)
    return number ? (parsed as PullRequest) : ((parsed as PullRequest[])[0] ?? null)
  } catch {
    return null
  }
}

function event() {
  const eventPath = process.env.GITHUB_EVENT_PATH
  if (!eventPath || !existsSync(eventPath)) return null
  try {
    return JSON.parse(readFileSync(eventPath, 'utf8')) as {
      before?: string
      after?: string
      pull_request?: { number?: number; base?: { sha?: string }; head?: { sha?: string } }
    }
  } catch {
    return null
  }
}

function currentHead(payload: ReturnType<typeof event>) {
  return process.env.PROTECTED_HEAD_SHA || payload?.pull_request?.head?.sha || process.env.GITHUB_SHA || run(git, ['rev-parse', 'HEAD'])
}

function currentBase(payload: ReturnType<typeof event>) {
  if (process.env.PROTECTED_BASE_SHA) return process.env.PROTECTED_BASE_SHA
  if (payload?.pull_request?.base?.sha) return payload.pull_request.base.sha
  if (process.env.GITHUB_BASE_SHA) return process.env.GITHUB_BASE_SHA
  if (payload?.before) return payload.before
  try {
    return run(git, ['merge-base', 'HEAD', 'origin/main'])
  } catch {
    return ''
  }
}

const payload = event()
const base = currentBase(payload)
const head = currentHead(payload)
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

const protectedChanges = changedProtectedFiles(files)
if (protectedChanges.length === 0) {
  console.log('Protected 통과: 보호 경로 변경이 없습니다.')
  process.exit(0)
}

const branch = process.env.GITHUB_HEAD_REF || run(git, ['branch', '--show-current'])
const pullRequestNumber = Number(process.env.PROTECTED_PR_NUMBER) || payload?.pull_request?.number
const pr = findPullRequest(pullRequestNumber, branch)
const headMatches = Boolean(pr?.headRefOid && pr.headRefOid === head)
const approved = pr && headMatches ? validApproval(pr, head, protectedChanges) : false

if (!pr || pr.state !== 'OPEN' || !headMatches || !approved) {
  console.error('Protected 실패: 사람의 명시적 범위와 현재 head에 대한 승인을 확인할 수 없습니다.')
  console.error(`- 기준: ${base}`)
  console.error(`- 대상: ${head}`)
  console.error(`- 변경 경로: ${protectedChanges.join(', ')}`)
  console.error('- 상태: NEEDS_HUMAN')
  console.error('- 사람의 GitHub PR 승인 리뷰에 Protected-Scope 범위와 사유를 기록한 뒤 다시 실행하세요.')
  process.exit(1)
}

console.log(`Protected 통과: GitHub PR #${pr.number}에서 사람의 승인 범위를 확인했습니다.`)
