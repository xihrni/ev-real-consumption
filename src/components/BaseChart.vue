<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch, shallowRef, nextTick } from 'vue'
import * as echarts from 'echarts'

const props = defineProps<{
  option: echarts.EChartsCoreOption
  height?: string
}>()

const el = ref<HTMLElement>()
const chart = shallowRef<echarts.ECharts>()

function resize() {
  chart.value?.resize()
}

onMounted(async () => {
  await nextTick()
  if (!el.value) return
  chart.value = echarts.init(el.value)
  chart.value.setOption(props.option)
  window.addEventListener('resize', resize)
})

watch(
  () => props.option,
  (opt) => chart.value?.setOption(opt, true),
  { deep: true }
)

onBeforeUnmount(() => {
  window.removeEventListener('resize', resize)
  chart.value?.dispose()
})
</script>

<template>
  <!-- 高度默认取 --chart-h（桌面端在 style.css 中放大到 300px），移动端回退 220px -->
  <div ref="el" :style="{ width: '100%', height: height || 'var(--chart-h, 220px)' }"></div>
</template>
