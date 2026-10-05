import { defineStore } from 'pinia'
import type { Vehicle, ChargeSession } from '../types'
import { computeAll, segSummary } from '../utils/calc'
import { uid } from '../utils/format'
import { toast } from '../utils/toast'
import { ApiError, getToken, setToken } from '../api/client'
import {
  register as registerApi,
  login as loginApi,
  logout as logoutApi,
  me as meApi
} from '../api/auth'
import { getVehicles, createVehicle, updateVehicle, deleteVehicle as deleteVehicleApi } from '../api/vehicles'
import {
  getSessions,
  createSession,
  updateSession as updateSessionApi,
  deleteSession as deleteSessionApi
} from '../api/sessions'
import { seedDemo, replaceAll, deleteAll as deleteAllApi } from '../api/data'

const CUR_KEY = 'ev_current_vehicle_v1'
const PALETTE = ['#0fae8e', '#6366f1', '#f59e0b', '#e5484d', '#0ea5e9', '#a855f7', '#ec4899', '#14b8a6']

interface AppState {
  vehicles: Vehicle[]
  currentVehicleId: string | null
  allSessions: ChargeSession[]
  loaded: boolean
  // 鉴权态
  userId: string | null
  userEmail: string | null
  authed: boolean
  authReady: boolean
  /** 登录/注册失败原因（供登录页内联展示，避免失败无反馈） */
  authError: string | null
}

export type VehiclePayload = {
  model: string
  B: number | null
  Pmax: number | null
  M0: number | null
  R0: number | null
}

// 后端返回的是「秒」时间戳（strftime('%s')），前端模型统一用「毫秒」
function toMs(v: number | null | undefined): number | null | undefined {
  if (v == null) return v
  return v < 1e12 ? v * 1000 : v
}
function normVehicle(v: Vehicle): Vehicle {
  return { ...v, createdAt: toMs(v.createdAt) ?? v.createdAt, updatedAt: toMs(v.updatedAt) ?? v.updatedAt }
}
function normSession(s: ChargeSession): ChargeSession {
  return { ...s, createdAt: toMs(s.createdAt) ?? s.createdAt, updatedAt: toMs(s.updatedAt) ?? s.updatedAt }
}

function readCur(): string | null {
  try {
    return localStorage.getItem(CUR_KEY)
  } catch {
    return null
  }
}

function errMsg(e: unknown): string {
  return (e as ApiError)?.message || '操作失败，请稍后重试'
}

export const useAppStore = defineStore('app', {
  state: (): AppState => ({
    vehicles: [],
    currentVehicleId: null,
    allSessions: [],
    loaded: false,
    userId: null,
    userEmail: null,
    authed: false,
    authReady: false,
    authError: null
  }),

  getters: {
    /** 当前选中的车辆 */
    vehicle(state): Vehicle | null {
      return state.vehicles.find((v) => v.id === state.currentVehicleId) ?? null
    },
    /** 当前车辆的充电记录（按当前车辆过滤） */
    sessions(state): ChargeSession[] {
      if (!state.currentVehicleId) return []
      return state.allSessions.filter((s) => s.vehicleId === state.currentVehicleId)
    },
    /** 全量测算结果（基于当前车辆） */
    computed(state) {
      const v = state.vehicles.find((x) => x.id === state.currentVehicleId) ?? null
      const sess = state.currentVehicleId
        ? state.allSessions.filter((s) => s.vehicleId === state.currentVehicleId)
        : []
      return computeAll(v, sess)
    },
    summary(): ReturnType<typeof segSummary> {
      return segSummary(this.computed.segs)
    },
    /** 当前车辆按时间升序的会话 */
    sortedSessions(state): ChargeSession[] {
      const sess = state.currentVehicleId
        ? state.allSessions.filter((s) => s.vehicleId === state.currentVehicleId)
        : []
      return [...sess].sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime())
    }
  },

  actions: {
    async init() {
      this.authReady = false
      if (!getToken()) {
        this.authed = false
        this.authReady = true
        this.loaded = true
        return
      }
      try {
        const meRes = await meApi()
        this.userId = meRes.user.id
        this.userEmail = meRes.user.email
        this.authed = true
        await this.reloadData()
      } catch (e) {
        // token 失效：清理并重试登录
        setToken(null)
        this.authed = false
        this.userId = null
        this.userEmail = null
      }
      this.authReady = true
      this.loaded = true
    },

    async reloadData() {
      const [vehicles, sessions] = await Promise.all([getVehicles(), getSessions()])
      this.vehicles = vehicles.map(normVehicle)
      this.allSessions = sessions.map(normSession)
      const saved = readCur()
      this.currentVehicleId =
        saved && vehicles.some((v) => v.id === saved) ? saved : vehicles[0]?.id ?? null
      await this.persistCurrent()
    },

    async persistCurrent() {
      try {
        if (this.currentVehicleId) localStorage.setItem(CUR_KEY, this.currentVehicleId)
        else localStorage.removeItem(CUR_KEY)
      } catch {
        /* 忽略存储不可用 */
      }
    },

    // ===== 鉴权 =====
    async login(email: string, password: string) {
      this.authError = null
      try {
        const r = await loginApi(email.trim(), password)
        this.userId = r.user.id
        this.userEmail = r.user.email
        this.authed = true
        await this.reloadData()
        return true
      } catch (e) {
        const msg = errMsg(e)
        this.authError = msg
        toast(msg, 'error')
        return false
      }
    },

    async register(email: string, password: string) {
      this.authError = null
      try {
        const r = await registerApi(email.trim(), password)
        this.userId = r.user.id
        this.userEmail = r.user.email
        this.authed = true
        await this.reloadData()
        return true
      } catch (e) {
        const msg = errMsg(e)
        this.authError = msg
        toast(msg, 'error')
        return false
      }
    },

    clearAuthError() {
      this.authError = null
    },

    logout() {
      logoutApi()
      this.authed = false
      this.userId = null
      this.userEmail = null
      this.vehicles = []
      this.allSessions = []
      this.currentVehicleId = null
    },

    /** 保存「当前车辆」配置：若已选车辆则更新，否则新建并切换 */
    async saveCurrentVehicle(payload: VehiclePayload) {
      if (payload.B == null || payload.Pmax == null || payload.M0 == null || payload.R0 == null) {
        toast('请填写完整的车辆数值', 'error')
        return false
      }
      const model = payload.model.trim() || '我的车辆'
      try {
        if (this.vehicle) {
          const updated = await updateVehicle(this.vehicle.id, {
            model,
            B: payload.B,
            Pmax: payload.Pmax,
            M0: payload.M0,
            R0: payload.R0
          })
          const i = this.vehicles.findIndex((x) => x.id === updated.id)
          if (i >= 0) this.vehicles[i] = normVehicle(updated)
          toast('车辆配置已保存', 'success')
        } else {
          const v: Vehicle = {
            id: uid(),
            model,
            B: payload.B,
            Pmax: payload.Pmax,
            M0: payload.M0,
            R0: payload.R0,
            color: PALETTE[this.vehicles.length % PALETTE.length],
            createdAt: Date.now(),
            updatedAt: Date.now()
          }
          const created = await createVehicle(v)
          this.vehicles.push(normVehicle(created))
          this.currentVehicleId = created.id
          await this.persistCurrent()
          toast('已添加车辆', 'success')
        }
        return true
      } catch (e) {
        toast(errMsg(e), 'error')
        return false
      }
    },

    /** 新增一辆车并切换为当前 */
    async addVehicle(payload: VehiclePayload) {
      if (payload.B == null || payload.Pmax == null || payload.M0 == null || payload.R0 == null) {
        toast('请填写完整的车辆数值', 'error')
        return null
      }
      const v: Vehicle = {
        id: uid(),
        model: payload.model.trim() || '我的车辆',
        B: payload.B,
        Pmax: payload.Pmax,
        M0: payload.M0,
        R0: payload.R0,
        color: PALETTE[this.vehicles.length % PALETTE.length],
        createdAt: Date.now(),
        updatedAt: Date.now()
      }
      try {
        const created = await createVehicle(v)
        this.vehicles.push(normVehicle(created))
        this.currentVehicleId = created.id
        await this.persistCurrent()
        toast('已添加车辆', 'success')
        return created.id
      } catch (e) {
        toast(errMsg(e), 'error')
        return null
      }
    },

    async switchVehicle(id: string) {
      if (!this.vehicles.some((v) => v.id === id)) return
      this.currentVehicleId = id
      await this.persistCurrent()
    },

    /** 按 id 更新任意车辆（车辆管理列表内的编辑，不限于当前车辆） */
    async updateVehicleById(id: string, payload: VehiclePayload) {
      if (payload.B == null || payload.Pmax == null || payload.M0 == null || payload.R0 == null) {
        toast('请填写完整的车辆数值', 'error')
        return false
      }
      const body = {
        model: payload.model.trim() || '我的车辆',
        B: payload.B,
        Pmax: payload.Pmax,
        M0: payload.M0,
        R0: payload.R0
      }
      try {
        const updated = await updateVehicle(id, body)
        const i = this.vehicles.findIndex((x) => x.id === id)
        if (i >= 0) this.vehicles[i] = normVehicle(updated)
        toast('车辆已更新', 'success')
        return true
      } catch (e) {
        toast(errMsg(e), 'error')
        return false
      }
    },

    async deleteVehicle(id: string) {
      if (!confirm('删除该车辆及其全部充电记录？此操作不可恢复。')) return
      this.vehicles = this.vehicles.filter((v) => v.id !== id)
      this.allSessions = this.allSessions.filter((s) => s.vehicleId !== id)
      try {
        await deleteVehicleApi(id)
      } catch (e) {
        toast(errMsg(e), 'error')
        return
      }
      if (this.currentVehicleId === id) {
        this.currentVehicleId = this.vehicles[0]?.id ?? null
        await this.persistCurrent()
      }
      toast('已删除车辆及其记录', 'success')
    },

    async addSession(payload: {
      ts: string
      E: number | null
      T: number | null
      C: number | null
      meter?: 'battery' | 'grid' | null
      ctype?: 'home' | 'fast' | 'other' | null
      note?: string | null
    }) {
      if (!this.vehicle) {
        toast('请先在「车辆管理」中添加并选择一辆车', 'error')
        return false
      }
      if (payload.E == null || payload.T == null || payload.C == null) {
        toast('请填写度数 / 时长 / 金额', 'error')
        return false
      }
      const now = Date.now()
      const s: ChargeSession = {
        id: uid(),
        vehicleId: this.currentVehicleId!,
        ts: payload.ts,
        E: payload.E,
        T: payload.T,
        C: payload.C,
        M: null,
        R_start: null,
        R_end: null,
        meter: payload.meter ?? 'battery',
        ctype: payload.ctype ?? 'home',
        note: payload.note?.trim() || null,
        createdAt: now,
        updatedAt: now
      }
      try {
        const created = await createSession(s)
        this.allSessions.push(normSession(created))
        toast('已保存（待补全，可稍后补全里程）', 'success')
        return true
      } catch (e) {
        toast(errMsg(e), 'error')
        return false
      }
    },

    async updateSession(id: string, patch: Partial<ChargeSession>) {
      const s = this.allSessions.find((x) => x.id === id)
      if (!s) return false
      try {
        const updated = await updateSessionApi(id, patch)
        const i = this.allSessions.findIndex((x) => x.id === id)
        if (i >= 0) this.allSessions[i] = normSession(updated)
        toast('已更新并重新测算', 'success')
        return true
      } catch (e) {
        toast(errMsg(e), 'error')
        return false
      }
    },

    async deleteSession(id: string) {
      this.allSessions = this.allSessions.filter((x) => x.id !== id)
      try {
        await deleteSessionApi(id)
      } catch (e) {
        toast(errMsg(e), 'error')
      }
    },

    async loadDemo() {
      try {
        const { vehicles, sessions } = await seedDemo()
        this.vehicles = vehicles.map(normVehicle)
        this.allSessions = sessions.map(normSession)
        this.currentVehicleId = this.vehicles[0]?.id ?? null
        await this.persistCurrent()
        toast('已载入示例数据（含 2 辆车）', 'success')
      } catch (e) {
        toast(errMsg(e), 'error')
      }
    },

    async clearAll() {
      this.vehicles = []
      this.allSessions = []
      this.currentVehicleId = null
      try {
        await deleteAllApi()
      } catch (e) {
        toast(errMsg(e), 'error')
        return
      }
      try {
        localStorage.removeItem(CUR_KEY)
      } catch {
        /* ignore */
      }
      toast('已清空', 'success')
    },

    async importData(data: {
      vehicles?: Vehicle[]
      vehicle?: Vehicle | null
      sessions?: ChargeSession[]
    }) {
      const vehicles = Array.isArray(data.vehicles)
        ? data.vehicles
        : data.vehicle
          ? [data.vehicle]
          : []
      if (!vehicles.length) {
        toast('备份文件中未找到车辆数据', 'error')
        return
      }
      const sessions = Array.isArray(data.sessions) ? data.sessions : []
      // 保留客户端 id（与服务端一致），补齐 vehicleId 归属
      const normVehicles = vehicles.map((v) => ({ ...v, id: v.id || uid() }))
      const normSessions = sessions.map((s) => ({
        ...s,
        vehicleId: s.vehicleId || normVehicles[0]?.id || undefined
      }))
      this.vehicles = normVehicles
      this.allSessions = normSessions
      this.currentVehicleId = normVehicles[0]?.id ?? null
      try {
        const { vehicles: nv, sessions: ns } = await replaceAll({ vehicles: normVehicles, sessions: normSessions })
        this.vehicles = nv.map(normVehicle)
        this.allSessions = ns.map(normSession)
        this.currentVehicleId = this.vehicles[0]?.id ?? null
        await this.persistCurrent()
        toast('导入成功', 'success')
      } catch (e) {
        toast(errMsg(e), 'error')
      }
    }
  }
})
