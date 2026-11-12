<script setup lang="ts">
import { useAppStore } from '../store'
import { Pointer, MagicStick, Memo, Iphone, Picture, Clock, VideoPlay, Trophy } from '@element-plus/icons-vue'
import collageImg from '../assets/collage.png'
import mascotImg from '../assets/mascot.png'
import ringImg from '../assets/ring.png'

const store = useAppStore()

const templates = [
  { key: 'web', name: '网页自动化', desc: '打开网页、点击、填表、抓取数据', icon: Pointer, cls: 't1', type: 'pc' as const },
  { key: 'desktop', name: '桌面自动化', desc: '操作本地软件、模拟输入、图像识别', icon: MagicStick, cls: 't2', type: 'pc' as const },
  { key: 'data', name: '数据处理', desc: 'Excel、JSON、文本处理与变量计算', icon: Memo, cls: 't3', type: 'pc' as const },
  { key: 'mobile', name: '手机自动化', desc: '连接移动设备执行点击与滑动', icon: Iphone, cls: 't4', type: 'mobile' as const },
  { key: 'excel', name: 'Excel 处理', desc: '读写表格、批量处理与汇总', icon: Picture, cls: 't5', type: 'pc' as const },
  { key: 'schedule', name: '定时任务', desc: '按计划自动执行流程', icon: Clock, cls: 't6', type: 'pc' as const },
]

const openTemplate = (tpl: { name: string; type: 'pc' | 'mobile' }) => {
  store.createAndOpen(tpl.name, tpl.type)
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
          <div class="hi">Hi~ 欢迎使用轻羽 RPA</div>
          <h1 class="hero-title">
            我们不担心机器像人一样聪明，<br />
            但怕人像机器一样工作。
          </h1>

          <div class="promo-cards">
            <div class="promo-card promo-a">
              <div class="promo-media">
                <img class="ring-img" :src="ringImg" alt="轻羽RPA" />
                <el-tooltip content="了解轻羽" placement="top" :show-after="300">
                  <button class="play-btn" @click="goTutorial">
                    <el-icon :size="11" color="#fff"><VideoPlay /></el-icon>
                  </button>
                </el-tooltip>
              </div>
              <div class="promo-body">
                <div class="promo-sub">人不应该像机器一样工作</div>
                <div class="promo-title">把枯燥的事情交给轻羽</div>
                <button class="promo-btn" @click="goTutorial">
                  <el-icon :size="13"><VideoPlay /></el-icon>
                  3分钟了解轻羽
                </button>
              </div>
            </div>

            <div class="promo-card promo-b">
              <div class="promo-media">
                <img class="mascot-img" :src="mascotImg" alt="轻羽机器人" />
              </div>
              <div class="promo-body">
                <div class="promo-sub">成为轻羽「RPA开发专家」</div>
                <div class="promo-title">玩着学轻羽，改变自己</div>
                <button class="promo-btn" @click="goTutorial">
                  <el-icon :size="13"><Trophy /></el-icon>
                  开始闯关学习
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="hero-right">
          <img class="collage-img" :src="collageImg" alt="用户故事" />
        </div>
      </div>

      <div class="templates">
        <div class="templates-sub">自动化触手可及</div>
        <h2 class="templates-title">让人生的美好在这里开始</h2>
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
            <div class="tpl-name">{{ tpl.name }}</div>
            <div class="tpl-desc">{{ tpl.desc }}</div>
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
