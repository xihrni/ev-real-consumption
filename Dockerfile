# === 阶段1：前端构建（Vue3 + Vite，镜像内自动构建，无需本机先 build） ===
FROM node:20-slim AS frontend
WORKDIR /build
RUN npm config set registry https://registry.npmmirror.com
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npm run build

# === 阶段2：后端依赖（better-sqlite3 原生模块，强制源码编译） ===
FROM node:20-slim AS backend-deps
WORKDIR /app
RUN npm config set registry https://registry.npmmirror.com
RUN sed -i 's|deb.debian.org|mirrors.ustc.edu.cn|g; s|security.debian.org|mirrors.ustc.edu.cn|g' /etc/apt/sources.list /etc/apt/sources.list.d/*.sources 2>/dev/null || true
RUN apt-get update \
 && apt-get install -y --no-install-recommends python3 make g++ build-essential \
 && rm -rf /var/lib/apt/lists/*
ENV npm_config_build_from_source=true
COPY server/package.json server/package-lock.json* ./server/
RUN cd server && npm install --omit=dev

# === 阶段3：运行 ===
FROM node:20-slim
ENV NODE_ENV=production \
    PORT=3000 \
    DB_PATH=/data/ev.sqlite \
    CORS_ORIGIN=
WORKDIR /app
COPY --from=backend-deps /app/server/node_modules ./server/node_modules
COPY server/src ./server/src
COPY --from=frontend /build/dist ./dist
VOLUME ["/data"]
EXPOSE 3000
WORKDIR /app/server
CMD ["node", "src/index.js"]
