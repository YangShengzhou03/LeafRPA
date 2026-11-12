<script setup lang="ts">
import { computed, ref } from 'vue'
import { Search } from '@element-plus/icons-vue'
import PageShell from '../components/PageShell.vue'

const keyword = ref('')
const activeNames = ref<string[]>(['快速上手'])

interface Faq {
  group: string
  q: string
  a: string
}

const faqs: Faq[] = [
  {
    group: '快速上手',
    q: '如何创建第一个自动化应用？',
    a: '点击左侧「新建」按钮，选择 PC 或手机自动化应用即可进入设计器。在设计器中依次添加指令、连接步骤，然后点击「运行」即可执行。',
  },
  {
    group: '快速上手',
    q: '流程设计完成后如何保存？',
    a: '流程会在你修改后自动保存（约 1 秒防抖）。点击顶部「运行」旁边的保存按钮也可以立即保存，保存状态会显示在底部日志栏。',
  },
  {
    group: '快速上手',
    q: '如何采集网页元素？',
    a: '在设计器工具栏点击「智能录制」，然后在目标网页上依次点击需要采集的元素，采集完成后回到设计器点击「结束录制」，系统会自动生成对应的「获取元素」指令。',
  },
  {
    group: '触发器',
    q: '触发器支持哪些触发方式？',
    a: '目前支持「定时触发」（每天固定时间）、「循环触发」（按秒级间隔重复）与「手动触发」（仅在应用内点击运行时触发）三种方式。',
  },
  {
    group: '触发器',
    q: '定时触发器没有按时执行怎么办？',
    a: '请确认应用窗口处于打开状态（调度器在前台运行）、触发器处于启用状态，并且设置的时间晚于当前时间。可在触发器页查看「下次执行」提示进行核对。',
  },
  {
    group: '数据与存储',
    q: '流程数据保存在哪里？',
    a: '流程以 JSON 形式保存在本机应用数据目录，仅保存在你的电脑上，不会自动上传到云端。可在「设置 → 数据与存储」中查看具体路径。',
  },
  {
    group: '数据与存储',
    q: '如何备份或迁移我的流程？',
    a: '在应用列表页选中流程后点击「导出」，会得到一份 JSON 文件；在另一台设备上进入同一页面点击「导入」即可恢复。',
  },
  {
    group: '子流程',
    q: '什么是子流程？如何使用？',
    a: '子流程是一种可复用的「自定义指令」。在应用列表页新建「自定义指令」并设计其步骤，然后在任意流程中添加「子流程」指令并选择它，运行时会自动执行子流程的步骤。',
  },
]

const groups = computed(() => Array.from(new Set(faqs.map((f) => f.group))))

const filtered = computed(() => {
  const kw = keyword.value.trim().toLowerCase()
  if (!kw) return faqs
  return faqs.filter(
    (f) =>
      f.q.toLowerCase().includes(kw) ||
      f.a.toLowerCase().includes(kw) ||
      f.group.toLowerCase().includes(kw),
  )
})
</script>

<template>
  <PageShell title="帮助中心" kicker="使用指南" sub="常见问题解答与使用指南">
    <div class="help-layout">
      <div class="help-main">
        <template v-if="filtered.length">
          <section v-for="g in groups" :key="g" class="sec-card faq-group">
            <div class="sec-card-head">
              <h2 class="sec-title">{{ g }}</h2>
              <span class="sec-meta">
                {{ filtered.filter((x) => x.group === g).length }} 个问题
              </span>
            </div>
            <el-collapse v-model="activeNames" class="faq-collapse">
              <el-collapse-item
                v-for="f in filtered.filter((x) => x.group === g)"
                :key="f.q"
                :title="f.q"
                :name="f.q"
              >
                <p class="faq-answer">{{ f.a }}</p>
              </el-collapse-item>
            </el-collapse>
          </section>
        </template>
        <el-empty
          v-else
          :image-size="96"
          description="没有找到匹配的问题，换个关键词试试"
        />
      </div>

      <aside class="help-side">
        <div class="help-search">
          <el-input v-model="keyword" placeholder="搜索问题关键词" clearable>
            <template #prefix>
              <el-icon><Search /></el-icon>
            </template>
          </el-input>
        </div>

        <section class="sec-card">
          <h2 class="sec-title">使用统计</h2>
          <div class="sec-rows">
            <div class="sec-row">
              <span class="sec-row-label">常见问题</span>
              <span class="sec-row-value">{{ faqs.length }} 篇</span>
            </div>
            <div class="sec-row">
              <span class="sec-row-label">问题分组</span>
              <span class="sec-row-value">{{ groups.length }} 个</span>
            </div>
          </div>
        </section>
      </aside>
    </div>
  </PageShell>
</template>

<style scoped>
.help-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 16px;
  align-items: start;
}

.help-main {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.faq-group {
  padding-bottom: 6px;
}

.faq-collapse {
  margin-top: 8px;
  --el-collapse-header-height: 48px;
  border: none;
}

.faq-collapse :deep(.el-collapse-item__header) {
  border-bottom: 1px solid var(--border);
  background: transparent;
  font-size: 13px;
  font-weight: 500;
  color: var(--text);
}

.faq-collapse :deep(.el-collapse-item__wrap) {
  border-bottom: 1px solid var(--border);
  background: transparent;
}

.faq-collapse :deep(.el-collapse-item__content) {
  padding: 12px 0 16px;
  color: var(--text-2);
}

.faq-collapse :deep(.el-collapse-item:last-child .el-collapse-item__header),
.faq-collapse :deep(.el-collapse-item:last-child .el-collapse-item__wrap) {
  border-bottom: none;
}

.faq-answer {
  margin: 0;
  font-size: 13px;
  color: var(--text-2);
  line-height: 1.8;
}

.help-side {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
</style>
