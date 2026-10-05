<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAppStore } from '../store/useAppStore'
import { fmtDateShort } from '../utils/format'
import { segSummary } from '../utils/calc'
import { round } from '../utils/format'
import BaseChart from '../components/BaseChart.vue'
import { BarChart3, TrendingUp, Zap, Coins, Route, Wallet, Clock } from 'lucide-vue-next'

const store = useAppStore()
defineEmits(['goto'])

type Period = 'all' | '30d' | 'month' | 'lastmonth'
const period = ref<Period>('all')
const periodOpts: { key: Period; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: '30d', label: '近30天' },
  { key: 'month', label: '本月' },
  { key: 'lastmonth', label: '上月' }
]

function inPeriod(tsStr: string, p: Period): boolean {
  const d = new Date(tsStr)
  if (isNaN(d.getTime())) return false
  const now = new Date()
  if (p === 'all') return true
  if (p === '30d') return d.getTime() >= now.getTime() - 30 * 86400000
  if (p === 'month') return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  const lm = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  return d.getFullYear() === lm.getFullYear() && d.getMonth() === lm.getMonth()
}

const result = computed(() => store.computed)

// 周期内（含所有状态的段，用于统计状态分布）
const periodItems = computed(() =>
  result.value.sorted
    .map((s, i) => ({ s, seg: result.value.segs[i] }))
    .filter((x) => inPeriod(x.s.ts, period.value))
)
// 仅可用（ok）的段，用于趋势/对比图与累计
const okItems = computed(() => periodItems.value.filter((x) => x.seg.status === 'ok'))
const summary = computed(() => segSummary(periodItems.value.map((x) => x.seg)))

// 周期内累计（基于 ok 段）
const cum = computed(() => {
  let M = 0, E = 0, C = 0
  okItems.value.forEach((x) => {
    M += x.seg.dM || 0
    E += x.seg.Econs || 0
    C += x.seg.segCost || 0
  })
  return M > 0 ? { real: round((E / M) * 100), price: round((C / M) * 100), M: round(M, 0), E: round(E), C: round(C) } : null
})

const labels = computed(() => okItems.value.map((x) => fmtDateShort(x.s.ts) || x.seg.label))

function lineOption(values: (number | null)[], color: string, unit: string, name: string) {
  return {
    grid: { left: 38, right: 14, top: 16, bottom: 26 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(20,28,24,0.9)',
      borderWidth: 0,
      textStyle: { color: '#fff', fontSize: 12 },
      valueFormatter: (v: number) => `${v} ${unit}`
    },
    xAxis: {
      type: 'category',
      data: labels.value,
      boundaryGap: false,
      axisLine: { lineStyle: { color: '#e7ecea' } },
      axisTick: { show: false },
      axisLabel: { color: '#93a09a', fontSize: 10 }
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#93a09a', fontSize: 10 },
      splitLine: { lineStyle: { color: '#eef2f0' } }
    },
    series: [
      {
        name,
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 7,
        data: values,
        lineStyle: { width: 2.5, color },
        itemStyle: { color },
        areaStyle: {
          color: {
            type: 'linear',
            x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: color + '33' },
              { offset: 1, color: color + '05' }
            ]
          }
        }
      }
    ]
  }
}

const realOption = computed(() =>
  lineOption(okItems.value.map((x) => x.seg.real ?? null), '#0fae8e', 'kWh/100km', '真实电耗')
)
const priceOption = computed(() =>
  lineOption(okItems.value.map((x) => x.seg.price ?? null), '#f59e0b', '元/100km', '均价')
)

const compareOption = computed(() => ({
  grid: { left: 38, right: 14, top: 16, bottom: 26 },
  tooltip: {
    trigger: 'axis',
    axisPointer: { type: 'shadow' },
    backgroundColor: 'rgba(20,28,24,0.9)',
    borderWidth: 0,
    textStyle: { color: '#fff', fontSize: 12 }
  },
  legend: { data: ['真实电耗', '表显电耗'], top: 0, right: 0, itemWidth: 12, itemHeight: 8, textStyle: { color: '#5d6b65', fontSize: 11 } },
  xAxis: {
    type: 'category',
    data: labels.value,
    axisLine: { lineStyle: { color: '#e7ecea' } },
    axisTick: { show: false },
    axisLabel: { color: '#93a09a', fontSize: 10 }
  },
  yAxis: { type: 'value', axisLabel: { color: '#93a09a', fontSize: 10 }, splitLine: { lineStyle: { color: '#eef2f0' } } },
  series: [
    { name: '真实电耗', type: 'bar', data: okItems.value.map((x) => x.seg.real ?? null), itemStyle: { color: '#0fae8e', borderRadius: [3, 3, 0, 0] }, barWidth: '32%' },
    { name: '表显电耗', type: 'bar', data: okItems.value.map((x) => x.seg.disp ?? null), itemStyle: { color: '#6366f1', borderRadius: [3, 3, 0, 0] }, barWidth: '32%' }
  ]
}))

// 充电时长 + 充电度数（分组柱状图）
const durationOption = computed(() => {
  const durations = okItems.value.map((x) => round(x.s.T ?? null, 2))
  const degrees = okItems.value.map((x) => round(x.s.E ?? null, 1))
  const totalH = round(durations.reduce((s, v) => s + (v ?? 0), 0), 1)
  const avgH = round(totalH / Math.max(durations.length, 1), 2)
  const totalE = round(degrees.reduce((s, v) => s + (v ?? 0), 0), 1)
  const avgE = round(totalE / Math.max(degrees.length, 1), 1)
  return {
    grid: { left: 44, right: 14, top: 24, bottom: 26 },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: 'rgba(20,28,24,0.9)',
      borderWidth: 0,
      textStyle: { color: '#fff', fontSize: 12 },
      formatter: (params: Array<{ seriesName: string; value: number }>) => {
        if (!params?.length) return ''
        return `<b>${labels.value[params[0].dataIndex]}</b><br/>`
          + params.map(p => `${p.seriesName}：${p.value ?? '-'} ${p.seriesName.includes('度数') ? 'kWh' : 'h'}`).join('<br/>')
          + `<br/><span style="color:#6366f1">平均 ${avgH} h · ${avgE} kWh</span>`
      }
    },
    legend: {
      data: ['充电时长', '充电度数'],
      top: 0, right: 0, itemWidth: 12, itemHeight: 8,
      textStyle: { color: '#5d6b65', fontSize: 11 }
    },
    xAxis: {
      type: 'category',
      data: labels.value,
      axisLine: { lineStyle: { color: '#e7ecea' } },
      axisTick: { show: false },
      axisLabel: { color: '#93a09a', fontSize: 10 }
    },
    // 时长(h)与度数(kWh)量纲不同，共用一轴会让时长柱被压成看不见的一条线，故各走一轴
    yAxis: [
      {
        type: 'value',
        name: 'kWh',
        nameTextStyle: { color: '#93a09a', fontSize: 10 },
        axisLabel: { color: '#93a09a', fontSize: 10 },
        splitLine: { lineStyle: { color: '#eef2f0' } }
      },
      {
        type: 'value',
        name: 'h',
        nameTextStyle: { color: '#93a09a', fontSize: 10 },
        axisLabel: { color: '#93a09a', fontSize: 10 },
        splitLine: { show: false }
      }
    ],
    series: [
      {
        name: '充电时长',
        type: 'bar',
        yAxisIndex: 1,
        data: durations,
        itemStyle: { color: '#0fae8e', borderRadius: [3, 3, 0, 0] },
        barWidth: '30%',
        label: { show: true, position: 'top', fontSize: 10, color: '#0fae8e', fontWeight: 600, formatter: '{c}' }
      },
      {
        name: '充电度数',
        type: 'bar',
        yAxisIndex: 0,
        data: degrees,
        itemStyle: { color: '#f59e0b', borderRadius: [3, 3, 0, 0] },
        barWidth: '30%',
        label: { show: true, position: 'top', fontSize: 10, color: '#f59e0b', fontWeight: 600, formatter: '{c}' }
      }
    ]
  }
})

const hasChart = computed(() => okItems.value.length > 0)
</script>

<template>
  <div>
    <!-- Stats -->
    <div class="card">
      <div class="card-head">
        <div class="card-title"><BarChart3 :size="17" class="ic ic-brand" />累计统计</div>
        <span class="tag brand">全量重算</span>
      </div>

      <div class="seg-control plain">
        <button
          v-for="o in periodOpts"
          :key="o.key"
          :class="{ on: period === o.key }"
          @click="period = o.key"
        >{{ o.label }}</button>
      </div>

      <div v-if="cum" class="stats-grid">
        <div class="stat">
          <div class="k"><Zap :size="13" class="ic ic-brand" />真实电耗</div>
          <div class="v">{{ cum.real }}<span class="u"> kWh/100km</span></div>
        </div>
        <div class="stat alt">
          <div class="k"><Coins :size="13" class="ic ic-price" />用电均价</div>
          <div class="v">{{ cum.price }}<span class="u"> 元/100km</span></div>
        </div>
        <div class="stat">
          <div class="k"><Route :size="13" class="ic ic-blue" />累计行驶</div>
          <div class="v">{{ cum.M }}<span class="u"> km</span></div>
        </div>
        <div class="stat alt">
          <div class="k"><Wallet :size="13" class="ic ic-sub" />累计花费</div>
          <div class="v">{{ cum.C }}<span class="u"> 元</span></div>
        </div>
      </div>

      <div v-else class="empty">
        <div class="big"><Zap :size="30" class="ic" /></div>
        该统计周期内暂无可用于累计的完整记录。<br />
        <template v-if="summary.baseline">已建立 {{ summary.baseline }} 条基准，补录下一段即可开始测算。</template>
        <template v-else>请先在「记录」中新增充电记录、补全里程与车显数据。</template>
      </div>

      <div v-if="summary.total > 0" class="summary-bar">
        基于 <b>{{ summary.ok }}</b> 段有效{{ summary.baseline ? ` · ${summary.baseline} 基准` : '' }}{{ summary.pending ? ` · ${summary.pending} 待补全` : '' }}{{ summary.err ? ` · ${summary.err} 异常` : '' }}（共 {{ summary.total }} 条）
      </div>
    </div>

    <!-- Charts -->
    <div v-if="hasChart" class="card chart-card">
      <div class="card-head">
        <div class="card-title"><TrendingUp :size="17" class="ic ic-brand" />趋势与对比</div>
      </div>
      <div class="chart-block">
        <div class="chart-title">真实百公里电耗 (kWh/100km)</div>
        <BaseChart :option="realOption" />
      </div>
      <div class="chart-block">
        <div class="chart-title">百公里用电均价 (¥/100km)</div>
        <BaseChart :option="priceOption" />
      </div>
      <div class="chart-block">
        <div class="chart-title">表显电耗 vs 真实电耗</div>
        <BaseChart :option="compareOption" />
        <div class="legend">
          <span><i style="background:#0fae8e"></i>真实电耗</span>
          <span><i style="background:#6366f1"></i>表显电耗</span>
        </div>
      </div>
      <div class="chart-block">
        <div class="chart-title"><Clock :size="14" class="ic ic-brand" />充电时长与度数</div>
        <BaseChart :option="durationOption" />
        <div class="legend">
          <span><i style="background:#0fae8e"></i>充电时长 (h)</span>
          <span><i style="background:#f59e0b"></i>充电度数 (kWh)</span>
        </div>
      </div>
    </div>
  </div>
</template>
