<script setup lang="ts">
import { computed } from 'vue'
import { useAppStore } from '../store'
import { toastSuccess } from '../notify'
import PageShell from '../components/PageShell.vue'

const store = useAppStore()

interface Plan {
  key: string
  name: string
  price: string
  period: string
  quota: string
  highlight: boolean
  features: string[]
}

const plans: Plan[] = [
  {
    key: 'starter',
    name: '创业版',
    price: '免费',
    period: '永久',
    quota: '每日 100 次运行',
    highlight: false,
    features: ['网页自动化指令', '桌面自动化指令', '定时 / 循环触发器', '社区支持'],
  },
  {
    key: 'pro',
    name: '专业版',
    price: '¥39',
    period: '每月',
    quota: '每日 2000 次运行',
    highlight: true,
    features: [
      '包含创业版全部能力',
      '子流程与智能录制',
      'Python 代码节点',
      '优先邮件支持',
      '数据导出 / 导入',
    ],
  },
  {
    key: 'ultimate',
    name: '旗舰版',
    price: '¥99',
    period: '每月',
    quota: '不限次数运行',
    highlight: false,
    features: [
      '包含专业版全部能力',
      '多设备同步',
      '专属客户成功经理',
      '私有化部署支持',
      '定制指令开发',
    ],
  },
]

const currentPlan = computed(() => plans[0])

const usagePercent = computed(() => {
  const flows = store.flows.length
  return Math.min(100, Math.round((flows / 10) * 100))
})

function upgrade(plan: Plan) {
  if (plan.key === currentPlan.value.key) {
    toastSuccess('你当前正在使用该套餐')
    return
  }
  store.navigate('service')
}
</script>

<template>
  <PageShell title="增值服务" kicker="会员套餐" sub="选择适合你的套餐，获得更高的运行额度与更多能力">
    <div class="vip-layout">
      <div class="plan-grid">
        <section
          v-for="p in plans"
          :key="p.key"
          class="sec-card plan-card"
          :class="{ highlight: p.highlight }"
        >
          <div v-if="p.highlight" class="plan-flag">推荐</div>
          <div class="plan-head">
            <div class="plan-name">{{ p.name }}</div>
            <span v-if="currentPlan.key === p.key" class="sec-meta">当前套餐</span>
          </div>
          <div class="plan-price">
            <span class="plan-amount">{{ p.price }}</span>
            <span class="sec-meta">{{ p.period }}</span>
          </div>
          <div class="plan-quota">{{ p.quota }}</div>
          <ul class="plan-features">
            <li v-for="f in p.features" :key="f">{{ f }}</li>
          </ul>
          <el-button v-if="p.key === currentPlan.key" class="plan-btn" disabled>
            当前套餐
          </el-button>
          <el-button
            v-else
            class="plan-btn"
            :type="p.highlight ? 'primary' : 'default'"
            plain
            @click="upgrade(p)"
          >
            联系客服开通
          </el-button>
        </section>
      </div>

      <aside class="vip-side">
        <section class="sec-card">
          <h2 class="sec-title">当前额度</h2>
          <div class="usage-body">
            <el-progress :percentage="usagePercent" :stroke-width="10" />
            <div class="sec-meta">
              已创建 {{ store.flows.length }} 个流程，占用今日额度 {{ usagePercent }}%
            </div>
          </div>
        </section>

        <section class="sec-card">
          <h2 class="sec-title">开通说明</h2>
          <ol class="steps">
            <li class="step">
              <span class="step-no">1</span>
              <div class="step-name">提交申请</div>
              <div class="step-desc">点击套餐上的「联系客服开通」，我们会生成一份开通申请</div>
            </li>
            <li class="step">
              <span class="step-no">2</span>
              <div class="step-name">客服确认</div>
              <div class="step-desc">客服会在 1 个工作日内与你确认套餐与支付方式</div>
            </li>
            <li class="step">
              <span class="step-no">3</span>
              <div class="step-name">生效</div>
              <div class="step-desc">完成支付后，新额度会立即生效并发送通知</div>
            </li>
          </ol>
        </section>
      </aside>
    </div>
  </PageShell>
</template>

<style scoped>
.vip-layout {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 300px;
  gap: 16px;
  align-items: start;
}

.plan-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
}

.plan-card {
  position: relative;
  display: flex;
  flex-direction: column;
  padding: 20px;
}

.plan-card.highlight {
  border-color: var(--accent);
}

.plan-flag {
  position: absolute;
  top: -1px;
  right: 16px;
  padding: 2px 10px;
  border-radius: 0 0 6px 6px;
  background: var(--accent);
  color: var(--el-color-white);
  font-size: 11px;
}

.plan-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.plan-name {
  font-size: 16px;
  font-weight: 600;
  color: var(--text);
}

.plan-price {
  margin-top: 12px;
  display: flex;
  align-items: baseline;
  gap: 4px;
}

.plan-amount {
  font-size: 26px;
  font-weight: 600;
  color: var(--text);
}

.plan-card.highlight .plan-amount {
  color: var(--accent);
}

.plan-quota {
  margin-top: 6px;
  font-size: 12px;
  color: var(--text-2);
}

.plan-features {
  list-style: none;
  margin: 14px 0 16px;
  padding: 12px 0 0;
  border-top: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  gap: 8px;
  flex: 1;
}

.plan-features li {
  position: relative;
  padding-left: 16px;
  font-size: 13px;
  color: var(--text-2);
  line-height: 1.5;
}

.plan-features li::before {
  content: '✓';
  position: absolute;
  left: 0;
  color: var(--accent);
}

.plan-btn {
  width: 100%;
}

.vip-side {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.usage-body {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: 12px;
}
</style>
