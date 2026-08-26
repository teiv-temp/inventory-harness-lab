import { execFileSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'

const npmRunner = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const npxRunner = process.platform === 'win32' ? 'npx.cmd' : 'npx'
function databaseUrl(directory: string): string {
  return `file:${path.join(directory, 'verify.db').replaceAll('\\', '/')}`
}

function run(command: string, args: string[], env: NodeJS.ProcessEnv) {
  console.log(`\n▸ ${command} ${args.join(' ')}`)
  execFileSync(command, args, { stdio: 'inherit', env, shell: process.platform === 'win32' })
}

function prepare(directory: string, env: NodeJS.ProcessEnv) {
  mkdirSync(directory, { recursive: true })
  const url = databaseUrl(directory)
  const preparedEnv = { ...env, DATABASE_URL: url }
  console.log(`\n[verify:prepare] 격리 DB 준비: ${url}`)
  run(npxRunner, ['prisma', 'migrate', 'deploy'], preparedEnv)
  run(npxRunner, ['prisma', 'generate'], preparedEnv)
  run(npxRunner, ['tsx', 'prisma/seed.ts'], preparedEnv)
  return preparedEnv
}

const root = mkdtempSync(path.join(tmpdir(), 'inventory-verify-'))
const testDirectory = path.join(root, 'test')
const buildDirectory = path.join(root, 'build')
const baseEnv = { ...process.env }

try {
  const testEnv = prepare(testDirectory, baseEnv)

  run(npmRunner, ['exec', 'tsc', '--', '--noEmit'], testEnv)
  run(npmRunner, ['run', 'lint'], testEnv)
  run(npmRunner, ['run', 'architecture-check'], testEnv)
  run(npmRunner, ['test'], testEnv)

  const buildEnv = prepare(buildDirectory, baseEnv)
  run(npmRunner, ['run', 'build'], buildEnv)

  console.log('\n✓ 검증 완료: Types → Lint → Test → Build')
} finally {
  rmSync(root, { recursive: true, force: true })
}
