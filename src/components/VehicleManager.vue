<script setup lang="ts">
import { ref, reactive, computed } from 'vue'
import { useAppStore } from '../store/useAppStore'
import { validateVehicle } from '../utils/validation'
import { CarFront, Check, Trash2, Plus, X, Pencil } from 'lucide-vue-next'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ close: [] }>()

const store = useAppStore()
const showAdd = ref(false)
/** 正在编辑的车辆 id；null 表示不在编辑态 */
const editingId = ref<string | null>(null)
const formOpen = computed(() => showAdd.value || editingId.value !== null)

const model = ref('')
const B = ref<number | null>(null)
const Pmax = ref<number | null>(null)
const M0 = ref<number | null>(null)
const R0 = ref<number | null>(null)
const errors = reactive<Record<string, string>>({})

function resetForm() {
  model.value = ''
  B.value = null
  Pmax.value = null
  M0.value = null
  R0.value = null
  Object.keys(errors).forEach((k) => delete errors[k])
}

function openAdd() {
  resetForm()
  editingId.value = null
  showAdd.value = true
}

/** 进入编辑态：用该车辆现有数值预填表单 */
function openEdit(id: string) {
  const v = store.vehicles.find((x) => x.id === id)
  if (!v) return
  resetForm()
  model.value = v.model ?? ''
  B.value = v.B ?? null
  Pmax.value = v.Pmax ?? null
  M0.value = v.M0 ?? null
  R0.value = v.R0 ?? null
  editingId.value = id
  showAdd.value = false
}

function closeForm() {
  resetForm()
  showAdd.value = false
  editingId.value = null
}

function initial(name: string) {
  return (name || '车').trim().charAt(0).toUpperCase()
}

function selectVehicle(id: string) {
  store.switchVehicle(id)
  emit('close')
}

async function submitForm() {
  Object.keys(errors).forEach((k) => delete errors[k])
  const e = validateVehicle({
    model: model.value,
    B: B.value,
    Pmax: Pmax.value,
    M0: M0.value,
    R0: R0.value
  })
  Object.assign(errors, e)
  if (Object.keys(e).length) return

  const payload = {
    model: model.value,
    B: B.value,
    Pmax: Pmax.value,
    M0: M0.value,
    R0: R0.value
  }

  if (editingId.value) {
    const ok = await store.updateVehicleById(editingId.value, payload)
    if (ok) closeForm()
    return
  }

  const id = await store.addVehicle(payload)
  if (id) {
    closeForm()
    emit('close')
  }
}

async function remove(id: string) {
  await store.deleteVehicle(id)
}

function close() {
  closeForm()
  emit('close')
}
</script>

<template>
  <div v-if="open" class="mask" @click.self="close">
    <div class="sheet wide">
      <div class="sheet-head">
        <h3><CarFront :size="18" class="ic ic-brand" />车辆管理</h3>
        <button class="close-x" @click="close"><X :size="18" /></button>
      </div>

      <!-- 车辆列表 -->
      <div v-if="!formOpen" class="veh-list">
        <div
          v-for="v in store.vehicles"
          :key="v.id"
          class="veh-row"
          :class="{ active: v.id === store.currentVehicleId }"
          @click="selectVehicle(v.id)"
        >
          <span class="v-dot" :style="{ background: v.color || '#0fae8e' }">{{ initial(v.model) }}</span>
          <div class="veh-info">
            <div class="veh-name">{{ v.model }}</div>
            <div class="veh-spec">{{ v.B }} kWh · {{ v.Pmax }} kW · {{ v.R0 }} km</div>
          </div>
          <Check v-if="v.id === store.currentVehicleId" :size="18" class="ic ic-brand" />
          <button
            class="icon-btn"
            title="编辑"
            @click.stop="openEdit(v.id)"
          ><Pencil :size="15" /></button>
          <button
            class="icon-btn danger"
            title="删除"
            @click.stop="remove(v.id)"
          ><Trash2 :size="15" /></button>
        </div>

        <button class="add-btn" @click="openAdd">
          <Plus :size="16" class="ic" />添加车辆
        </button>
      </div>

      <!-- 添加 / 编辑车辆表单 -->
      <div v-else class="grid2">
        <div class="field" style="grid-column: 1 / 3">
          <label>{{ editingId ? '编辑车辆' : '添加车辆' }}</label>
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
        <p class="hint-text" style="grid-column:1/3">
          M0 / R0 是开始记录之前上一次充电结束时的里程与剩余续航（不是当前里程）。填错时首条会自动作为「基准」。
        </p>
        <div class="btn-row end" style="grid-column:1/3">
          <button class="btn-sec" @click="closeForm">返回</button>
          <button @click="submitForm">{{ editingId ? '保存修改' : '保存并切换' }}</button>
        </div>
      </div>
    </div>
  </div>
</template>
