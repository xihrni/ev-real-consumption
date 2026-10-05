<script setup lang="ts">
import { computed } from 'vue'
import { useAppStore } from '../store/useAppStore'
import { fmtTs, fmtNum, fmtDuration } from '../utils/format'
import type { ChargeSession, Segment } from '../types'
import { ClipboardList, Pencil, Trash2 } from 'lucide-vue-next'

const store = useAppStore()
const emit = defineEmits<{ edit: [string]; remove: [string] }>()

const items = computed(() => {
  const { segs, sorted } = store.computed
  return sorted.map((s, i) => ({ s, seg: segs[i] as Segment })).reverse()
})

function badgeText(st: Segment['status']) {
  return st === 'ok' ? '完整' : st === 'baseline' ? '基准' : st === 'pending' ? '待补全' : '异常'
}
function ctypeText(c?: string | null) {
  return c === 'home' ? '家充' : c === 'fast' ? '超充' : c === 'other' ? '其他' : '未分类'
}
function missing(s: ChargeSession) {
  const m: string[] = []
  if (s.M == null) m.push('当前里程')
  if (s.R_start == null) m.push('起始车显')
  if (s.R_end == null) m.push('结束车显')
  return m
}
</script>

<template>
  <section class="card">
    <div class="card-head">
      <div class="card-title"><ClipboardList :size="17" class="ic ic-brand" />充电记录</div>
      <span class="tag">{{ store.sessions.length }} 条</span>
    </div>

    <div v-if="!items.length" class="empty">
      <div class="big"><ClipboardList :size="30" class="ic" /></div>
      还没有记录，先在上方新增一条充电账单。
    </div>

    <transition-group v-else name="list" tag="div">
      <div v-for="it in items" :key="it.s.id" class="rec">
        <div class="top">
          <span class="ts">{{ fmtTs(it.s.ts) }}</span>
          <span class="badge" :class="it.seg.status">{{ badgeText(it.seg.status) }}</span>
        </div>
        <div class="meta">
          度数 {{ fmtNum(it.s.E) }} kWh · 时长 {{ fmtDuration(it.s.T) }} · 金额
          {{ fmtNum(it.s.C) }} 元
          <span class="ctype-tag" :class="'ct-' + (it.s.ctype || 'other')">{{ ctypeText(it.s.ctype) }}</span>
          <span v-if="missing(it.s).length" class="miss"> · 缺 {{ missing(it.s).join('/') }}</span>
        </div>
        <div v-if="it.s.note" class="note-line"><Pencil :size="12" class="ic ic-sub" />{{ it.s.note }}</div>

        <div v-if="it.seg.status === 'ok'" class="metrics">
          <span>真实电耗 <b>{{ it.seg.real }}</b> kWh/100km</span>
          <span>均价 <b>{{ it.seg.price }}</b> 元</span>
          <span>表显 <b>{{ it.seg.disp }}</b></span>
          <span>功率 <b>{{ it.seg.power }}</b> kW</span>
        </div>
        <div v-else-if="it.seg.status === 'baseline'" class="metrics">
          <span style="color: var(--brand-strong)">基准记录：已记录起点，本段消耗从下一段开始测算</span>
        </div>
        <div v-else-if="it.seg.status === 'pending'" class="metrics">
          <span class="miss">缺里程 / 车显数据，点「补全」后可测算</span>
        </div>
        <div v-else class="why">
          <div v-for="(w, i) in it.seg.why" :key="i">• {{ w }}</div>
        </div>

        <div class="actions">
          <button class="btn-sec sm" style="padding:6px 12px;font-size:13px" @click="emit('edit', it.s.id)">
            <Pencil :size="14" class="ic" />补全 / 编辑
          </button>
          <button class="btn-danger sm" style="padding:6px 12px;font-size:13px" @click="emit('remove', it.s.id)">
            <Trash2 :size="14" class="ic" />删除
          </button>
        </div>
      </div>
    </transition-group>
  </section>
</template>
