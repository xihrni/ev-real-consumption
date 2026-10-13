<script setup lang="ts">
import { computed } from 'vue'
import { useAppStore } from '../store/useAppStore'
import type { Segment } from '../types'
import BaseChart from '../components/BaseChart.vue'
import { exportMonthlyCsv } from '../utils/exporters'
import { round, fmtDateShort } from '../utils/format'
import { PieChart, CalendarDays, TrendingUp, Activity, Gauge, Ruler } from 'lucide-vue-next'

const store = useAppStore()

const CTYPE_ORDER = ['home', 'fast', 'other'] as const
const CTYPE_LABEL: Record<string, string> = { home: '家充', fast: '超充', other: '其他' }
const CTYPE_COLOR: Record<string, string> = { home: '#0fae8e', fast: '#f59e0b', other: '#93a09a' }

const rows = computed(() => {
  const { segs, sorted } = store.computed
  return sorted.map((s, i) => ({ s, seg: segs[i] as Segment }))
})

/** 仅数据齐全（ok）的段，供单次充电分析使用 */
const okSegs = computed(() =>
  rows.value
    .filter((r) => r.seg && r.seg.status === 'ok')
    .map((r) => ({
      label: r.seg.label,
      dateShort: fmtDateShort(r.s.ts),
      dateFull: (r.s.ts || '').replace('T', ' '),
      dM: r.seg.dM ?? 0,
      real: r.seg.real ?? null,
      disp: r.seg.disp ?? null,
      price: r.seg.price ?? null,
      power: r.seg.power ?? null
    }))
)

/** 真实电耗的均值 / 标准差 / 极值 —— 散点图的参照基准 */
const realStats = computed(() => {
  const vals = okSegs.value.map((x) => x.real).filter((v): v is number => v != null)
  if (!vals.length) return null
  const n = vals.length
  const mean = vals.reduce((a, b) => a + b, 0) / n
  // 总体标准差：这里把已记录的段视为完整总体，不区分样本/总体
  const sd = Math.sqrt(vals.reduce((a, b) => a + (b - mean) ** 2, 0) / n)
  return {
    n,
    mean: round(mean),
    sd: round(sd),
    min: round(Math.min(...vals)),
    max: round(Math.max(...vals)),
    lo: round(mean - sd),
    hi: round(mean + sd)
  }
})

/** 图1：单次真实电耗散点 + 均值线 + ±1σ 带 */
const realScatterOption = computed(() => {
  const st = realStats.value
  if (!st) return {}
  return {
    grid: { left: 46, right: 18, top: 30, bottom: 26 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(20,28,24,0.9)',
      borderWidth: 0,
      textStyle: { color: '#fff', fontSize: 12 },
      formatter: (params: { dataIndex: number }[]) => {
        const d = okSegs.value[params[0]?.dataIndex]
        if (!d) return ''
        return `${d.dateFull}<br/>真实电耗 <b>${d.real}</b> kWh/100km<br/>该段里程 ${d.dM} km`
      }
    },
    xAxis: {
      type: 'category',
      data: okSegs.value.map((x) => x.dateShort),
      axisLine: { lineStyle: { color: '#e7ecea' } },
      axisTick: { show: false },
      axisLabel: { color: '#93a09a', fontSize: 10 }
    },
    yAxis: {
      type: 'value',
      // scale: true 让刻度贴合数据范围，而不是一律从 0 起。
      // 电耗值域在 15~24 之间，从 0 起会把波动压扁成一条直线。
      scale: true,
      name: 'kWh/100km',
      nameTextStyle: { color: '#93a09a', fontSize: 10 },
      axisLabel: { color: '#93a09a', fontSize: 10 },
      splitLine: { lineStyle: { color: '#eef2f0' } }
    },
    series: [
      {
        // 浅色背景带：均值 ± 1 个标准差，超出即视为偏离常态
        type: 'scatter',
        data: okSegs.value.map((x) => x.real),
        symbolSize: 9,
        itemStyle: { color: '#0fae8e', borderColor: '#fff', borderWidth: 1 },
        markArea: {
          silent: true,
          itemStyle: { color: 'rgba(15,174,142,0.08)' },
          data: [[{ yAxis: st.lo }, { yAxis: st.hi }]]
        },
        markLine: {
          silent: true,
          symbol: 'none',
          lineStyle: { color: '#0a8f74', type: 'dashed', width: 1.5 },
          label: {
            formatter: `均值 ${st.mean}`,
            position: 'insideEndTop',
            color: '#0a8f74',
            fontSize: 11
          },
          data: [{ yAxis: st.mean }]
        }
      }
    ]
  }
})

/** 图2：车显口径电耗（k×100）趋势 —— 反映车机标定是否在漂移 */
const dispOption = computed(() => {
  const list = okSegs.value.map((x) => x.disp).filter((v): v is number => v != null)
  const mean = list.length ? round(list.reduce((a, b) => a + b, 0) / list.length) : null
  return {
    grid: { left: 46, right: 18, top: 30, bottom: 26 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(20,28,24,0.9)',
      borderWidth: 0,
      textStyle: { color: '#fff', fontSize: 12 },
      formatter: (params: { dataIndex: number }[]) => {
        const d = okSegs.value[params[0]?.dataIndex]
        if (!d) return ''
        return `${d.dateFull}<br/>车显口径 <b>${d.disp}</b> kWh/100km<br/>真实口径 ${d.real} kWh/100km`
      }
    },
    xAxis: {
      type: 'category',
      data: okSegs.value.map((x) => x.dateShort),
      boundaryGap: false,
      axisLine: { lineStyle: { color: '#e7ecea' } },
      axisTick: { show: false },
      axisLabel: { color: '#93a09a', fontSize: 10 }
    },
    yAxis: {
      type: 'value',
      scale: true,
      name: 'kWh/100km',
      nameTextStyle: { color: '#93a09a', fontSize: 10 },
      axisLabel: { color: '#93a09a', fontSize: 10 },
      splitLine: { lineStyle: { color: '#eef2f0' } }
    },
    series: [
      {
        name: '车显口径',
        type: 'line',
        smooth: true,
        symbol: 'circle',
        symbolSize: 6,
        data: okSegs.value.map((x) => x.disp),
        lineStyle: { width: 2.5, color: '#6366f1' },
        itemStyle: { color: '#6366f1' },
        markLine:
          mean == null
            ? undefined
            : {
                silent: true,
                symbol: 'none',
                lineStyle: { color: '#6366f1', type: 'dashed', width: 1, opacity: 0.6 },
                label: {
                  formatter: `均值 ${mean}`,
                  position: 'insideEndTop',
                  color: '#6366f1',
                  fontSize: 11
                },
                data: [{ yAxis: mean }]
              }
      }
    ]
  }
})

/** 图3：电耗 vs 单段里程 */
const vsDistanceOption = computed(() => ({
  // bottom 留 42：x 轴需要容纳 轴标签 + 轴标题两行
  grid: { left: 46, right: 18, top: 24, bottom: 42 },
  tooltip: {
    trigger: 'item',
    backgroundColor: 'rgba(20,28,24,0.9)',
    borderWidth: 0,
    textStyle: { color: '#fff', fontSize: 12 },
    formatter: (p: { dataIndex: number }) => {
      const d = okSegs.value[p.dataIndex]
      if (!d) return ''
      return `${d.dateFull}<br/>该段里程 <b>${d.dM}</b> km<br/>真实电耗 <b>${d.real}</b> kWh/100km`
    }
  },
  xAxis: {
    type: 'value',
    name: '该段里程 km',
    nameLocation: 'middle',
    nameGap: 26,
    nameTextStyle: { color: '#93a09a', fontSize: 10 },
    axisLabel: { color: '#93a09a', fontSize: 10 },
    splitLine: { lineStyle: { color: '#eef2f0' } }
  },
  yAxis: {
    type: 'value',
    scale: true,
    name: 'kWh/100km',
    nameTextStyle: { color: '#93a09a', fontSize: 10 },
    axisLabel: { color: '#93a09a', fontSize: 10 },
    splitLine: { lineStyle: { color: '#eef2f0' } }
  },
  series: [
    {
      type: 'scatter',
      data: okSegs.value.map((x) => [x.dM, x.real]),
      symbolSize: 9,
      itemStyle: { color: '#0fae8e', borderColor: '#fff', borderWidth: 1 }
    }
  ]
}))

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
    <!-- 0) 单次充电分析 -->
    <section class="card">
      <div class="card-head">
        <div class="card-title"><Activity :size="17" class="ic ic-brand" />单次充电分析</div>
        <span v-if="realStats" class="tag">基于 {{ realStats.n }} 段完整记录</span>
      </div>

      <div v-if="!okSegs.length" class="empty">
        <div class="big"><Activity :size="30" class="ic" /></div>
        暂无数据齐全的充电段，无法逐次分析。<br />
        请在「记录」中补全里程与车显数据后查看。
      </div>

      <template v-else>
        <div class="summary-bar" style="margin-top:0;margin-bottom:14px">
          真实电耗均值 <b>{{ realStats?.mean }}</b> kWh/100km ·
          标准差 <b>{{ realStats?.sd }}</b> ·
          区间 <b>{{ realStats?.min }} ~ {{ realStats?.max }}</b> ·
          常态带 <b>{{ realStats?.lo }} ~ {{ realStats?.hi }}</b>
        </div>

        <div class="chart-card">
          <div class="chart-block" style="grid-column:1/-1">
            <div class="chart-title">单次真实电耗（含均值与 ±1σ 常态带）</div>
            <BaseChart :option="realScatterOption" />
            <p class="hint-text" style="margin-top:6px">
              每个点是一次充电对应的真实百公里电耗。落在浅色带内属正常波动；明显偏高的点多为高速 / 重载 / 空调工况，明显偏低则常与短途、或车显读数误差有关，可回查该条记录。
            </p>
          </div>

          <div class="chart-block">
            <div class="chart-title"><Gauge :size="14" class="ic ic-brand" />车显标定漂移（车显口径）</div>
            <BaseChart :option="dispOption" />
            <p class="hint-text" style="margin-top:6px">
              车显口径 = 本次充电度数 ÷ 车显续航增量 × 100，反映车机自己的「电量↔续航」标定。该线整体上移说明车显越来越虚——同样报能跑 100 km，实际要充更多电。
            </p>
          </div>

          <div class="chart-block">
            <div class="chart-title"><Ruler :size="14" class="ic ic-brand" />电耗 vs 单段里程</div>
            <BaseChart :option="vsDistanceOption" />
            <p class="hint-text" style="margin-top:6px">
              横轴是该段实际行驶里程。里程很短的段（点靠左）对车显读数误差最敏感，电耗容易失真，解读时请结合记录一并核对。
            </p>
          </div>
        </div>
      </template>
    </section>

    <!-- A) 家充 / 超充分组：仅当有 ≥2 类数据时才显示。
         少于 2 类时该分组没有区分度 —— 生产数据曾长期是 ctype 全为 fast
         （家充 0 条），卡片只剩一根柱子，且实际承担的是「按车辆」而非
         「按充电类型」的区分，容易误读为"快充这种方式的成本"。
         详见 docs/14-已知问题.md P13。 -->
    <section v-if="byType.length >= 2" class="card">
      <div class="card-head">
        <div class="card-title"><PieChart :size="17" class="ic ic-brand" />家充 / 超充分组统计</div>
      </div>

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
