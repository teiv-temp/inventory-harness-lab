import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import ts from 'typescript'

const root = process.cwd()
const sourceRoot = path.join(root, 'src')
const allowedFile = normalize(path.join(sourceRoot, 'lib', 'stock.ts'))
const mutations = new Set(['create', 'createMany', 'update', 'updateMany', 'upsert', 'delete', 'deleteMany'])

type Violation = { file: string; line: number; column: number; model: string; method: string }

function normalize(file: string) {
  return path.normalize(file).replaceAll('\\', '/').toLowerCase()
}

function filesIn(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const file = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === 'generated') return []
      return filesIn(file)
    }
    if (!entry.isFile() || !/\.(ts|tsx)$/.test(entry.name) || /\.(test|spec)\.(ts|tsx)$/.test(entry.name)) {
      return []
    }
    return [file]
  })
}

function literalName(node: ts.Expression): string | null {
  if (ts.isIdentifier(node)) return node.text
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text
  return null
}

const violations: Violation[] = []

for (const file of filesIn(sourceRoot)) {
  const source = readFileSync(file, 'utf8')
  const ast = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true)
  if (normalize(file) === allowedFile) continue

  function visit(node: ts.Node) {
    if (ts.isCallExpression(node)) {
      const callee = node.expression
      if (ts.isPropertyAccessExpression(callee)) {
        const model = literalName(callee.expression)
        const method = callee.name.text
        if (model && (model === 'lot' || model === 'movement') && mutations.has(method)) {
          const position = ast.getLineAndCharacterOfPosition(callee.getStart(ast))
          violations.push({
            file: path.relative(root, file).replaceAll('\\', '/'),
            line: position.line + 1,
            column: position.character + 1,
            model,
            method,
          })
        }
      }
    }
    ts.forEachChild(node, visit)
  }

  visit(ast)
}

if (violations.length > 0) {
  console.error(`Architecture Check 실패: ${violations.length}건`)
  for (const violation of violations) {
    console.error(
      `- ${violation.file}:${violation.line}:${violation.column} ` +
        `직접 ${violation.model} 변경(${violation.method})은 금지됩니다. ` +
        '`src/lib/stock.ts`의 applyMovement()를 사용하세요.',
    )
  }
  process.exit(1)
}

console.log('Architecture Check 통과: 재고 변경은 src/lib/stock.ts를 통해야 합니다.')
