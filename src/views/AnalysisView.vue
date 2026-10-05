<script setup lang="ts">
import { computed } from 'vue'
import { useAppStore } from '../store/useAppStore'
import type { Segment } from '../types'
import BaseChart from '../components/BaseChart.vue'
import { exportMonthlyCsv } from '../utils/exporters'
import { round } from '../utils/format'
import { PieChart, CalendarDays, Home, Zap, Download, TrendingUp } from 'lucide-vue-next'

const store = useAppStore()

const CTYPE_ORDER = ['home', 'fast', 'other'] as const
const CTYPE_LABEL: Record<string, string> = { home: '家充', fast: '超充', other: '其他' }
const CTYPE_COLOR: Record<string, string> = { home: '#0fae8e', fast: '#f59e0b', other: '#93a09a' }

const rows = computed(() => {
  const { segs, sorted } = store.computed
  return sorted.map((s, i) => ({ s, seg: segs[i] as Segment }))
})

/** A) 家充 / 超充 / 其他 分组统计 */
const byType = computed(() => {
  const map: Record<string, {
    key: string; label: string; count: number; allE: number; allC: number; okC: number; M: number; Econs: number; segCost: number; powers: number[]
  }> = {}
  for (const { s, seg } of rows.value) {
    const key = s.ctype || 'other'
    if (!map[key]) map[key] = { key, label: CTYPE_LABEL[key] || '其他', count: 0, allE: 0, allC: 0, okC: 0, M: 0, Econs: 0, segCost: 0, powers: [] }
    const g = map[key]
    g.count++
    g.allE += s.E
    g.allC += s.C
    if (seg && seg.status === 'ok') {
      g.okC += s.C
      g.M += seg.dM || 0
      g.Econs += seg.Econs || 0
      g.segCost += seg.segCost || 0
      if (seg.power != null) g.powers.push(seg.power)
    }
  }
  return CTYPE_ORDER.filter((k) => map[k]).map((k) => {
    const g = map[k]
    const avgPower = g.powers.length ? g.powers.reduce((a, b) => a + b, 0) / g.powers.length : null
    return {
      key: g.key,
      label: g.label,
      count: g.count,
      E: round(g.allE, 1),
      C: round(g.allC),
      M: round(g.M, 0),
      real: g.M > 0 ? round((g.Econs / g.M) * 100) : null,
      price: g.M > 0 ? round((g.segCost / g.M) * 100) : null,
      unitPrice: g.allE > 0 ? round(g.allC / g.allE) : null,
      avgPower: avgPower != null ? round(avgPower, 1) : null,
      color: CTYPE_COLOR[k]
    }
  })
})

const typePriceOption = computed(() => ({
  grid: { left: 40, right: 16, top: 24, bottom: 24 },
  tooltip: {
    trigger: 'axis',
    backgroundColor: 'rgba(20,28,24,0.9)',
    borderWidth: 0,
    textStyle: { color: '#fff', fontSize: 12 },
    valueFormatter: (v: number) => `${v} 元/kWh`
  },
  xAxis: { type: 'category', data: byType.value.map((t) => t.label), axisLine: { lineStyle: { color: '#e7ecea' } }, axisTick: { show: false }, axisLabel: { color: '#5d6b65', fontSize: 11 } },
  yAxis: { type: 'value', name: '元/kWh', nameTextStyle: { color: '#93a09a', fontSize: 10 }, axisLabel: { color: '#93a09a', fontSize: 10 }, splitLine: { lineStyle: { color: '#eef2f0' } } },
  series: [{
    type: 'bar',
    data: byType.value.map((t) => t.unitPrice),
    itemStyle: { color: '#0fae8e', borderRadius: [4, 4, 0, 0] },
    barWidth: '42%',
    // 宽屏下只剩一个分类时柱子会被拉成整屏宽，限个上限
    barMaxWidth: 72,
    label: { show: true, position: 'top', color: '#5d6b65', fontSize: 11, formatter: (p: { value: number }) => (p.value != null ? p.value : '') }
  }]
}))

/** B) 月度报表 */
const byMonth = computed(() => {
  const map: Record<string, { month: string; count: number; allE: number; allC: number; okC: number; M: number; Econs: number; segCost: number }> = {}
  for (const { s, seg } of rows.value) {
    const mk = (s.ts || '').slice(0, 7)
    if (!mk) continue
    if (!map[mk]) map[mk] = { month: mk, count: 0, allE: 0, allC: 0, okC: 0, M: 0, Econs: 0, segCost: 0 }
    const g = map[mk]
    g.count++
    g.allE += s.E
    g.allC += s.C
    if (seg && seg.status === 'ok') {
      g.okC += s.C
      g.M += seg.dM || 0
      g.Econs += seg.Econs || 0
      g.segCost += seg.segCost || 0
    }
  }
  return Object.keys(map).sort().map((mk) => {
    const g = map[mk]
    return {
      month: mk,
      count: g.count,
      E: round(g.allE, 1),
      C: round(g.allC),
      M: round(g.M, 0),
      real: g.M > 0 ? round((g.Econs / g.M) * 100) : null,
      price: g.M > 0 ? round((g.segCost / g.M) * 100) : null,
      unitPrice: g.allE > 0 ? round(g.allC / g.allE) : null
    }
  })
})

const monthOption = computed(() => ({
  grid: { left: 40, right: 16, top: 30, bottom: 24 },
  tooltip: { trigger: 'axis', backgroundColor: 'rgba(20,28,24,0.9)', borderWidth: 0, textStyle: { color: '#fff', fontSize: 12 } },
  legend: { data: ['真实电耗', '均价'], top: 0, right: 0, itemWidth: 12, itemHeight: 8, textStyle: { color: '#5d6b65', fontSize: 11 } },
  xAxis: { type: 'category', data: byMonth.value.map((m) => m.month), boundaryGap: false, axisLine: { lineStyle: { color: '#e7ecea' } }, axisTick: { show: false }, axisLabel: { color: '#93a09a', fontSize: 10 } },
  yAxis: { type: 'value', axisLabel: { color: '#93a09a', fontSize: 10 }, splitLine: { lineStyle: { color: '#eef2f0' } } },
  series: [
    { name: '真实电耗', type: 'line', smooth: true, symbol: 'circle', symbolSize: 6, data: byMonth.value.map((m) => m.real), itemStyle: { color: '#0fae8e' }, lineStyle: { width: 2.5, color: '#0fae8e' }, areaStyle: { color: { type: 'linear', x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: '#0fae8e33' }, { offset: 1, color: '#0fae8e05' }] } } },
    { name: '均价', type: 'line', smooth: true, symbol: 'circle', symbolSize: 6, data: byMonth.value.map((m) => m.price), itemStyle: { color: '#f59e0b' }, lineStyle: { width: 2.5, color: '#f59e0b' } }
  ]
}))

function exportMonth() {
  if (!store.vehicle || !byMonth.value.length) return
  exportMonthlyCsv(store.vehicle, store.sessions)
}
</script>

<template>
  <div>
    <!-- A) 家充 / 超充分组 -->
    <section class="card">
      <div class="card-head">
        <div class="card-title"><PieChart :size="17" class="ic ic-brand" />家充 / 超充分组统计</div>
      </div>

      <div v-if="!byType.length" class="empty">
        <div class="big"><PieChart :size="30" class="ic" /></div>
        还没有可用于分组的充电记录。请在「记录」中新增充电记录并选择充电类型（家充 / 超充 / 其他）。
      </div>

      <template v-else>
        <div class="chart-block">
          <div class="chart-title">各类型平均电价 (元/kWh)</div>
          <BaseChart :option="typePriceOption" />
          <p class="hint-text" style="margin-top:6px">
            平均电价 = 该类型总花费 ÷ 总充电度数。家充通常明显低于超充，可据此评估不同补能方式的成本差异。
          </p>
        </div>

        <div class="rpt-table">
          <div class="rpt-head">
            <span>类型</span><span>次数</span><span>度数</span><span>花费</span>
            <span>里程</span><span>真实电耗</span><span>均价</span><span>电价</span><span>功率</span>
          </div>
          <div v-for="t in byType" :key="t.key" class="rpt-row">
            <span><i class="dot" :style="{ background: t.color }"></i>{{ t.label }}</span>
            <span>{{ t.count }}</span>
            <span>{{ t.E.toFixed(1) }}</span>
            <span>{{ t.C }}</span>
            <span>{{ t.M.toFixed(0) }}</span>
            <span>{{ t.real != null ? t.real : '—' }}</span>
            <span>{{ t.price != null ? t.price : '—' }}</span>
            <span>{{ t.unitPrice != null ? t.unitPrice : '—' }}</span>
            <span>{{ t.avgPower != null ? t.avgPower : '—' }}</span>
          </div>
        </div>
        <p class="hint-text">真实电耗 / 均价单位分别为 kWh/100km、元/100km；电价单位 元/kWh；功率为平均充电功率 kW。电价按该类型全部充电（含待补全）的 花费÷度数 计算；真实电耗、均价、里程、功率仅统计数据齐全（完整）的段。</p>
      </template>
    </section>

    <!-- B) 月度报表 -->
    <section class="card">
      <div class="card-head">
        <div class="card-title"><CalendarDays :size="17" class="ic ic-brand" />月度报表</div>
        <button v-if="byMonth.length" class="tag" @click="exportMonth">导出月度 CSV</button>
      </div>

      <div v-if="!byMonth.length" class="empty">
        <div class="big"><CalendarDays :size="30" class="ic" /></div>
        暂无跨月份的完整记录，无法生成月度报表。补全更多月份的充电记录后即可查看。
      </div>

      <template v-else>
        <div class="chart-block">
          <div class="chart-title"><TrendingUp :size="14" class="ic ic-brand" />各月真实电耗与均价趋势</div>
          <BaseChart :option="monthOption" />
          <div class="legend">
            <span><i style="background:#0fae8e"></i>真实电耗</span>
            <span><i style="background:#f59e0b"></i>均价</span>
          </div>
        </div>

        <div class="rpt-table">
          <div class="rpt-head">
            <span>月份</span><span>次数</span><span>度数</span><span>花费</span>
            <span>里程</span><span>真实电耗</span><span>均价</span><span>电价</span>
          </div>
          <div v-for="m in byMonth" :key="m.month" class="rpt-row">
            <span>{{ m.month }}</span>
            <span>{{ m.count }}</span>
            <span>{{ m.E }}</span>
            <span>{{ m.C }}</span>
            <span>{{ m.M }}</span>
            <span>{{ m.real != null ? m.real : '—' }}</span>
            <span>{{ m.price != null ? m.price : '—' }}</span>
            <span>{{ m.unitPrice != null ? m.unitPrice : '—' }}</span>
          </div>
        </div>
        <p class="hint-text">月度报表中，度数/花费/次数为该月全部充电记录；里程、真实电耗、均价仅基于数据齐全（完整）的段；电价按该月全部充电的 花费÷度数 计算。CSV 可在 Excel 中进一步透视分析。</p>
      </template>
    </section>
  </div>
</template>
