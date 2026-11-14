<script setup lang="ts">
import { t } from '../i18n'
import PageShell from '../components/PageShell.vue'

/*
 * 消息中心：服务端暂未提供公告接口，此处仅展示空态与说明文案。
 * 接入公告后端后，在此拉取真实公告数据并渲染列表。
 */
</script>

<template>
  <PageShell :title="t('notice.title')" :kicker="t('notice.kicker')" :sub="t('notice.sub')">
    <div class="notice-wrap">
      <section class="sec-card notice-card">
        <el-empty :image-size="96" :description="t('notice.empty')" />
        <p class="sec-meta notice-hint">{{ t('notice.hint') }}</p>
      </section>
    </div>
  </PageShell>
</template>

<style scoped>
.notice-card {
  padding: 36px 20px;
}

.notice-card:hover {
  box-shadow: none;
}

.notice-hint {
  margin: 0;
  text-align: center;
}
</style>
