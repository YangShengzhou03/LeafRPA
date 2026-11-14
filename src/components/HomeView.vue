<script setup lang="ts">
import { useAppStore } from '../store'
import { Pointer, MagicStick, Memo, Iphone, Picture, Clock, VideoPlay, Trophy } from '@element-plus/icons-vue'
import collageImg from '../assets/collage.png'
import mascotImg from '../assets/mascot.png'
import ringImg from '../assets/ring.png'
import { t, type MessageKey } from '../i18n'

const store = useAppStore()

const templates: { key: string; name: MessageKey; desc: MessageKey; icon: any; cls: string; type: 'pc' | 'mobile' }[] = [
  { key: 'web', name: 'home.tpl.web.name', desc: 'home.tpl.web.desc', icon: Pointer, cls: 't1', type: 'pc' },
  { key: 'desktop', name: 'home.tpl.desktop.name', desc: 'home.tpl.desktop.desc', icon: MagicStick, cls: 't2', type: 'pc' },
  { key: 'data', name: 'home.tpl.data.name', desc: 'home.tpl.data.desc', icon: Memo, cls: 't3', type: 'pc' },
  { key: 'mobile', name: 'home.tpl.mobile.name', desc: 'home.tpl.mobile.desc', icon: Iphone, cls: 't4', type: 'mobile' },
  { key: 'excel', name: 'home.tpl.excel.name', desc: 'home.tpl.excel.desc', icon: Picture, cls: 't5', type: 'pc' },
  { key: 'schedule', name: 'home.tpl.schedule.name', desc: 'home.tpl.schedule.desc', icon: Clock, cls: 't6', type: 'pc' },
]

const openTemplate = (tpl: { name: MessageKey; type: 'pc' | 'mobile' }) => {
  store.createAndOpen(t(tpl.name), tpl.type)
}

const goTutorial = () => {
  store.setTab('tutorial')
}
</script>

<template>
  <section class="home">
    <div class="home-inner">
      <div class="hero">
        <div class="hero-left">
          <div class="hi">{{ t('home.greeting') }}</div>
          <h1 class="hero-title">
            {{ t('home.heroTitle1') }}<br />
            {{ t('home.heroTitle2') }}
          </h1>

          <div class="promo-cards">
            <div class="promo-card promo-a">
              <div class="promo-media">
                <img class="ring-img" :src="ringImg" :alt="t('app.name')" />
                <el-tooltip :content="t('home.knowTip')" placement="top" :show-after="300">
                  <button class="play-btn" @click="goTutorial">
                    <el-icon :size="11" color="#fff"><VideoPlay /></el-icon>
                  </button>
                </el-tooltip>
              </div>
              <div class="promo-body">
                <div class="promo-sub">{{ t('home.promoAsub') }}</div>
                <div class="promo-title">{{ t('home.promoAtitle') }}</div>
                <button class="promo-btn" @click="goTutorial">
                  <el-icon :size="13"><VideoPlay /></el-icon>
                  {{ t('home.promoAbtn') }}
                </button>
              </div>
            </div>

            <div class="promo-card promo-b">
              <div class="promo-media">
                <img class="mascot-img" :src="mascotImg" :alt="t('home.botAlt')" />
              </div>
              <div class="promo-body">
                <div class="promo-sub">{{ t('home.promoBsub') }}</div>
                <div class="promo-title">{{ t('home.promoBtitle') }}</div>
                <button class="promo-btn" @click="goTutorial">
                  <el-icon :size="13"><Trophy /></el-icon>
                  {{ t('home.promoBbtn') }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="hero-right">
          <img class="collage-img" :src="collageImg" :alt="t('home.storiesAlt')" />
        </div>
      </div>

      <div class="templates">
        <div class="templates-sub">{{ t('home.templatesSub') }}</div>
        <h2 class="templates-title">{{ t('home.templatesTitle') }}</h2>
        <div class="template-row">
          <div
            v-for="tpl in templates"
            :key="tpl.key"
            class="template-card"
            :class="tpl.cls"
            role="button"
            tabindex="0"
            @click="openTemplate(tpl)"
            @keydown.enter="openTemplate(tpl)"
          >
            <div class="tpl-icon"><el-icon :size="24"><component :is="tpl.icon" /></el-icon></div>
            <div class="tpl-name">{{ t(tpl.name) }}</div>
            <div class="tpl-desc">{{ t(tpl.desc) }}</div>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.template-card:focus-visible {
  outline: 2px solid var(--accent);
  outline-offset: 2px;
}
</style>
