/**
 * 轻羽RPA 网页自动化插件 - Content Script
 * 注入所有 frame（document_start），提供：
 *  1. 元素抓取（PICK 模式：高亮跟随鼠标，点击采集元素信息）
 *  2. 动作执行（点击 / 输入 / 读文本 / 属性 / 滚动 / 下拉选择 / 按键等）
 * 与后台通过 chrome.runtime 消息通信，消息格式：{ type: 'leaf:<action>', payload }
 */
(() => {
  if (window.__leafRpaInjected) return
  window.__leafRpaInjected = true

  /* ---------------- 高亮浮层 ---------------- */
  const OVERLAY_ID = '__leaf-rpa-highlight'
  let overlay = null

  function ensureOverlay() {
    if (overlay && document.documentElement.contains(overlay)) return overlay
    overlay = document.createElement('div')
    overlay.id = OVERLAY_ID
    overlay.style.cssText =
      'position:absolute;z-index:2147483646;pointer-events:none;' +
      'border:2px solid #f53f3f;background:rgba(245,63,63,.12);' +
      'border-radius:2px;box-shadow:0 0 0 1px rgba(255,255,255,.6) inset;display:none'
    ;(document.body || document.documentElement).appendChild(overlay)
    return overlay
  }

  function highlightRect(rect) {
    const el = ensureOverlay()
    const pad = 2
    el.style.display = 'block'
    el.style.left = `${rect.left + window.scrollX - pad}px`
    el.style.top = `${rect.top + window.scrollY - pad}px`
    el.style.width = `${rect.width + pad * 2}px`
    el.style.height = `${rect.height + pad * 2}px`
  }

  function hideHighlight() {
    if (overlay) overlay.style.display = 'none'
  }

  function flashHighlight(el, ms = 600) {
    const rect = el.getBoundingClientRect()
    highlightRect(rect)
    setTimeout(hideHighlight, ms)
  }

  /* ---------------- 元素抓取（PICK 模式） ---------------- */
  let picking = false
  let recording = false
  let lastHovered = null

  /** 命中抓取浮层/提示条时返回 true（这些元素不是页面内容，不能被抓取） */
  function isOwnOverlay(el) {
    if (!el) return false
    if (el === overlay) return true
    if (el.id === OVERLAY_ID || el.id === '__leaf-rpa-tip' || el.id === '__leaf-rpa-record-tip') return true
    return el.closest?.(`#${OVERLAY_ID}, #__leaf-rpa-tip, #__leaf-rpa-record-tip`) != null
  }

  /** 结构性元素（html/body/head 等）不作为抓取目标 */
  function isStructural(el) {
    if (!el) return false
    const tag = el.tagName ? el.tagName.toLowerCase() : ''
    return tag === 'html' || tag === 'body' || tag === 'head'
  }

  /** 命中一个真实可抓取的元素：跳过浮层，必要时回退到 elementFromPoint */
  function resolvePickTarget(e) {
    const x = e?.clientX ?? -1
    const y = e?.clientY ?? -1
    if (x < 0 || y < 0) return lastHovered
    let el = document.elementFromPoint(x, y)
    if (isOwnOverlay(el) || isStructural(el)) {
      // 浮层不应拦截指针（pointer-events:none）；结构元素说明命中的是整页，回退到悬停记录
      el = lastHovered
    }
    if (!el || !document.documentElement.contains(el)) return null
    if (isOwnOverlay(el) || isStructural(el)) return null
    return el
  }

  function startPick() {
    if (picking) return
    picking = true
    lastHovered = null
    window.addEventListener('mouseover', onPickOver, true)
    window.addEventListener('mousemove', onPickMove, true)
    window.addEventListener('click', onPickClick, true)
    window.addEventListener('keydown', onPickKey, true)
    // 防止页面滚动/拖拽选中干扰点击
    window.addEventListener('selectstart', onPickSelect, true)
    showPickTip()
  }

  function stopPick() {
    if (!picking) return
    picking = false
    lastHovered = null
    window.removeEventListener('mouseover', onPickOver, true)
    window.removeEventListener('mousemove', onPickMove, true)
    window.removeEventListener('click', onPickClick, true)
    window.removeEventListener('keydown', onPickKey, true)
    window.removeEventListener('selectstart', onPickSelect, true)
    hideHighlight()
    removePickTip()
  }

  /* 智能录制：连续采集，点击元素后不退出抓取模式 */
  function startRecord() {
    recording = true
    startPick()
    showRecordTip()
  }

  function stopRecord() {
    recording = false
    stopPick()
    removeRecordTip()
  }

  function showRecordTip() {
    if (document.getElementById('__leaf-rpa-record-tip')) return
    if (window !== window.top) return
    const tip = document.createElement('div')
    tip.id = '__leaf-rpa-record-tip'
    tip.style.cssText =
      'position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:2147483647;' +
      'background:#f53f3f;color:#fff;font:13px/1.6 sans-serif;padding:6px 14px;border-radius:16px;' +
      'box-shadow:0 4px 16px rgba(0,0,0,.25);pointer-events:none'
    tip.textContent = '智能录制中：点击页面元素即可连续采集，Esc 结束'
    document.body.appendChild(tip)
  }

  function removeRecordTip() {
    document.getElementById('__leaf-rpa-record-tip')?.remove()
  }

  function onPickOver(e) {
    const el = e.target
    if (isOwnOverlay(el) || isStructural(el)) return
    lastHovered = el
  }

  function onPickMove(e) {
    const el = resolvePickTarget(e)
    if (!el) return
    lastHovered = el
    try {
      highlightRect(el.getBoundingClientRect())
    } catch {
      /* 元素可能已卸载 */
    }
  }

  function onPickClick(e) {
    if (!picking) return
    e.preventDefault()
    e.stopPropagation()
    // 优先使用悬停记录的元素：比 elementFromPoint 更稳定（避免浮层/高亮边缘竞争）
    let el = lastHovered
    if (!el || !document.documentElement.contains(el) || isOwnOverlay(el) || isStructural(el)) {
      el = resolvePickTarget(e)
    }
    if (!el || isOwnOverlay(el) || isStructural(el)) return
    const info = collectElementInfo(el)
    // 发给后台（后台再转发给桌面端 / popup 展示）
    try {
      chrome.runtime.sendMessage({ type: 'leaf:element-picked', payload: info })
    } catch {
      /* 扩展上下文失效时静默 */
    }
    // 单次抓取采集一次即退出；录制模式连续采集
    if (!recording) stopPick()
  }

  function onPickKey(e) {
    if (e.key === 'Escape') {
      e.preventDefault()
      if (recording) stopRecord()
      else stopPick()
    }
  }

  function onPickSelect(e) {
    if (picking) e.preventDefault()
  }

  function showPickTip() {
    if (document.getElementById('__leaf-rpa-tip')) return
    if (window !== window.top) return // 仅顶层 frame 显示提示条
    const tip = document.createElement('div')
    tip.id = '__leaf-rpa-tip'
    tip.style.cssText =
      'position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:2147483647;' +
      'background:#1f2329;color:#fff;padding:6px 14px;border-radius:16px;font-size:12px;' +
      'font-family:system-ui,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.25)'
    tip.textContent = '轻羽RPA · 点击需要抓取的元素，Esc 取消'
    document.documentElement.appendChild(tip)
  }

  function removePickTip() {
    document.getElementById('__leaf-rpa-tip')?.remove()
  }

  /* ---------------- 选择器生成 ---------------- */
  function cssPath(el) {
    if (!(el instanceof Element)) return ''
    const parts = []
    let node = el
    while (node && node.nodeType === 1 && parts.length < 8) {
      let selector = node.nodeName.toLowerCase()
      if (node.id) {
        parts.unshift(`#${CSS.escape(node.id)}`)
        break
      }
      const parent = node.parentNode
      if (parent) {
        const sameTag = Array.from(parent.children).filter((c) => c.nodeName === node.nodeName)
        if (sameTag.length > 1) {
          selector += `:nth-of-type(${sameTag.indexOf(node) + 1})`
        }
      }
      parts.unshift(selector)
      node = parent
    }
    return parts.join(' > ')
  }

  function xpathOf(el) {
    if (!(el instanceof Element)) return ''
    const idx = (node) => {
      let i = 1
      let sib = node.previousElementSibling
      while (sib) {
        if (sib.nodeName === node.nodeName) i++
        sib = sib.previousElementSibling
      }
      return i
    }
    const parts = []
    let node = el
    while (node && node.nodeType === 1 && node.nodeName.toLowerCase() !== 'html') {
      parts.unshift(`${node.nodeName.toLowerCase()}[${idx(node)}]`)
      node = node.parentElement
    }
    return '/html/' + parts.join('/')
  }

  function collectElementInfo(el) {
    const rect = el.getBoundingClientRect()
    const attrs = {}
    for (const a of el.attributes) attrs[a.name] = a.value
    const framePath = getFramePath()
    const info = {
      tagName: el.tagName.toLowerCase(),
      id: el.id || '',
      name: attrs.name || '',
      type: attrs.type || '',
      classes: el.className && typeof el.className === 'string' ? el.className : '',
      text: (el.textContent || '').trim().slice(0, 200),
      value: 'value' in el ? String(el.value).slice(0, 200) : '',
      href: el.tagName === 'A' ? el.href : '',
      placeholder: attrs.placeholder || '',
      attrs,
      cssSelector: cssPath(el),
      xpath: xpathOf(el),
      similarCount: 1,
      rect: { x: Math.round(rect.left), y: Math.round(rect.top), w: Math.round(rect.width), h: Math.round(rect.height) },
      url: location.href,
      // 元素所在 frame 信息：执行指令时据此定位到正确的 document
      frameUrl: location.href,
      framePath,
      sameFrame: framePath.length === 0,
    }
    // 相似元素统计（同名兄弟节点的数量，供"批量抓取列表"参考）
    if (info.classes) {
      try {
        info.similarCount = document.querySelectorAll(
          `${info.tagName}.${info.classes.trim().split(/\s+/).join('.')}`,
        ).length
      } catch {
        /* ignore */
      }
    }
    return info
  }

  /* ---------------- 选择器定位 ---------------- */

  /** 当前 frame 相对顶层页面的层级路径（如 [0,2] 表示 top 的第 0 个 iframe 里的第 2 个 iframe） */
  function getFramePath() {
    const path = []
    let w = window
    let guard = 0
    try {
      while (w !== window.top && guard < 16) {
        const parent = w.parent
        const iframes = parent.document.querySelectorAll('iframe, frame')
        path.unshift(Array.prototype.indexOf.call(iframes, w.frameElement))
        w = parent
        guard += 1
      }
    } catch {
      /* 跨域 frame 无法访问父级，保留已收集的部分 */
    }
    return path
  }

  /** 沿 frame 路径在顶层文档中定位目标 document；失败返回 null（跨域/已销毁） */
  function resolveFrameDoc(path) {
    if (!path || !path.length) return document
    let doc = document
    for (const idx of path) {
      const frames = doc.querySelectorAll('iframe, frame')
      const frame = frames[idx]
      if (!frame) return null
      try {
        doc = frame.contentDocument
      } catch {
        return null // 跨域 frame：页面脚本无权访问
      }
      if (!doc) return null
    }
    return doc
  }

  function findBySelector(sel) {
    if (!sel) throw new Error('缺少元素选择器')
    // 抓取结果携带 framePath 时，先定位到元素所在 frame 的 document
    const scopeDoc = sel.framePath?.length ? resolveFrameDoc(sel.framePath) : null
    const docs = scopeDoc ? [scopeDoc] : [document]
    for (const ctx of docs) {
      const found = lookupInDocument(ctx, sel)
      if (found) return found
    }
    if (sel.framePath?.length && !scopeDoc) {
      throw new Error('元素位于跨域 iframe 中，无法在页面脚本内定位（可改用文本匹配或在 iframe 内重新抓取）')
    }
    throw new Error('未找到元素: ' + JSON.stringify(sel).slice(0, 120))
  }

  /** 在指定 document 中按 CSS / XPath / 文本查找元素 */
  function lookupInDocument(ctx, sel) {
    // 桌面端直接传字符串：支持 CSS 选择器、xpath= 前缀或以 / 开头的 XPath
    if (typeof sel === 'string') {
      const trimmed = sel.trim()
      if (!trimmed) throw new Error('缺少元素选择器')
      if (/^xpath=/i.test(trimmed)) {
        const r = document.evaluate(trimmed.slice(6).trim(), ctx, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null)
        if (r.singleNodeValue) return r.singleNodeValue
        throw new Error('未找到元素: ' + trimmed)
      }
      if (trimmed.startsWith('/') || trimmed.startsWith('(')) {
        try {
          const r = document.evaluate(trimmed, ctx, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null)
          if (r.singleNodeValue) return r.singleNodeValue
        } catch {
          /* 非 XPath，按 CSS 兜底 */
        }
      }
      const el = ctx.querySelector(trimmed)
      if (el) return el
      throw new Error('未找到元素: ' + trimmed)
    }
    if (sel.xpath) {
      const r = document.evaluate(sel.xpath, ctx, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null)
      if (r.singleNodeValue) return r.singleNodeValue
    }
    if (sel.css) {
      const el = ctx.querySelector(sel.css)
      if (el) return el
    }
    if (sel.text) {
      const candidates = ctx.querySelectorAll(sel.tag || '*')
      for (const c of candidates) {
        if ((c.textContent || '').trim().includes(sel.text)) return c
      }
    }
    return null
  }

  /* ---------------- 动作执行 ---------------- */

  /** 用原生 setter 写入 value 后派发 input/change，兼容 React/Vue 受控组件 */
  function setNativeValue(el, value, clear = true) {
    const proto = Object.getPrototypeOf(el)
    const desc = Object.getOwnPropertyDescriptor(proto, 'value')
    if (clear) desc?.set?.call(el, '')
    desc?.set?.call(el, value)
    el.dispatchEvent(new Event('input', { bubbles: true }))
    el.dispatchEvent(new Event('change', { bubbles: true }))
  }

  const handlers = {
    'leaf:ping': () => ({ pong: true, url: location.href, title: document.title }),

    'leaf:pick-start': () => {
      startPick()
      return { started: true }
    },

    'leaf:pick-stop': () => {
      stopPick()
      return { stopped: true }
    },

    'leaf:record-start': () => {
      startRecord()
      return { started: true }
    },

    'leaf:record-stop': () => {
      stopRecord()
      return { stopped: true }
    },

    /** { selector: {css|xpath|text|tag}, mode?: 'js'|'mouse' } */
    'leaf:click': (p) => {
      const el = findBySelector(p.selector)
      el.scrollIntoView({ block: 'center' })
      flashHighlight(el)
      const mode = p.mode || 'mouse'
      if (mode === 'js') {
        el.click()
      } else {
        const r = el.getBoundingClientRect()
        const opts = {
          bubbles: true,
          cancelable: true,
          view: window,
          clientX: r.left + r.width / 2,
          clientY: r.top + r.height / 2,
        }
        el.dispatchEvent(new PointerEvent('pointerdown', opts))
        el.dispatchEvent(new MouseEvent('mousedown', opts))
        el.dispatchEvent(new PointerEvent('pointerup', opts))
        el.dispatchEvent(new MouseEvent('mouseup', opts))
        el.dispatchEvent(new MouseEvent('click', opts))
      }
      return { ok: true }
    },

    /** { selector, value|text, clear?: boolean } */
    'leaf:input': (p) => {
      const el = findBySelector(p.selector)
      el.scrollIntoView({ block: 'center' })
      flashHighlight(el)
      setNativeValue(el, String(p.value ?? p.text ?? ''), p.clear !== false)
      return { ok: true }
    },

    /** { selector } → text */
    'leaf:get-text': (p) => {
      const el = findBySelector(p.selector)
      return { text: (el.textContent || '').trim() }
    },

    /** { selector, attribute } */
    'leaf:get-attribute': (p) => {
      const el = findBySelector(p.selector)
      if (p.attribute === 'value') return { value: 'value' in el ? String(el.value) : '' }
      return { value: el.getAttribute?.(p.attribute) ?? null }
    },

    /** { selector } → 元素信息 + 相似元素列表（前 50 个） */
    'leaf:extract': (p) => {
      const el = findBySelector(p.selector)
      const info = collectElementInfo(el)
      const items = []
      if (info.classes) {
        try {
          document.querySelectorAll(`${info.tagName}.${info.classes.trim().split(/\s+/).join('.')}`).forEach((n, i) => {
            if (i < 50) items.push((n.textContent || '').trim().slice(0, 200))
          })
        } catch {
          /* ignore */
        }
      }
      return { info, items }
    },

    /** { selector } */
    'leaf:exists': (p) => {
      try {
        findBySelector(p.selector)
        return { exists: true }
      } catch {
        return { exists: false }
      }
    },

    /** { selector, value } 下拉选择 */
    'leaf:select': (p) => {
      const el = findBySelector(p.selector)
      if (el.tagName !== 'SELECT') throw new Error('目标元素不是下拉框')
      let hit = false
      for (const opt of el.options) {
        if (opt.value === p.value || opt.text.trim() === String(p.value)) {
          el.value = opt.value
          hit = true
          break
        }
      }
      if (!hit) throw new Error('下拉项不存在: ' + p.value)
      el.dispatchEvent(new Event('change', { bubbles: true }))
      return { ok: true }
    },

    /** { key: 'Enter'|'Tab'|... , selector? } */
    'leaf:press-key': (p) => {
      const target = p.selector ? findBySelector(p.selector) : document.activeElement
      const opts = { bubbles: true, cancelable: true, key: p.key, code: p.key, keyCode: KEY_CODES[p.key] ?? 0 }
      target.dispatchEvent(new KeyboardEvent('keydown', opts))
      target.dispatchEvent(new KeyboardEvent('keypress', opts))
      target.dispatchEvent(new KeyboardEvent('keyup', opts))
      return { ok: true }
    },

    /** { selector } 滚动到元素 */
    'leaf:scroll-into-view': (p) => {
      const el = findBySelector(p.selector)
      el.scrollIntoView({ block: 'center', behavior: 'smooth' })
      return { ok: true }
    },

    /** { deltaY } 页面滚动 */
    'leaf:scroll': (p) => {
      window.scrollBy({ top: p.deltaY ?? 300 })
      return { ok: true, scrollY: window.scrollY }
    },

    /** { selector } 鼠标悬停 */
    'leaf:hover': (p) => {
      const el = findBySelector(p.selector)
      el.scrollIntoView({ block: 'center' })
      flashHighlight(el)
      const r = el.getBoundingClientRect()
      const opts = {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: r.left + r.width / 2,
        clientY: r.top + r.height / 2,
      }
      el.dispatchEvent(new MouseEvent('mouseover', opts))
      el.dispatchEvent(new MouseEvent('mouseenter', opts))
      el.dispatchEvent(new MouseEvent('mousemove', opts))
      return { ok: true }
    },

    /** { selector, targetSelector?|offsetX/offsetY } 拖拽 */
    'leaf:drag': (p) => {
      const el = findBySelector(p.selector)
      el.scrollIntoView({ block: 'center' })
      flashHighlight(el)
      const sr = el.getBoundingClientRect()
      const sx = sr.left + sr.width / 2
      const sy = sr.top + sr.height / 2
      const base = { bubbles: true, cancelable: true, view: window }
      el.dispatchEvent(new MouseEvent('mousedown', { ...base, clientX: sx, clientY: sy }))
      let target = null
      if (p.targetSelector) {
        try {
          target = findBySelector(p.targetSelector)
        } catch {
          target = null
        }
      }
      if (target) {
        target.scrollIntoView({ block: 'center' })
        flashHighlight(target)
        const tr = target.getBoundingClientRect()
        const tx = tr.left + tr.width / 2
        const ty = tr.top + tr.height / 2
        for (const type of ['mouseover', 'mouseenter', 'mousemove']) {
          target.dispatchEvent(new MouseEvent(type, { ...base, clientX: tx, clientY: ty }))
        }
        el.dispatchEvent(new MouseEvent('mousemove', { ...base, clientX: tx, clientY: ty }))
        target.dispatchEvent(new MouseEvent('mouseup', { ...base, clientX: tx, clientY: ty }))
      } else {
        const dx = (Number(p.offsetX) || 0) / 3
        const dy = (Number(p.offsetY) || 0) / 3
        let cx = sx
        let cy = sy
        for (let i = 0; i < 3; i++) {
          cx += dx
          cy += dy
          el.dispatchEvent(new MouseEvent('mousemove', { ...base, clientX: cx, clientY: cy }))
        }
        el.dispatchEvent(new MouseEvent('mouseup', { ...base, clientX: cx, clientY: cy }))
      }
      return { ok: true }
    },

    /** { selector, timeout?(秒) } 轮询等待元素出现（异步） */
    'leaf:wait-element': (p) => {
      const timeoutMs = Math.max(0, Number(p.timeout ?? 10) || 10) * 1000
      const started = Date.now()
      return new Promise((resolve, reject) => {
        const tick = () => {
          try {
            findBySelector(p.selector)
            resolve({ ok: true, elapsed: Date.now() - started })
          } catch {
            if (Date.now() - started >= timeoutMs) {
              reject(new Error(`等待元素超时（${Math.round(timeoutMs / 100) / 10}s）: ${JSON.stringify(p.selector).slice(0, 120)}`))
            } else {
              setTimeout(tick, 100)
            }
          }
        }
        tick()
      })
    },

    /** { selector, value, clear? } 密码输入（页面端不回显内容） */
    'leaf:input-password': (p) => {
      const el = findBySelector(p.selector)
      el.scrollIntoView({ block: 'center' })
      flashHighlight(el)
      setNativeValue(el, String(p.value ?? ''), p.clear !== false)
      return { ok: true, masked: true }
    },

    /** { selector, checked } 复选框/单选框勾选 */
    'leaf:set-checkbox': (p) => {
      const el = findBySelector(p.selector)
      el.scrollIntoView({ block: 'center' })
      flashHighlight(el)
      const want = !!p.checked
      if ('checked' in el) {
        if (el.checked !== want) el.click() // click 由浏览器原生切换并派发事件
      } else {
        el.click() // 自定义组件：直接点击一次
      }
      return { ok: true, checked: want }
    },

    /** { selector, value, clear? } 直接设置值，支持 contenteditable */
    'leaf:set-value': (p) => {
      const el = findBySelector(p.selector)
      el.scrollIntoView({ block: 'center' })
      flashHighlight(el)
      const value = String(p.value ?? '')
      if (el.isContentEditable) {
        el.innerText = value
        el.dispatchEvent(new Event('input', { bubbles: true }))
        el.dispatchEvent(new Event('change', { bubbles: true }))
      } else {
        setNativeValue(el, value, p.clear !== false)
      }
      return { ok: true }
    },

    /** { selector, attribute, value } 设置属性 */
    'leaf:set-attribute': (p) => {
      const el = findBySelector(p.selector)
      flashHighlight(el)
      if (!p.attribute) throw new Error('缺少属性名')
      el.setAttribute(String(p.attribute), String(p.value ?? ''))
      return { ok: true }
    },

    /** { selector } → 元素完整信息 */
    'leaf:get-element': (p) => {
      const el = findBySelector(p.selector)
      flashHighlight(el)
      return { info: collectElementInfo(el) }
    },

    /** { selector, relation: 'parent'|'child'|'next'|'prev' } → 关联元素信息 */
    'leaf:get-related': (p) => {
      const el = findBySelector(p.selector)
      flashHighlight(el)
      let target = null
      if (p.relation === 'parent') target = el.parentElement
      else if (p.relation === 'child') target = el.firstElementChild
      else if (p.relation === 'next') target = el.nextElementSibling
      else if (p.relation === 'prev') target = el.previousElementSibling
      else throw new Error('未知关联关系: ' + p.relation)
      if (!target) throw new Error(`未找到关联元素（${p.relation}）`)
      flashHighlight(target)
      return { info: collectElementInfo(target) }
    },

    /** { selector, limit? } → 相似元素（class 相同）信息列表 */
    'leaf:get-similar': (p) => {
      const el = findBySelector(p.selector)
      flashHighlight(el)
      const info = collectElementInfo(el)
      const limit = Math.max(1, Math.min(200, Number(p.limit) || 50))
      const items = []
      if (info.classes) {
        try {
          document
            .querySelectorAll(`${info.tagName}.${info.classes.trim().split(/\s+/).join('.')}`)
            .forEach((n) => {
              if (items.length < limit) items.push(collectElementInfo(n))
            })
        } catch {
          /* ignore */
        }
      }
      return { count: items.length, items }
    },
  }

  const KEY_CODES = {
    Enter: 13, Tab: 9, Escape: 27, Backspace: 8, Delete: 46,
    ArrowUp: 38, ArrowDown: 40, ArrowLeft: 37, ArrowRight: 39,
  }

  /* ---------------- 消息入口 ---------------- */
  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (!msg || typeof msg.type !== 'string' || !msg.type.startsWith('leaf:')) return false
    const handler = handlers[msg.type]
    if (!handler) {
      sendResponse({ error: `未知指令: ${msg.type}` })
      return false
    }
    let result
    try {
      result = handler(msg.payload || {})
    } catch (err) {
      sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) })
      return false
    }
    if (result && typeof result.then === 'function') {
      // 异步指令（如等待元素）：保持通道打开直到完成
      result.then(
        (data) => sendResponse({ ok: true, data }),
        (err) => sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
      )
      return true
    }
    sendResponse({ ok: true, data: result })
    return false // 同步响应
  })
})()
