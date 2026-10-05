<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useAppStore } from './store/useAppStore'
import OverviewView from './views/OverviewView.vue'
import RecordsView from './views/RecordsView.vue'
import DataView from './views/DataView.vue'
import AnalysisView from './views/AnalysisView.vue'
import HelpView from './views/HelpView.vue'
import AuthView from './views/AuthView.vue'
import ToastHost from './components/ToastHost.vue'
import VehicleManager from './components/VehicleManager.vue'
import VehicleCard from './components/VehicleCard.vue'
import { LayoutDashboard, ClipboardList, Database, PieChart, CircleHelp, BatteryCharging, LogOut } from 'lucide-vue-next'

type Tab = 'overview' | 'records' | 'data' | 'analysis' | 'help'
const tab = ref<Tab>('overview')
const store = useAppStore()
const showVehicleMgr = ref(false)

const tabs: { key: Tab; label: string; icon: unknown }[] = [
  { key: 'overview', label: '概览', icon: LayoutDashboard },
  { key: 'records', label: '记录', icon: ClipboardList },
  { key: 'analysis', label: '分析', icon: PieChart },
  { key: 'data', label: '数据', icon: Database },
  { key: 'help', label: '帮助', icon: CircleHelp }
]

function openVehicleMgr() {
  showVehicleMgr.value = true
}

function logout() {
  if (confirm('退出当前账号？本地登录态将清除（云端数据保留，可再次登录访问）。')) {
    store.logout()
    tab.value = 'overview'
  }
}

onMounted(() => store.init())
</script>

<template>
  <!-- 启动中 -->
  <div v-if="!store.authReady" class="boot">
    <span class="boot-logo"><BatteryCharging :size="22" color="#fff" /></span>
    <p>加载中…</p>
  </div>

  <!-- 未登录：登录 / 注册 -->
  <AuthView v-else-if="!store.authed" />

  <!-- 已登录：主应用 -->
  <div v-else class="app-shell">
    <header class="app-header">
      <div class="brand">
        <span class="logo">
          <BatteryCharging :size="20" :stroke-width="2.4" color="#fff" />
        </span>
        <h1>真实电耗记录</h1>
      </div>
      <span class="user-chip" @click="logout" title="退出登录">
        <span class="u-email">{{ store.userEmail }}</span>
        <LogOut :size="14" class="u-out" />
      </span>
    </header>

    <!-- 内容区（桌面端整体占右列，底部 Tab 栏变左侧导航） -->
    <div class="app-body">
      <!-- 车辆信息卡片 -->
      <VehicleCard @switch-vehicle="openVehicleMgr" @edit-config="openVehicleMgr" />

      <main class="content">
        <OverviewView v-if="tab === 'overview'" @goto="tab = $event" />
        <RecordsView v-else-if="tab === 'records'" />
        <AnalysisView v-else-if="tab === 'analysis'" />
        <DataView v-else-if="tab === 'data'" />
        <HelpView v-else-if="tab === 'help'" />
      </main>
    </div>

    <nav class="tab-bar">
      <button
        v-for="t in tabs"
        :key="t.key"
        class="tab"
        :class="{ active: tab === t.key }"
        @click="tab = t.key"
      >
        <component :is="t.icon" :size="22" :stroke-width="2" />
        <span>{{ t.label }}</span>
        <span
          v-if="t.key === 'records' && store.summary.pending + store.summary.err > 0"
          class="dot"
        ></span>
      </button>
    </nav>

    <VehicleManager :open="showVehicleMgr" @close="showVehicleMgr = false" />
  </div>

  <!-- 提示容器必须常驻根级：登录/注册页也要能弹出错误提示，否则登录失败会静默无反应 -->
  <ToastHost />
</template>

<style scoped>
.boot {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 14px;
  color: #fff;
  background: var(--brand-grad);
}
.boot-logo {
  width: 56px;
  height: 56px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.18);
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 8px 22px rgba(0, 0, 0, 0.2);
}
.boot p {
  margin: 0;
  font-size: 14px;
  font-weight: 600;
  opacity: 0.92;
}
.user-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  max-width: 46vw;
  font-size: 12px;
  color: var(--text-sub);
  background: var(--surface-2);
  border: 1px solid var(--border);
  padding: 5px 10px;
  border-radius: 20px;
  cursor: pointer;
}
.u-email {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.u-out {
  color: var(--text-faint);
  flex: none;
}
.user-chip:hover .u-out {
  color: var(--red);
}
</style>
