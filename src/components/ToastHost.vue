<script setup lang="ts">
import { toasts } from '../utils/toast'
</script>

<template>
  <div class="toast-host">
    <transition-group name="fade">
      <div v-for="t in toasts" :key="t.id" class="toast" :class="t.type">{{ t.msg }}</div>
    </transition-group>
  </div>
</template>
