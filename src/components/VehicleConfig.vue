<script setup lang="ts">
import { ref, reactive, watch, onMounted } from 'vue'
import { useAppStore } from '../store/useAppStore'
import { CarFront } from 'lucide-vue-next'
import { validateVehicle } from '../utils/validation'
import { toast as showToast } from '../utils/toast'

const emit = defineEmits<{ saved: [] }>()

const store = useAppStore()
const model = ref('')
const B = ref<number | null>(null)
const Pmax = ref<number | null>(null)
const M0 = ref<number | null>(null)
const R0 = ref<number | null>(null)
const errors = reactive<Record<string, string>>({})

function fill() {
  const v = store.vehicle
  model.value = v?.model ?? ''
  B.value = v?.B ?? null
  Pmax.value = v?.Pmax ?? null
  M0.value = v?.M0 ?? null
  R0.value = v?.R0 ?? null
  Object.keys(errors).forEach((k) => delete errors[k])
}
onMounted(fill)
watch(() => store.vehicle?.id, fill)

async function save() {
  const e = validateVehicle({
    model: model.value,
    B: B.value,
    Pmax: Pmax.value,
    M0: M0.value,
    R0: R0.value
  })
  Object.keys(errors).forEach((k) => delete errors[k])
  Object.assign(errors, e)
  if (Object.keys(e).length) {
    showToast('请检查标红的字段', 'error')
    return
  }
  await store.saveCurrentVehicle({
    model: model.value,
    B: B.value,
    Pmax: Pmax.value,
    M0: M0.value,
    R0: R0.value
  })
  emit('saved')
}
</script>

<template>
  <section class="card">
    <div class="card-head">
      <div class="card-title"><CarFront :size="17" class="ic ic-brand" />车辆配置</div>
      <span class="tag" :class="{ brand: store.vehicle }">
        {{ store.vehicle ? '正在编辑 · ' + store.vehicle.model : '首次使用填写' }}
      </span>
    </div>
    <div class="grid2">
      <div class="field" style="grid-column: 1 / 3">
        <label>车型</label>
        <input v-model="model" placeholder="如 某EV 长续航版" :class="{ invalid: errors.model }" />
        <span v-if="errors.model" class="err">{{ errors.model }}</span>
      </div>
      <div class="field">
        <label>电池容量 B (kWh)</label>
        <input v-model.number="B" type="number" step="0.1" placeholder="60" :class="{ invalid: errors.B }" />
        <span v-if="errors.B" class="err">{{ errors.B }}</span>
      </div>
      <div class="field">
        <label>最大充电功率 P_max (kW)</label>
        <input v-model.number="Pmax" type="number" step="0.1" placeholder="120" :class="{ invalid: errors.Pmax }" />
        <span v-if="errors.Pmax" class="err">{{ errors.Pmax }}</span>
      </div>
      <div class="field">
        <label>初始里程 M0 (km)</label>
        <input v-model.number="M0" type="number" placeholder="10000" :class="{ invalid: errors.M0 }" />
        <span v-if="errors.M0" class="err">{{ errors.M0 }}</span>
      </div>
      <div class="field">
        <label>初始车显剩余里程 R0 (km)</label>
        <input v-model.number="R0" type="number" placeholder="400" :class="{ invalid: errors.R0 }" />
        <span v-if="errors.R0" class="err">{{ errors.R0 }}</span>
      </div>
    </div>
    <p class="hint-text">
      M0 / R0 是你<strong>开始记录之前</strong>上一次充电结束时的里程与剩余续航（不是当前里程）。填错时首条会自动作为「基准」，不影响后续测算。多辆车可在顶部车辆条切换、添加与管理。
    </p>
    <div class="btn-row end">
      <button @click="save">保存车辆配置</button>
    </div>
  </section>
</template>
