<script setup lang="ts">
import { useAppStore } from '../store/useAppStore'
import { CarFront, Pencil } from 'lucide-vue-next'

const store = useAppStore()

defineEmits<{
  'switch-vehicle': []
  'edit-config': []
}>()

function initial(name: string) {
  return (name || '车').trim().charAt(0).toUpperCase()
}
</script>

<template>
  <div v-if="store.vehicle" class="hero-card" @click="$emit('switch-vehicle')">
    <div class="hero-top">
      <div class="hero-model">
        <CarFront :size="18" class="ic" />
        {{ store.vehicle.model }}
        <Pencil :size="13" class="edit-hint" title="编辑车辆（打开车辆管理）" @click.stop="$emit('edit-config')" />
      </div>
      <button class="hero-edit" @click.stop="$emit('switch-vehicle')">管理</button>
    </div>
    <div class="hero-specs">
      <div class="spec"><div class="n">{{ store.vehicle.B }} kWh</div><div class="l">电池容量</div></div>
      <div class="spec"><div class="n">{{ store.vehicle.Pmax }} kW</div><div class="l">最大充电功率</div></div>
      <div class="spec"><div class="n">{{ store.sessions.length }}</div><div class="l">充电记录</div></div>
    </div>
  </div>

  <!-- 无车时的占位 -->
  <div v-else class="hero-card empty-state" @click="$emit('switch-vehicle')">
    <span class="empty-text">点击选择或添加车辆 →</span>
  </div>
</template>

<style scoped>
.hero-card {
  margin: var(--hero-mt, 10px) auto 0;
  max-width: var(--hero-max, 760px);
  width: calc(100% - var(--hero-inset, 14px) * 2);
  background: var(--brand-grad);
  border-radius: var(--radius);
  padding: 18px 20px;
  color: #fff;
  cursor: pointer;
  box-shadow: 0 4px 16px rgba(15, 174, 142, 0.25);
}
.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  background: var(--surface);
  border: 1.5px dashed var(--border-strong);
  box-shadow: none;
  color: var(--text-faint);
}
.hero-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}
.hero-model {
  font-size: 18px;
  font-weight: 800;
  display: flex;
  align-items: center;
  gap: 8px;
}
.hero-model .ic { flex-shrink: 0; }
.edit-hint {
  opacity: 0.65;
  margin-left: 2px;
  cursor: pointer;
  transition: opacity 0.15s;
}
.edit-hint:hover { opacity: 1; }
.hero-edit {
  color: #fff;
  opacity: 0.92;
  font-size: 13px;
  font-weight: 600;
  background: rgba(255,255,255,0.18);
  padding: 5px 14px;
  border-radius: 20px;
  border: none;
  cursor: pointer;
  transition: background 0.15s;
}
.hero-edit:hover {
  background: rgba(255,255,255,0.3);
}
.hero-specs {
  display: flex;
  gap: 22px;
  margin-top: 12px;
  flex-wrap: wrap;
}
.spec .n { font-size: 17px; font-weight: 700; }
.spec .l { font-size: 11px; opacity: 0.85; }
.empty-text {
  font-size: 14px;
  font-weight: 600;
}
</style>
