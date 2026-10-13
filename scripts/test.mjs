/**
 * vitest 启动包装器。
 *
 * 存在原因：vitest 会在 os.tmpdir() 下用 mkdtemp 创建 SSR 模块缓存目录。
 * 某些受控环境（如 WorkBuddy 桌面端的 node-brokered-fs-shim）会拦截对系统
 * 临时目录的写入，报 EPERM，且会让测试统计失真（表现为"少跑了一个文件、
 * 用例数变少"）。在 vitest.config.ts 里改 process.env 不够 —— worker 是
 * 子进程，拿不到主进程后改的 env。必须在这里、启动 vitest 之前设好。
 *
 * 用法：
 *   npm test              # 跑一遍
 *   npm run test:watch    # watch 模式
 */

import { mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const tmp = join(root, 'node_modules', '.vitest', 'tmp')

try {
  mkdirSync(tmp, { recursive: true })
  process.env.TMP = tmp
  process.env.TEMP = tmp
  // 某些 Node 版本在 Windows 上优先读 TMPDIR
  process.env.TMPDIR = tmp
} catch {
  /* 建目录失败就保持原样，不影响测试本身 */
}

const isWatch = process.argv.includes('--watch') || process.argv.includes('-w')

// 注意：第二个参数是「测试文件过滤器」，不是 CLI 参数。
// 传 'run' 进去会被当成文件名，导致 "No test files found"。
const { startVitest } = await import('vitest/node')
const vitest = await startVitest('test', [], { run: !isWatch })

await vitest?.close()
