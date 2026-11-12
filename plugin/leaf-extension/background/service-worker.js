/**
 * 轻羽RPA 网页自动化插件 - Background Service Worker (MV3)
 * 传输层：Native Messaging 端口直连（Chrome 110+ 开放的 native 端口可保持 SW 常驻，
 * 避免 HTTP 长轮询在 SW 休眠后断开导致指令无人消费的竞态）。
 *
 * 链路：桌面端 → native-host HTTP(127.0.0.1:19836) → native 管道 → 本 SW → content.js → 页面
 * SW → 宿主的结果也走 native 管道回传。
 *
 * 注意：宿主只应存在一个实例（由 Chrome 拉起，独占 HTTP 端口）。桌面端不要自行 spawn 宿主，
 * 否则会抢占 19836 端口导致 Chrome 的宿主绑定失败、native 管道断开。
 */

const HOST_NAME = 'com.leafrpa.browser'
const HOST_STATE = {
  port: null,
  status: 'disconnected', // disconnected | connecting | connected
  wantConnect: false,
  lastError: '',
}

/* ---------------- Native Messaging 连接 ---------------- */

function setHostStatus(status, error = '') {
  HOST_STATE.status = status
  HOST_STATE.lastError = error
}

/**
 * 建立 native 连接。重复调用安全：已连接直接返回，连接中复用同一 Promise。
 * 返回 port；失败时抛出异常（不静默吞掉，便于排查"宿主未安装/未授权"）。
 */
function connectNative() {
  if (HOST_STATE.port) return Promise.resolve(HOST_STATE.port)
  if (HOST_STATE._connecting) return HOST_STATE._connecting
  HOST_STATE.wantConnect = true
  setHostStatus('connecting')
  HOST_STATE._connecting = new Promise((resolve, reject) => {
    let port
    try {
      port = chrome.runtime.connectNative(HOST_NAME)
    } catch (err) {
      HOST_STATE._connecting = null
      setHostStatus('disconnected', String(err?.message ?? err))
      console.error('[leaf] native host 连接失败:', err)
      reject(err)
      return
    }
    const onDisconnect = (reason) => {
      if (HOST_STATE.port !== port) return
      HOST_STATE.port = null
      HOST_STATE._connecting = null
      setHostStatus('disconnected', reason || chrome.runtime.lastError?.message || '')
      console.warn('[leaf] native host 断开:', HOST_STATE.lastError)
      scheduleReconnect()
    }
    // connectNative 同步抛错表示宿主不可用；异步断开后 onDisconnect 触发
    port.onDisconnect.addListener(() => onDisconnect())
    port.onMessage.addListener(onNativeMessage)
    HOST_STATE.port = port
    HOST_STATE._connecting = null
    setHostStatus('connected')
    resolve(port)
  })
  return HOST_STATE._connecting
}

let reconnectTimer = null
function scheduleReconnect() {
  if (!HOST_STATE.wantConnect) return
  if (reconnectTimer) return
  reconnectTimer = setTimeout(() => {
    reconnectTimer = null
    if (!HOST_STATE.port && HOST_STATE.wantConnect) connectNative().catch(() => {})
  }, 3000)
}

/** 宿主下发的指令：{ type: 'leaf:exec', id, payload: { type, payload } } */
function onNativeMessage(msg) {
  if (!msg || typeof msg !== 'object') return
  if (msg.type === 'leaf:exec') {
    handleHostCommand(msg)
  } else {
    console.log('[leaf] host 消息:', msg)
  }
}

/** 执行并把结果经 native 管道回传宿主 */
async function handleHostCommand(msg) {
  const { id, payload } = msg || {}
  const cmdType = payload?.type
  const cmdPayload = payload?.payload ?? {}
  try {
    const data = await dispatch({ type: cmdType, payload: cmdPayload })
    postToNative({ type: 'leaf:result', id, ok: true, data })
  } catch (err) {
    postToNative({ type: 'leaf:result', id, ok: false, error: String(err?.message ?? err) })
  }
}

function postToNative(msg) {
  const port = HOST_STATE.port
  if (!port) return
  try {
    port.postMessage(msg)
  } catch (err) {
    console.warn('[leaf] 发送到 host 失败:', err)
  }
}

/* ---------------- 指令分发 ---------------- */

/** SW 自己处理（不经 content script）的标签页/窗口级指令 */
const PAGE_HANDLERS = {
  'leaf:page-open': handlePageOpen,
  'leaf:page-close': handlePageClose,
  'leaf:page-list': handlePageList,
  'leaf:page-activate': handlePageActivate,
  'leaf:ensure-chrome': handleEnsureChrome,
}

async function dispatch(payload) {
  const swHandler = PAGE_HANDLERS[payload.type]
  return swHandler ? swHandler(payload.payload ?? {}) : execInTab(payload, payload.tabId)
}

/* ---------------- 标签页 / 窗口级指令（SW 直接执行） ---------------- */

/** { url, active? } → 打开新标签；url 已打开时复用该标签。返回 { tabId, url } */
async function handlePageOpen(p) {
  const url = String(p.url ?? '').trim()
  if (!url) throw new Error('缺少 url 参数')
  const active = p.active !== false
  const tabs = await chrome.tabs.query({})
  const existing = tabs.find((t) => t.url === url || t.pendingUrl === url)
  if (existing?.id != null) {
    const updated = await chrome.tabs.update(existing.id, { active })
    return { tabId: updated.id, url: updated.url ?? url, reused: true }
  }
  const tab = await chrome.tabs.create({ url, active })
  return { tabId: tab.id, url, reused: false }
}

/** { tabId? } → 无 tabId 时关闭当前活动标签 */
async function handlePageClose(p) {
  const tabId = Number(p.tabId ?? 0)
  if (tabId) {
    await chrome.tabs.remove(tabId)
    return { closed: tabId }
  }
  const tab = await getActiveTab()
  if (!tab?.id) throw new Error('没有可关闭的标签页')
  await chrome.tabs.remove(tab.id)
  return { closed: tab.id }
}

/** {} → [{id,title,url,active}]（仅 http/https） */
async function handlePageList() {
  const tabs = await chrome.tabs.query({})
  return {
    tabs: tabs
      .filter((t) => /^https?:/.test(t.url ?? ''))
      .map((t) => ({ id: t.id, title: t.title ?? '', url: t.url ?? '', active: !!t.active })),
  }
}

/** {} → 激活浏览器窗口 */
async function handlePageActivate() {
  const win = await chrome.windows.getLastFocused()
  if (win?.id != null) await chrome.windows.update(win.id, { focused: true })
  return { ok: true }
}

/**
 * {} → 确保浏览器窗口存在。Chrome 未运行/无窗口时打开一个空白标签页。
 * 桌面端在需要"启动 Chrome"时调用。
 */
async function handleEnsureChrome() {
  const tabs = await chrome.tabs.query({})
  const blank = tabs.find((t) => /^(chrome|newtab|about):/i.test(t.url ?? '') || t.status === 'loading')
  if (blank?.id != null) {
    await chrome.tabs.update(blank.id, { active: true })
    return { ok: true, reused: true, tabId: blank.id }
  }
  const tab = await chrome.tabs.create({ url: 'chrome://newtab', active: true })
  return { ok: true, reused: false, tabId: tab.id }
}

/* ---------------- 标签页指令执行 ---------------- */

/**
 * 在指定标签页（默认当前活动标签）执行网页动作。
 * payload: { type: 'leaf:click', payload: {...} }
 */
async function execInTab(payload, tabId) {
  const tab = tabId ? await chrome.tabs.get(tabId) : await getActiveTab()
  if (!tab?.id) throw new Error('没有可用的标签页')
  // content script 可能尚未注入（页面刚打开/刷新中），失败后兜底注入再试
  try {
    return await chrome.tabs.sendMessage(tab.id, payload)
  } catch (err) {
    if (tab.url && /^https?:/.test(tab.url)) {
      await chrome.scripting.executeScript({ target: { tabId: tab.id, allFrames: true }, files: ['content/content.js'] })
      return await chrome.tabs.sendMessage(tab.id, payload)
    }
    throw err
  }
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  return tab
}

/* ---------------- 消息路由（popup / content） ---------------- */

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg || typeof msg.type !== 'string') return false

  switch (msg.type) {
    // popup：查询连接状态
    case 'leaf:status':
      sendResponse({ nativeStatus: HOST_STATE.status, error: HOST_STATE.lastError })
      return false

    // popup：启动/停止元素抓取
    case 'leaf:start-pick': {
      getActiveTab()
        .then((tab) => {
          if (!tab?.id) throw new Error('没有可用的标签页')
          return chrome.tabs.sendMessage(tab.id, { type: 'leaf:pick-start' })
        })
        .then((res) => sendResponse(res))
        .catch((err) => sendResponse({ error: String(err?.message ?? err) }))
      return true
    }

    case 'leaf:stop-pick': {
      getActiveTab()
        .then((tab) => {
          if (!tab?.id) throw new Error('没有可用的标签页')
          return chrome.tabs.sendMessage(tab.id, { type: 'leaf:pick-stop' })
        })
        .then((res) => sendResponse(res))
        .catch((err) => sendResponse({ error: String(err?.message ?? err) }))
      return true
    }

    // popup：测试执行动作
    case 'leaf:exec': {
      execInTab(msg.payload ?? {})
        .then((data) => sendResponse({ ok: true, data }))
        .catch((err) => sendResponse({ ok: false, error: String(err?.message ?? err) }))
      return true
    }

    // content script：抓取到元素 → 经 native 管道上报宿主
    case 'leaf:element-picked': {
      chrome.storage.session?.set({ lastPicked: msg.payload })
      postToNative({ type: 'leaf:element', payload: msg.payload, frame: sender.frameId, tab: sender.tab?.id })
      sendResponse({ ok: true })
      return false
    }

    default:
      return false
  }
})

/* ---------------- 启动 ---------------- */
// SW 被唤醒（含 alarm 唤醒）时顶层代码重新执行：重连 native 端口。
// Chrome 110+ 中保持开放的 native 端口会让 SW 常驻，不再休眠；alarm 仅作兜底保活。
chrome.alarms.create('leaf-keepalive', { periodInMinutes: 0.5 })
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== 'leaf-keepalive') return
  if (!HOST_STATE.port) {
    if (HOST_STATE.wantConnect) connectNative().catch(() => {})
    return
  }
  // 有连接时发心跳：宿主的 /status 靠它判断扩展是否在线
  postToNative({ type: 'leaf:heartbeat', t: Date.now() })
})
connectNative().catch(() => {})
