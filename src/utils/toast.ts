import { reactive } from 'vue'

export interface ToastItem {
  id: number
  msg: string
  type: 'info' | 'success' | 'error'
}

export const toasts = reactive<ToastItem[]>([])
let seq = 0

export function toast(msg: string, type: ToastItem['type'] = 'info', duration = 2200) {
  const id = ++seq
  toasts.push({ id, msg, type })
  setTimeout(() => {
    const idx = toasts.findIndex((t) => t.id === id)
    if (idx >= 0) toasts.splice(idx, 1)
  }, duration)
}
