<script setup lang="ts">
import { ref } from 'vue'
import { useAppStore } from '../store/useAppStore'
import SessionForm from '../components/SessionForm.vue'
import SessionList from '../components/SessionList.vue'
import SessionEditModal from '../components/SessionEditModal.vue'
import type { ChargeSession } from '../types'

const store = useAppStore()
const editing = ref<ChargeSession | null>(null)

function onEdit(id: string) {
  editing.value = store.sessions.find((s) => s.id === id) ?? null
}
function onRemove(id: string) {
  if (confirm('确定删除这条记录？此操作不可恢复。')) store.deleteSession(id)
}
</script>

<template>
  <!-- .rec-page：桌面端表单与列表并排，移动端由 CSS 保持单列堆叠 -->
  <div class="rec-page">
    <SessionForm />
    <SessionList @edit="onEdit" @remove="onRemove" />
    <SessionEditModal :session="editing" @close="editing = null" />
  </div>
</template>
