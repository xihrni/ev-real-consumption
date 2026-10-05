<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { useAppStore } from '../store/useAppStore'
import { nowLocal, round, fmtDuration } from '../utils/format'
import { toast as showToast } from '../utils/toast'
import { validateSession } from '../utils/validation'
import { Zap, BatteryCharging, Home } from 'lucide-vue-next'

const store = useAppStore()
const ts = ref(nowLocal())
const E = ref<number | null>(null)
const Th = ref<number | null>(null)
const Tm = ref<number | null>(null)
const T = computed<number | null>({
  get: () => {
    const h = Th.value
    const m = Tm.value
    if (h == null && m == null) return null
    return round((h ?? 0) + (m ?? 0) / 60, 4)
  },
  set: (v) => {
    if (v == null) {
      Th.value = null
      Tm.value = null
      return
    }
    const h = Math.floor(v)
    const m = Math.round((v - h) * 60)
    Th.value = h
    Tm.value = m
  }
})
const C = ref<number | null>(null)
const meter = ref<'battery' | 'grid'>('grid')
const ctype = ref<'home' | 'fast' | 'other'>('fast')
const note = ref('')
const errors = reactive<Record<string, string>>({})

async function add() {
  Object.keys(errors).forEach((k) => delete errors[k])
  const { errors: e } = validateSession({ E: E.value, T: T.value, C: C.value })
  Object.assign(errors, e)
  if (Object.keys(e).length) {
    showToast('请检查标红的字段', 'error')
    return
  }
  if (!store.vehicle) {
    showToast('请先在顶部「车辆管理」中添加并选择一辆车', 'error')
    return
  }
  const ok = await store.addSession({
    ts: ts.value || nowLocal(),
    E: E.value,
    T: T.value,
    C: C.value,
    meter: meter.value,
    ctype: ctype.value,
    note: note.value
  })
  if (ok) {
    E.value = null
    Th.value = null
    Tm.value = null
    C.value = null
    note.value = ''
    ts.value = nowLocal()
  }
}
</script>

<template>
  <section class="card">
    <div class="card-head">
      <div class="card-title"><Zap :size="17" class="ic ic-brand" />新增充电记录</div>
      <span class="tag">阶段一 · 先存账单</span>
    </div>
    <div class="grid2">
      <div class="field" style="grid-column: 1 / 3">
        <label>充电时间</label>
        <input v-model="ts" type="datetime-local" />
      </div>
      <div class="field">
        <label>充电度数 E (kWh)</label>
        <input v-model.number="E" type="number" step="0.01" placeholder="40" :class="{ invalid: errors.E }" />
        <span v-if="errors.E" class="err">{{ errors.E }}</span>
      </div>
      <div class="field">
        <label>充电时长</label>
        <div class="hm-row">
          <input v-model.number="Th" type="number" min="0" step="1" placeholder="0" class="hm-input" :class="{ invalid: errors.T }" />
          <span class="hm-unit">时</span>
          <input v-model.number="Tm" type="number" min="0" max="59" step="1" placeholder="0" class="hm-input" :class="{ invalid: errors.T }" />
          <span class="hm-unit">分</span>
        </div>
        <span v-if="errors.T" class="err">{{ errors.T }}</span>
      </div>
      <div class="field" style="grid-column: 1 / 3">
        <label>总价 C (¥)</label>
        <input v-model.number="C" type="number" step="0.01" placeholder="40" :class="{ invalid: errors.C }" />
        <span v-if="errors.C" class="err">{{ errors.C }}</span>
      </div>
      <div class="field" style="grid-column: 1 / 3">
        <label>度数口径</label>
        <div class="seg-control">
          <button :class="{ on: meter === 'grid' }" @click="meter = 'grid'">电网端</button>
          <button :class="{ on: meter === 'battery' }" @click="meter = 'battery'">
            <BatteryCharging :size="14" class="ic" />电池端
          </button>
        </div>
        <p class="hint-inline">⚠️ 电池端与电网端相差约 10% 线损，请<strong>每次保持同一口径</strong>，否则电耗/效率测算会失真。</p>
      </div>
      <div class="field" style="grid-column: 1 / 3">
        <label>充电类型 <span class="opt">（用于家充/超充分组统计）</span></label>
        <div class="seg-control">
          <button :class="{ on: ctype === 'fast' }" @click="ctype = 'fast'">
            <Zap :size="14" class="ic" />超充
          </button>
          <button :class="{ on: ctype === 'home' }" @click="ctype = 'home'">
            <Home :size="14" class="ic" />家充
          </button>
          <button :class="{ on: ctype === 'other' }" @click="ctype = 'other'">其他</button>
        </div>
      </div>
      <div class="field" style="grid-column: 1 / 3">
        <label>备注 <span class="opt">（可选，如 家充 / 超充 / 高速）</span></label>
        <input v-model="note" placeholder="可留空" />
      </div>
    </div>
    <p class="hint-text">里程与车显剩余里程可稍后点记录的「补全 / 编辑」补填。仅填以上 4 项也能保存。</p>
    <div class="btn-row end">
      <button @click="add">保存记录</button>
    </div>
  </section>
</template>
