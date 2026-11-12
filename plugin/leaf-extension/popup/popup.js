/** 轻羽RPA 插件 Popup 逻辑 */
const $ = (id) => document.getElementById(id)
const msg = (text, ok = false) => {
  const el = $('msg')
  el.textContent = text
  el.className = ok ? 'ok' : ''
  if (text) setTimeout(() => (el.textContent = ''), 3000)
}

/* 连接状态 */
chrome.runtime.sendMessage({ type: 'leaf:status' }, (res) => {
  const connected = res?.nativeStatus === 'connected'
  $('statusDot').className = `dot ${connected ? 'on' : 'off'}`
  $('statusText').textContent = connected ? '已连接' : '未连接'
  $('statusText').style.color = connected ? '#00b42a' : '#a8abb2'
})

/* 抓取元素：popup 打开时点击按钮会先关闭 popup，再在页面里点选 */
$('pickBtn').addEventListener('click', () => {
  chrome.runtime.sendMessage({ type: 'leaf:start-pick' }, (res) => {
    if (res?.error) msg(res.error)
    else window.close()
  })
})

/* 测试动作：读取页面标题 */
$('getTextBtn').addEventListener('click', () => {
  chrome.runtime.sendMessage(
    { type: 'leaf:exec', payload: { type: 'leaf:ping' } },
    (res) => {
      if (res?.ok) msg(`页面：${res.data.title}`.slice(0, 40), true)
      else msg(res?.error ?? '执行失败，请刷新页面后重试')
    },
  )
})

/* 展示最近抓取的元素 */
chrome.storage.session?.get('lastPicked', ({ lastPicked }) => {
  if (!lastPicked) return
  const box = $('picked')
  box.style.display = 'block'
  box.innerHTML =
    `<b>${lastPicked.tagName}</b> ${lastPicked.id ? '#' + lastPicked.id : ''}<br/>` +
    `选择器：${lastPicked.cssSelector}<br/>` +
    `文本：${(lastPicked.text || '').slice(0, 40) || '（空）'}<br/>` +
    `相似元素：${lastPicked.similarCount} 个`
})
