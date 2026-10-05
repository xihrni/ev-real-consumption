<script setup lang="ts">
import { ref, computed } from 'vue'
import { useAppStore } from '../store/useAppStore'
import { BatteryCharging, LogIn, UserPlus, Mail, Lock } from 'lucide-vue-next'

const store = useAppStore()
const mode = ref<'login' | 'register'>('login')
const email = ref('')
const password = ref('')
const errors = ref<{ email?: string; password?: string }>({})
const loading = ref(false)

const isRegister = computed(() => mode.value === 'register')

function validEmail(v: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim())
}

async function submit() {
  errors.value = {}
  if (!validEmail(email.value)) errors.value.email = '请输入有效的邮箱'
  if (password.value.length < 6) errors.value.password = '密码至少 6 位'
  if (Object.keys(errors.value).length) return
  loading.value = true
  const ok = isRegister.value
    ? await store.register(email.value, password.value)
    : await store.login(email.value, password.value)
  loading.value = false
  if (ok) {
    email.value = ''
    password.value = ''
  }
}
</script>

<template>
  <div class="auth-wrap">
    <div class="auth-inner">
      <div class="auth-hero">
        <span class="auth-logo"><BatteryCharging :size="26" :stroke-width="2.4" color="#fff" /></span>
        <h1>真实电耗记录</h1>
        <p>记录每次充电，算清真实电耗</p>
      </div>

      <section class="card auth-card">
        <div class="seg-control plain auth-seg">
          <button :class="{ on: !isRegister }" @click="mode = 'login'; store.clearAuthError()">
            <LogIn :size="15" class="ic" />登录
          </button>
          <button :class="{ on: isRegister }" @click="mode = 'register'; store.clearAuthError()">
            <UserPlus :size="15" class="ic" />注册
          </button>
        </div>

        <div class="field" style="margin-top: 14px">
          <label><Mail :size="13" class="ic ic-sub" />邮箱</label>
          <input
            v-model="email"
            type="email"
            autocomplete="email"
            placeholder="you@example.com"
            :class="{ invalid: errors.email }"
            @input="store.clearAuthError()"
          />
          <span v-if="errors.email" class="err">{{ errors.email }}</span>
        </div>

        <div class="field">
          <label><Lock :size="13" class="ic ic-sub" />密码</label>
          <input
            v-model="password"
            type="password"
            :autocomplete="isRegister ? 'new-password' : 'current-password'"
            placeholder="至少 6 位"
            :class="{ invalid: errors.password }"
            @input="store.clearAuthError()"
            @keyup.enter="submit"
          />
          <span v-if="errors.password" class="err">{{ errors.password }}</span>
        </div>

        <p v-if="store.authError" class="auth-err" role="alert" aria-live="assertive">{{ store.authError }}</p>

        <div class="btn-row end">
          <button class="block" :disabled="loading" @click="submit">
            {{ loading ? '处理中…' : (isRegister ? '创建账号' : '登录') }}
          </button>
        </div>
        <p class="hint-text">
          {{ isRegister
            ? '注册后将获得独立账号，数据云端同步、可在其他设备登录访问。'
            : '登录后查看你的车辆与充电记录。' }}
        </p>
      </section>
    </div>
  </div>
</template>

<style scoped>
/* 登录/注册页：顶部铺品牌渐变。
   .auth-hero 里的图标与标题是白色，之前没有底色（--bg-grad 定义了却从未使用），
   白字白图标直接落在浅灰 --bg 上，几乎看不见 —— 这里把渐变补上。 */
.auth-wrap {
  min-height: 100vh;
  min-height: 100dvh;
  background: var(--brand-grad);
  padding: calc(env(safe-area-inset-top, 0px) + 32px) 16px 28px;
}
.auth-inner {
  max-width: 420px;
  margin: 0 auto;
}
.auth-hero {
  text-align: center;
  color: #fff;
  margin-bottom: 20px;
}
.auth-logo {
  width: 56px;
  height: 56px;
  border-radius: 17px;
  background: rgba(255, 255, 255, 0.22);
  border: 1px solid rgba(255, 255, 255, 0.3);
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 6px 18px rgba(0, 0, 0, 0.18);
}
.auth-logo svg {
  /* 图标本身也提亮，避免白图标在半透明白底上发灰 */
  stroke: #fff;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.25));
}
.auth-hero h1 {
  font-size: 22px;
  font-weight: 800;
  margin: 15px 0 5px;
  text-shadow: 0 1px 3px rgba(0, 0, 0, 0.18);
}
.auth-hero p {
  font-size: 13.5px;
  /* 原为 opacity: 0.9，白字在浅色渐变上偏弱，改用带透明度的纯白 */
  color: rgba(255, 255, 255, 0.95);
  margin: 0;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.15);
}
.auth-card {
  box-shadow: 0 10px 30px rgba(9, 68, 55, 0.22);
}
.auth-err {
  margin: 12px 0 0;
  padding: 9px 12px;
  border-radius: 10px;
  font-size: 13px;
  line-height: 1.5;
  text-align: center;
  color: #a32d2d;
  background: #fcebeb;
  border: 1px solid rgba(163, 45, 45, 0.28);
}
.auth-seg button {
  flex: 1;
  justify-content: center;
}
/* 桌面端：卡片居中，两侧留白处同样保持品牌底色 */
@media (min-width: 900px) {
  .auth-wrap {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 40px 24px;
  }
  .auth-inner { width: 100%; }
  .auth-hero h1 { font-size: 25px; }
  .auth-hero p { font-size: 14.5px; }
  .auth-logo { width: 62px; height: 62px; border-radius: 19px; }
}
</style>
