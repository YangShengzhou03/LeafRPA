/**
 * 全库 emoji 校验：扫描工作区文件与暂存/提交文本中的 emoji 表情符号。
 *
 * 用法：
 *   node scripts/check-emoji.mjs            # 扫描工作区全部受控文件
 *   node scripts/check-emoji.mjs --staged   # 扫描暂存区内容（供 pre-commit 使用）
 *   node scripts/check-emoji.mjs --log      # 扫描全部历史提交信息
 *
 * 说明：箭头（→ ▶ ▼）、对勾替代符（√）等排版/制图符号不在拦截范围，
 * 仅拦截 Unicode emoji 区段（含变体选择符 FE0F、区域旗帜）。
 */
import { execSync } from 'node:child_process'
import { readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

/** emoji 与 emoji 化符号的统一拦截区间（不含箭头、制图符号等排版字符） */
const EMOJI_RE =
  /[\u{1F000}-\u{1FAFF}\u{1F1E6}-\u{1F1FF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}]/u

/** 仅扫描文本类文件，跳过二进制与依赖产物 */
const TEXT_EXT = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.vue', '.rs', '.py',
  '.md', '.json', '.toml', '.yml', '.yaml', '.html', '.css', '.scss',
  '.sql', '.ps1', '.bat', '.sh', '.txt', '.xml', '.conf', '.ini', '.reg',
])
const SKIP_DIRS = new Set([
  'node_modules', 'dist', 'target', '.git', '.runtime', 'data',
  'python-runtime', '.venv', '__pycache__',
])

const root = process.cwd()

function listFiles(dir, out = []) {
  for (const name of execSync(`git ls-files "${dir.replace(/\\/g, '/')}"`, { cwd: root, encoding: 'utf8' }).split('\n')) {
    const file = name.trim()
    if (!file) continue
    const ext = file.slice(file.lastIndexOf('.'))
    if (TEXT_EXT.has(ext)) out.push(file)
  }
  return out
}

function scanText(source, label, hits) {
  const lines = source.split('\n')
  lines.forEach((line, i) => {
    if (EMOJI_RE.test(line)) hits.push(`${label}:${i + 1}: ${line.trim().slice(0, 120)}`)
  })
}

function scanStaged(hits) {
  // 名称 + 内容两层：git diff --cached 拿到的正文即暂存内容
  const diff = execSync('git diff --cached --unified=0', { cwd: root, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  let file = ''
  for (const line of diff.split('\n')) {
    if (line.startsWith('+++ b/')) file = line.slice(6)
    else if (line.startsWith('+') && !line.startsWith('+++')) scanText(line.slice(1), file, hits)
  }
}

function scanLog(hits) {
  const log = execSync('git log --format="%h %s"', { cwd: root, encoding: 'utf8' })
  for (const line of log.split('\n')) {
    if (EMOJI_RE.test(line)) hits.push(`commit: ${line}`)
  }
}

const hits = []
const mode = process.argv[2] ?? ''
if (mode === '--staged') {
  scanStaged(hits)
} else if (mode === '--log') {
  scanLog(hits)
} else {
  for (const file of listFiles('.')) {
    try {
      if (!statSync(join(root, file)).isFile()) continue
    } catch {
      continue
    }
    scanText(readFileSync(join(root, file), 'utf8'), file, hits)
  }
}

if (hits.length > 0) {
  console.error(`发现 ${hits.length} 处 emoji，禁止提交：`)
  console.error(hits.slice(0, 50).join('\n'))
  process.exit(1)
}
console.log(mode === '--staged' ? 'emoji 校验通过' : 'emoji 校验通过：全库无 emoji')
