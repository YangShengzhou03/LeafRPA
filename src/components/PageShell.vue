<script setup lang="ts">
defineProps<{ title: string; sub?: string; kicker?: string }>()
</script>

<template>
  <div class="page">
    <div class="page-head">
      <div class="page-head-main">
        <div v-if="kicker" class="page-kicker">{{ kicker }}</div>
        <h1 class="page-title">{{ title }}</h1>
        <p v-if="sub" class="page-sub">{{ sub }}</p>
      </div>
      <div class="page-actions">
        <slot name="actions" />
      </div>
    </div>
    <slot />
  </div>
</template>
