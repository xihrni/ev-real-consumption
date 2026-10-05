<script setup lang="ts">
import { ref, reactive, computed, watch } from 'vue'
import { useAppStore } from '../store/useAppStore'
import type { ChargeSession } from '../types'
import { validateSession } from '../utils/validation'
import { toast as showToast } from '../utils/toast'
import { round, fmtDuration } from '../utils/format'
import { Pencil, X, BatteryCharging, Home, Zap } from 'lucide-vue-next'

const props = defineProps<{ session: ChargeSession | null }>()
const emit = defineEmits<{ close: [] }>()

const store = useAppStore()
const ts = ref('')
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
const M = ref<number | null>(null)
const R_start = ref<number | null>(null)
const R_end = ref<number | null>(null)
const meter = ref<'battery' | 'grid'>('grid')
const ctype = ref<'home' | 'fast' | 'other'>('fast')
const note = ref('')
const errors = reactive<Record<string, string>>({})
const warnings = reactive<Record<string, string>>({})

const prevM = computed<number | null>(() => {
  if (!props.session) return null
  const sorted = store.sortedSessions
  const idx = sorted.findIndex((s) => s.id === props.session!.id)
  if (idx <= 0) return null // 首条用基线 M0，无上一条
  const prev = sorted[idx - 1]
  return prev.M != null ? prev.M : null
})

watch(
  () => props.session,
  (s) => {
    if (!s) return
    ts.value = s.ts || ''
    E.value = s.E ?? null
    T.value = s.T ?? null
    C.value = s.C ?? null
    M.value = s.M ?? null
    R_start.value = s.R_start ?? null
    R_end.value = s.R_end ?? null
    meter.value = s.meter ?? 'grid'
    ctype.value = s.ctype ?? 'fast'
    note.value = s.note ?? ''
    Object.keys(errors).forEach((k) => delete errors[k])
    Object.keys(warnings).forEach((k) => delete warnings[k])
  },
  { immediate: true }
)

async function save() {
  if (!props.session) return
  Object.keys(errors).forEach((k) => delete errors[k])
  Object.keys(warnings).forEach((k) => delete warnings[k])
  const res = validateSession({
    E: E.value,
    T: T.value,
    C: C.value,
    M: M.value,
    R_start: R_start.value,
    R_end: R_end.value,
    prevM: prevM.value
  })
  Object.assign(errors, res.errors)
  Object.assign(warnings, res.warnings)
  if (Object.keys(res.errors).length) {
    showToast('请检查标红的字段', 'error')
    return
  }
  await store.updateSession(props.session.id, {
    ts: ts.value || props.session.ts,
    E: E.value,
    T: T.value,
    C: C.value,
    M: M.value,
    R_start: R_start.value,
    R_end: R_end.value,
    meter: meter.value,
    ctype: ctype.value,
    note: note.value.trim() || null
  })
  emit('close')
}
</script>

<template>
  <div v-if="session" class="mask" @click.self="emit('close')">
    <div class="sheet">
      <div class="sheet-head">
        <h3><Pencil :size="18" class="ic ic-brand" />编辑充电记录</h3>
        <button class="close-x" @click="emit('close')"><X :size="18" /></button>
      </div>
      <div class="grid2">
        <div class="field" style="grid-column: 1 / 3">
          <label>充电时间</label>
          <input v-model="ts" type="datetime-local" />
        </div>
        <div class="field">
          <label>充电度数 E (kWh)</label>
          <input v-model.number="E" type="number" step="0.01" :class="{ invalid: errors.E }" />
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
          <input v-model.number="C" type="number" step="0.01" :class="{ invalid: errors.C }" />
          <span v-if="errors.C" class="err">{{ errors.C }}</span>
        </div>
        <div class="field">
          <label>当前里程 M (km) <span class="opt">·可选</span></label>
          <input v-model.number="M" type="number" placeholder="可留空" :class="{ invalid: errors.M }" />
          <span v-if="errors.M" class="err">{{ errors.M }}</span>
        </div>
        <div class="field">
          <label>起始车显剩余 (km) <span class="opt">·可选</span></label>
          <input v-model.number="R_start" type="number" placeholder="可留空" />
        </div>
        <div class="field">
          <label>结束车显剩余 (km) <span class="opt">·可选</span></label>
          <input v-model.number="R_end" type="number" placeholder="可留空" :class="{ invalid: errors.R_end }" />
          <span v-if="errors.R_end" class="err">{{ errors.R_end }}</span>
          <span v-else-if="warnings.R_end" class="warn">{{ warnings.R_end }}</span>
        </div>
        <div class="field" style="grid-column: 1 / 3">
          <label>度数口径</label>
          <div class="seg-control">
            <button :class="{ on: meter === 'grid' }" @click="meter = 'grid'">电网端</button>
            <button :class="{ on: meter === 'battery' }" @click="meter = 'battery'">
              <BatteryCharging :size="14" class="ic" />电池端
            </button>
          </div>
        </div>
        <div class="field" style="grid-column: 1 / 3">
          <label>充电类型 <span class="opt">（用于分组统计）</span></label>
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
          <label>备注 <span class="opt">（可选）</span></label>
          <input v-model="note" placeholder="可留空" />
        </div>
      </div>
      <p class="hint-text">补录 M / 起始 / 结束 后，系统会按最新数据重新测算该段与累计。</p>
      <div class="btn-row end">
        <button class="btn-sec" @click="emit('close')">取消</button>
        <button @click="save">保存并更新</button>
      </div>
    </div>
  </div>
</template>
