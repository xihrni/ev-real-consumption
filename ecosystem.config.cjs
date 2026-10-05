// PM2 启动配置（宝塔「PM2管理器」或命令行 `pm2 start ecosystem.config.cjs` 均可使用）
// 注意：better-sqlite3 是单进程文件数据库，必须使用 fork 模式（单实例），
// 切勿使用 cluster 多实例，否则多进程同时写库会出错。
module.exports = {
  apps: [
    {
      name: 'ev-app',
      cwd: './server',
      script: 'src/index.js',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      max_memory_restart: '512M',
      log_date_format: 'YYYY-MM-DD HH:mm:ss',
      env: {
        NODE_ENV: 'production',
        PORT: 3000
      }
    }
  ]
}
