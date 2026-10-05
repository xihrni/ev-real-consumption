# 09 · API 接口文档

> Base URL：`https://apc.llw2025.com/api`（同域部署，前端用相对路径 `/api`）
> 实现：[server/src/routes/](../server/src/routes/)、[server/src/middleware/auth.js](../server/src/middleware/auth.js)

---

## 1. 通用约定

### 1.1 鉴权

除注册/登录外，**所有接口都需要**在请求头携带：

```http
Authorization: Bearer <token>
```

token 由登录/注册返回，有效期 **30 天**。

未携带或 token 失效 → `401 { "error": "未授权" }`

> **token 存储位置**：前端 `localStorage`，键名 `ev_token_v1`。
> `api/client.ts` 有个易踩的细节：`authToken` 是**模块级变量**（首次加载时从 localStorage 读），所以手动改 localStorage 后必须**刷新页面**才会生效。

### 1.2 响应格式

成功 → `200` + JSON 对象
失败 → `4xx/5xx` + `{ "error": "错误信息" }`

所有错误信息均为**中文，可直接展示给用户**。

### 1.3 字段命名 ⚠️

| 层 | 风格 | 示例 |
|---|---|---|
| 数据库表 | 下划线 | `vehicle_id`、`created_at` |
| **API 收发** | **下划线** | 同上 |
| TypeScript 模型 | 驼峰 | `vehicleId`、`createdAt` |

`ChargeSession` 是**混合**的：来自用户输入的字段保持原样（`E`、`T`、`C`、`M`、`R_start`、`R_end`、`meter`、`ctype`、`note`），只有系统字段做了驼峰转换（`vehicleId`、`createdAt`）。

> 若要把生产数据拿来做本地 mock，必须自行把 `vehicle_id` 映射为 `vehicleId`，否则 store 拿到空数组。详见 [10-数据模型 §字段命名坑](10-数据模型.md)。

---

## 2. 接口总览（13 个）

| # | 方法 | 路径 | 鉴权 | 用途 |
|---|---|---|:---:|---|
| 1 | GET | `/healthz` | ❌ | 健康检查 |
| 2 | POST | `/api/auth/register` | ❌ | 注册 |
| 3 | POST | `/api/auth/login` | ❌ | 登录 |
| 4 | GET | `/api/me` | ✅ | 当前用户信息 |
| 5 | GET | `/api/vehicles` | ✅ | 车辆列表 |
| 6 | POST | `/api/vehicles` | ✅ | 新增车辆 |
| 7 | PUT | `/api/vehicles/:id` | ✅ | 更新车辆 |
| 8 | DELETE | `/api/vehicles/:id` | ✅ | 删除车辆 |
| 9 | GET | `/api/sessions` | ✅ | 记录列表 |
| 10 | POST | `/api/sessions` | ✅ | 新增记录 |
| 11 | PUT | `/api/sessions/:id` | ✅ | 更新记录 |
| 12 | DELETE | `/api/sessions/:id` | ✅ | 删除记录 |
| 13 | POST | `/api/seed-demo` · `/api/replace-all` · DELETE `/api/data` | ✅ | 数据管理 |

---

## 3. 健康检查

### `GET /healthz`

无鉴权。**注意这个接口在 `/api` 之外**（挂在根路径）。

**响应**

```json
{ "ok": true, "time": 1759612800000 }
```

---

## 4. 账号

### `POST /api/auth/register` · `POST /api/auth/login`

**请求体**（两者相同）

```json
{
  "email": "xihrni@126.com",
  "password": "至少6位密码"
}
```

**校验规则**（`server/src/validation.js`）

| 字段 | 规则 |
|---|---|
| `email` | 非空 + 正则 `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` |
| `password` | 长度 ≥ 6 |

**响应**

```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": { "id": "468c951d-...", "email": "xihrni@126.com" }
}
```

> ⚠️ **状态码不同**：`register` 返回 **`201`**，且 `user.email` 是 `email.trim()` 后的值；`login` 返回 **`200`**，email 取数据库原值。前端不区分这个差异，但用 curl 调试时要注意。

**错误**

| 状态码 | 错误信息 | 场景 |
|---|---|---|
| `400` | `邮箱格式或密码长度(≥6)不合法` | 注册/登录格式校验失败 |
| `409` | `该邮箱已注册` | 仅 register |
| `401` | `邮箱或密码错误` | 仅 login |

### `GET /api/me`

**响应**

```json
{ "user": { "id": "468c951d-...", "email": "xihrni@126.com" } }
```

**错误**：`401` token 无效，或 token 有效但用户已被删除。

> 前端启动时用这个接口校验 token 是否还有效。**返回 401 会触发清 token + 回登录页**。

---

## 5. 车辆

### `GET /api/vehicles`

**响应**

```json
{
  "vehicles": [
    {
      "id": "mrcwp8lwq6bqad",
      "model": "欧拉好猫21款波塞冬",
      "B": 59.1,
      "Pmax": 60,
      "M0": 64150,
      "R0": 264,
      "color": "#0fae8e",
      "createdAt": 1783565252,
      "updatedAt": 1783565252
    }
  ]
}
```

> 只返回**当前用户**的车辆（后端按 `req.userId` 过滤）。

### `POST /api/vehicles`

**请求体**

```json
{
  "model": "欧拉好猫21款波塞冬",
  "B": 59.1,
  "Pmax": 60,
  "M0": 64150,
  "R0": 264
}
```

**校验**（`server/src/validation.js` + 数据库 CHECK 约束双重保障）

| 字段 | 规则 | 违反时 |
|---|---|---|
| `model` | 非空字符串 | `400` |
| `B` | 有限正数 | `400` / DB `CHECK (B > 0)` |
| `Pmax` | 有限正数 | `400` / DB `CHECK (Pmax > 0)` |
| `M0` | ≥ 0 | `400` / DB `CHECK (M0 >= 0)` |
| `R0` | ≥ 0 | `400` / DB `CHECK (R0 >= 0)` |

**响应**：`200` + `{ "vehicle": {...} }`

### `PUT /api/vehicles/:id`

**请求体**：同 POST，但为**部分更新**——未传的字段自动沿用旧值。

```js
// 后端实现逻辑
const model = b.model ?? cur.model
const B     = b.B    != null ? Number(b.B)    : cur.B
const color = b.color !== undefined ? b.color : cur.color
// 注意 color 用 !== undefined 判断，因此显式传 null 可以清空
```

> 💡 `color` 字段的判断方式与其他字段不同：其他字段用 `!= null`（**传 null 会沿用旧值**），只有 `color` 用 `!== undefined`（**传 null 可清空**）。

**响应**：`200` + `{ "vehicle": {...} }`

**错误**：`400` 校验失败（`车辆参数不合法`）/ `404` 车辆不存在或不属于当前用户

> ⚠️ 删除车辆会**级联删除其所有充电记录**（`ON DELETE CASCADE`）。前端删除前需二次确认。

### `DELETE /api/vehicles/:id`

**响应**：`200` + `{ "ok": true }`

> ⚠️ **不可恢复**，会连带删除该车全部记录。UI 已加确认弹窗并提示记录数量。

---

## 6. 充电记录

### `GET /api/sessions`

**Query 参数**

| 参数 | 类型 | 说明 |
|---|---|---|
| `vehicleId` | string | 可选，按车辆过滤 |

**响应**

```json
{
  "sessions": [
    {
      "id": "mrcwqqek1jtoze",
      "vehicleId": "mrcwp8lwq6bqad",
      "ts": "2026-07-09T09:25",
      "E": 31.16,
      "T": 0.83,
      "C": 30.83,
      "M": 64208,
      "R_start": 180,
      "R_end": 446,
      "meter": "grid",
      "ctype": "fast",
      "note": null,
      "createdAt": 1783565322,
      "updatedAt": 1783565385
    }
  ]
}
```

### 字段说明

| 字段 | 类型 | 必填 | 约束 / 取值 | 含义 |
|---|---|:---:|---|---|
| `ts` | string | ✅ | `datetime-local` 格式 | 充电时间 |
| `E` | number | ✅ | `CHECK (E >= 0)` | 充电度数 kWh |
| `T` | number | ✅ | `CHECK (T >= 0)` | 充电时长 h |
| `C` | number | ✅ | `CHECK (C >= 0)` | 金额 ¥ |
| `M` | number \| null | ❌ | | 本次充电时的里程 km |
| `R_start` | number \| null | ❌ | | 充电时起始车显剩余 km |
| `R_end` | number \| null | ❌ | | 充电结束车显剩余 km |
| `meter` | string \| null | ❌ | `'battery'` \| `'grid'` | 度数口径：电池端 / 电网端 |
| `ctype` | string \| null | ❌ | `'home'` \| `'fast'` \| `'other'` | 家充 / 超充 / 其他 |
| `note` | string \| null | ❌ | | 备注 |

> **两阶段录入的实现**：`M` / `R_start` / `R_end` 三项在 DB 中**可空**。缺任一项时该记录被标记为 `pending`，不参与累计。补全后自动重算。

### `POST /api/sessions`

**请求体**：上表必填字段 + 可选 `vehicleId`（不传则归到当前车辆）

**响应**：`201` + `{ "session": {...} }`

**错误**

| 状态码 | 错误信息 | 条件 |
|---|---|---|
| `400` | `缺少 vehicleId` | 未指定归属车辆 |
| `404` | `车辆不存在或无权访问` | 车辆不属于当前用户 |
| `400` | `记录参数不合法（ts 必填；E/T/C≥0）` | 基础字段校验失败 |
| `400` | `meter 取值不合法` | 不是 `battery`/`grid` |
| `400` | `ctype 取值不合法` | 不是 `home`/`fast`/`other` |
| `409` | `该记录 id 已存在` | 客户端重复提交同一 id |

**仅警告不阻断的情况**（返回 201，但记录会被标记）：

| 条件 | 后果 |
|---|---|
| 里程 `M` ≤ 上一条的 `M` | 前端校验拦截；API 层不拦，靠 store 侧校验 |
| `R_end` ≤ `R_start` | 前端校验拦截 |
| `R_end − R_start < 5` | 放行，但提示「车显变化过小，测算误差可能较大」 |

### `PUT /api/sessions/:id`

**请求体**：需要更新的字段（部分更新）

**响应**：`200` + `{ "session": {...} }`

**注意**：更新记录后**前端会全量重算所有段**。因为 `dRdep` 依赖上一条的 `R_end`，改早期记录会影响后续所有段。

### `DELETE /api/sessions/:id`

**响应**：`200` + `{ "ok": true }`

删除后同样触发全量重算。

---

## 7. 数据管理

> ⚠️ **三个接口都是破坏性操作**，会覆盖账号下的全部数据。
> UI 已加橙色警示条 + 二次确认（确认框显示当前实际条数）。

### `POST /api/seed-demo`

载入示例数据（2 辆车 + 若干记录），**会替换现有全部数据**。

**请求体**：无

**响应**

```json
{ "vehicles": [...], "sessions": [...] }
```

### `POST /api/replace-all`

整库替换，用于「导入 JSON」。

**请求体**

```json
{
  "vehicles": [
    { "id": "...", "model": "...", "B": 59.1, "Pmax": 60, "M0": 0, "R0": 0 }
  ],
  "sessions": [
    { "id": "...", "vehicleId": "...", "ts": "...", "E": 30, "T": 1, "C": 25,
      "M": 100, "R_start": 20, "R_end": 200, "meter": "grid", "ctype": "home" }
  ]
}
```

**兼容两种旧格式**（见 `src/api/data.ts`）：

| 格式 | 识别方式 |
|---|---|
| 新版 | `vehicles` 数组存在 |
| 旧版 v1 | 只有 `vehicle` 单对象（无 `vehicles`） |

**保留客户端 id**：导入时沿用备份文件中的 `id`，不重新生成，保证与其它记录的关联不丢。

**响应**：`201` + `{ "vehicles": [...], "sessions": [...] }`（替换后的完整数据）

**错误**

| 状态码 | 错误信息 | 条件 |
|---|---|---|
| `400` | `车辆数据不合法` | `vehicles` 为空或字段非法 |
| `400` | `记录数据不合法` | `sessions` 字段非法 |
| `400` | `meter 取值不合法` | 枚举越界 |
| `400` | `ctype 取值不合法` | 枚举越界 |
| `400` | `记录缺少归属车辆` | `vehicleId` 指向不存在的车 |
| `400` | `导入失败：xxx` | 数据库约束冲突（多在 `id` 重复时） |

### `DELETE /api/data`

清空当前账号下**全部车辆与记录**。

**响应**：`200` + `{ "ok": true }`

> ⚠️ 不删账号本身，登录态保留。删完是空库状态。

---

## 8. 前端调用示例

### 统一客户端

```ts
// src/api/client.ts
async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers)
  headers.set('Content-Type', 'application/json')
  if (authToken) headers.set('Authorization', `Bearer ${authToken}`)

  const res = await fetch(`/api${path}`, { ...options, headers })
  const text = await res.text()
  let data = null
  if (text) {
    try { data = JSON.parse(text) } catch { data = text }
  }
  if (!res.ok) {
    const msg = data && typeof data === 'object' && 'error' in data
      ? String(data.error)
      : `请求失败 (${res.status})`
    throw new ApiError(res.status, msg)
  }
  return data as T
}
```

**要点**：
- 路径统一拼 `/api` 前缀
- token 自动注入，业务代码不用关心
- 非 2xx 统一抛 `ApiError`，`message` 可直接展示给用户
- 响应先 `text()` 再 `JSON.parse()`，容忍空响应体

### 登录后写入 localStorage

```ts
// src/store/useAppStore.ts
const { token, user } = await loginApi(email, password)
setToken(token)              // 同时写 localStorage['ev_token_v1']
this.userId = user.id
this.userEmail = user.email
await this.reloadData()
```

> ⚠️ `setToken()` 同时更新模块级变量和 localStorage，**直接写 localStorage 不会更新 `authToken`**，必须刷新页面。

---

## 9. 用 curl 调试

```bash
BASE=https://apc.llw2025.com/api

# 健康检查（注意在 /api 之外）
curl -s https://apc.llw2025.com/healthz

# 登录取 token
TOKEN=$(curl -s -X POST $BASE/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"xihrni@126.com","password":"******"}' \
  | sed -E 's/.*"token":"([^"]+)".*/\1/')

# 拉数据
curl -s $BASE/vehicles  -H "Authorization: Bearer $TOKEN"
curl -s $BASE/sessions  -H "Authorization: Bearer $TOKEN"
curl -s $BASE/me        -H "Authorization: Bearer $TOKEN"

# 验证 token 失效表现
curl -s -o /dev/null -w "%{http_code}\n" $BASE/me -H "Authorization: Bearer invalid"
```

---

## 10. 相关文档

- [10-数据模型](10-数据模型.md) — 表结构与字段约束来源
- [12-前端架构说明](12-前端架构说明.md) — `api/*.ts` 与 store 的协作
- [13-开发规范](13-开发规范.md) — 新增接口的约定
