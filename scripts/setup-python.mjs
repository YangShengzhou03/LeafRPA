// 下载独立的 Python 发行版到 python-runtime/，用于打包进发布版。
// 用法: node scripts/setup-python.mjs [版本]
import { createWriteStream, existsSync, mkdirSync, rmSync } from 'node:fs'
import { get } from 'node:https'
import { pipeline } from 'node:stream/promises'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const PLATFORM = process.platform
const ARCH = process.arch
const VERSION = process.argv[2] ?? '3.11.10'
const TAG = '20241016'
const TARGET = resolve(process.cwd(), 'python-runtime')

function assetName() {
  const v = `${VERSION}+${TAG}`
  if (PLATFORM === 'win32' && ARCH === 'x64')
    return `cpython-${v}-x86_64-pc-windows-msvc-install_only.tar.gz`
  if (PLATFORM === 'darwin' && ARCH === 'arm64')
    return `cpython-${v}-aarch64-apple-darwin-install_only.tar.gz`
  if (PLATFORM === 'darwin' && ARCH === 'x64')
    return `cpython-${v}-x86_64-apple-darwin-install_only.tar.gz`
  if (PLATFORM === 'linux' && ARCH === 'x64')
    return `cpython-${v}-x86_64-unknown-linux-gnu-install_only.tar.gz`
  throw new Error(`不支持的平台: ${PLATFORM} ${ARCH}`)
}

function download(url, dest) {
  return new Promise((resolve, reject) => {
    console.log(`下载 ${url}`)
    get(url, (res) => {
      if (res.statusCode === 302 || res.statusCode === 301) {
        download(res.headers.location, dest).then(resolve, reject)
        return
      }
      if (res.statusCode !== 200) {
        reject(new Error(`下载失败: HTTP ${res.statusCode}`))
        return
      }
      pipeline(res, createWriteStream(dest)).then(resolve, reject)
    }).on('error', reject)
  })
}

async function main() {
  const name = assetName()
  const sources = [
    `https://github.com/astral-sh/python-build-standalone/releases/download/${TAG}/${name}`,
    `https://registry.npmmirror.com/-/binary/python-build-standalone/${TAG}/${name}`,
  ]
  const tmp = join(tmpdir(), name)

  let lastError
  for (const url of sources) {
    try {
      await download(url, tmp)
      lastError = null
      break
    } catch (e) {
      lastError = e
      console.warn(`源不可用: ${url}（${e.message}）`)
    }
  }
  if (lastError) throw lastError

  console.log(`解压到 ${TARGET}`)
  rmSync(TARGET, { recursive: true, force: true })
  mkdirSync(TARGET, { recursive: true })

  if (name.endsWith('.tar.gz')) {
    // --force-local 防止 Windows 下 tar 把 C: 误判为远程主机
    execFileSync('tar', ['--force-local', '-xzf', tmp, '-C', TARGET, '--strip-components=1'])
  } else {
    throw new Error(`不支持的压缩格式: ${name}`)
  }

  const exe = PLATFORM === 'win32' ? join(TARGET, 'python.exe') : join(TARGET, 'bin', 'python3')
  if (!existsSync(exe)) throw new Error(`解压后未找到解释器: ${exe}`)
  console.log(`完成: ${exe}`)
}

main().catch((e) => {
  console.error(e.message)
  process.exit(1)
})
