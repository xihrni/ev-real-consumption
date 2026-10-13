import { defineConfig } from 'vitest/config'

export default defineConfig({
  // vite 的模块缓存目录，指到项目内（node_modules 已被 gitignore）
  cacheDir: './node_modules/.vitest/vite',
  test: {
    // 只跑纯函数测试（calc / format），不涉及 DOM 与浏览器
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // 用 forks 而非默认的 threads：worker_threads 在创建时就固定了 tmpdir，
    // 之后改 process.env.TMP 不可靠，会随机出现 EPERM 并让用例统计失真
    // （表现为"少跑一个文件、用例数变少"）。forks 是子进程，启动时读 env，稳定。
    // 单实例进一步减少并发写缓存的竞态，测试量小时也更快。
    pool: 'forks',
    poolOptions: {
      forks: { singleFork: true }
    }
  }
})
