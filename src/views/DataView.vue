<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAppStore } from '../store/useAppStore'
import { exportJson, exportCsv } from '../utils/exporters'
import type { Vehicle, ChargeSession } from '../types'
import { Database, Sparkles, Download, FileDown, Upload, Trash2, Lock, AlertTriangle } from 'lucide-vue-next'

const store = useAppStore()
const fileInput = ref<HTMLInputElement>()
const summary = computed(() => store.summary)

const storageInfo = computed(() => {
  const bytes = JSON.stringify({ vehicles: store.vehicles, sessions: store.allSessions }).length
  return (bytes / 1024).toFixed(1) + ' KB'
})

/** 三个覆盖类操作共用的一句风险提示 */
const overwriteTip = computed(
  () =>
    `「导入 JSON」「载入示例数据」「清空全部」都会覆盖当前账号下的全部车辆与全部记录，且不可恢复。操作前请先「导出 JSON」备份。`
)

function loadDemo() {
  if (
    !confirm(
      `载入示例数据会覆盖当前账号下的全部车辆与全部充电记录（现有 ${store.vehicles.length} 辆车 / ${store.allSessions.length} 条记录），且不可恢复。\n\n建议先点「导出 JSON」备份。确定继续吗？`
    )
  )
    return
  store.loadDemo()
}
function exportJson_() {
  if (!store.vehicles.length) return
  exportJson(store.vehicles, store.allSessions)
}
function exportCsv_() {
  if (!store.allSessions.length) return
  exportCsv(store.vehicles, store.allSessions)
}
function pickFile() {
  fileInput.value?.click()
}
function onFile(e: Event) {
  const f = (e.target as HTMLInputElement).files?.[0]
  if (!f) return
  const reader = new FileReader()
  reader.onload = () => {
    let d: { vehicle?: Vehicle | null; vehicles?: Vehicle[]; sessions?: ChargeSession[] }
    try {
      d = JSON.parse(String(reader.result))
    } catch {
      alert('文件解析失败，请确认是导出的 JSON 备份')
      ;(e.target as HTMLInputElement).value = ''
      return
    }
    const nVeh = Array.isArray(d.vehicles) ? d.vehicles.length : d.vehicle ? 1 : 0
    const nSes = Array.isArray(d.sessions) ? d.sessions.length : 0
    if (!nVeh) {
      alert('文件解析失败：未找到车辆数据，请确认是本应用导出的 JSON 备份')
      ;(e.target as HTMLInputElement).value = ''
      return
    }
    if (
      !confirm(
        `即将用备份文件覆盖导入：${nVeh} 辆车 / ${nSes} 条记录。\n\n这会<b>替换</b>当前账号下的全部车辆与全部记录（现有 ${store.vehicles.length} 辆车 / ${store.allSessions.length} 条），原有数据不可恢复。\n\n确定继续吗？`
      )
    ) {
      ;(e.target as HTMLInputElement).value = ''
      return
    }
    store.importData(d)
    ;(e.target as HTMLInputElement).value = ''
  }
  reader.readAsText(f)
}
function clearAll() {
  if (
    confirm(
      `确定清空当前账号下的全部数据？\n\n将删除 ${store.vehicles.length} 辆车与 ${store.allSessions.length} 条充电记录，<b>不可恢复</b>。\n\n建议先点「导出 JSON」备份。`
    )
  )
    store.clearAll()
}
</script>

<template>
  <div>
    <section class="card">
      <div class="card-head">
        <div class="card-title"><Database :size="17" class="ic ic-brand" />数据管理</div>
      </div>
      <div class="summary-bar" style="margin-top:0;margin-bottom:14px">
        当前账号共 <b>{{ store.vehicles.length }}</b> 辆车 · <b>{{ store.allSessions.length }}</b> 条充电记录
        <template v-if="store.vehicle"> · 其中「{{ store.vehicle.model }}」含
          {{ summary.ok }} 完整 / {{ summary.baseline }} 基准 / {{ summary.pending }} 待补全 / {{ summary.err }} 异常</template>
        · 导出 JSON 约 {{ storageInfo }}
      </div>

      <div class="warn-bar" style="margin-top:0">
        <AlertTriangle :size="15" class="ic" />
        <span>{{ overwriteTip }}</span>
      </div>

      <div class="btn-row" style="margin-top:0">
        <button class="btn-sec" @click="loadDemo"><Sparkles :size="15" class="ic" />载入示例数据</button>
        <button class="btn-sec" @click="exportJson_"><Download :size="15" class="ic" />导出 JSON</button>
        <button class="btn-sec" @click="exportCsv_"><FileDown :size="15" class="ic" />导出 CSV</button>
        <button class="btn-sec" @click="pickFile"><Upload :size="15" class="ic" />导入 JSON</button>
        <button class="btn-danger" @click="clearAll"><Trash2 :size="15" class="ic" />清空全部</button>
      </div>
      <input ref="fileInput" type="file" accept="application/json" style="display:none" @change="onFile" />
      <p class="hint-text">
        <b>导出 JSON</b>：完整备份（含全部车辆与记录、每条记录的原始输入值），可用于迁移到其它设备，也是唯一能完整还原的格式。<br />
        <b>导出 CSV</b>：每行一条记录，附带系统重算出的真实电耗、均价、度数口径等分析列，可直接用 Excel 打开；只导出、不参与导入。<br />
        <b>导入 JSON</b>：整库替换，只能用本应用导出的 JSON 文件。
      </p>
    </section>

    <section class="card">
      <div class="card-head">
        <div class="card-title"><Lock :size="17" class="ic ic-brand" />数据与隐私</div>
      </div>
      <p class="hint-text" style="margin-top:0">
        记录随账号保存在服务端，<b>需登录后才能读写</b>，不同账号的数据彼此隔离。除邮箱与你自己填写的充电记录外，不采集其他个人信息，数据不作他用、不向第三方共享。
      </p>
      <p class="hint-text">
        在本设备上登录后，记录会自动同步到云端；换设备登录同一账号即可继续使用。导出的 JSON / CSV 文件保存在你自己的设备上，不会上传，请自行妥善保管。
      </p>
    </section>
  </div>
</template>
