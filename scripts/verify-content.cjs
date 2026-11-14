/**
 * content.js 逻辑验证：用最小 DOM 桩加载插件内容脚本，验证元素抓取与选择器定位。
 * 运行：node scripts/verify-content.js
 */
const fs = require('fs');
const path = require('path');
const vm = require('vm');

const CONTENT_JS = path.join(__dirname, '..', 'plugin', 'leaf-extension', 'content', 'content.js');

/* ---------------- 最小 DOM 桩 ---------------- */
class Element {}
class Node {}
class ClassList {
  constructor(el) { this.el = el; }
  contains(c) { return (this.el.attrs.class || '').split(/\s+/).includes(c); }
}

class El extends Element {
  constructor(tag, attrs = {}) {
    super();
    this.tagName = tag.toUpperCase();
    this.nodeName = tag.toUpperCase();
    this.nodeType = 1;
    this.attrs = attrs;
    this.id = attrs.id || '';
    this.children = [];
    this.parentNode = null;
    this.parentElement = null;
    this.textContent = attrs.text || '';
    this.value = attrs.value;
    this.isContentEditable = false;
    this.style = {};
    this._listeners = {};
  }
  get className() { return this.attrs.class || ''; }
  get attributes() {
    return Object.entries(this.attrs).map(([name, value]) => ({ name, value }));
  }
  getBoundingClientRect() {
    return { left: 0, top: 0, width: 100, height: 20, right: 100, bottom: 20 };
  }
  appendChild(c) { c.parentNode = this; c.parentElement = this; this.children.push(c); return c; }
  removeChild(c) { this.children = this.children.filter((x) => x !== c); }
  remove() { if (this.parentNode) this.parentNode.removeChild(this); }
  setAttribute(k, v) { this.attrs[k] = String(v); if (k === 'id') this.id = String(v); }
  getAttribute(k) { return k in this.attrs ? this.attrs[k] : null; }
  querySelector() { return null; }
  querySelectorAll() { return []; }
  closest() { return null; }
  contains(node) { return this._contains(this, node); }
  _contains(root, node) {
    if (root === node) return true;
    for (const c of root.children || []) if (this._contains(c, node)) return true;
    return false;
  }
  scrollIntoView() {}
  dispatchEvent() {}
  addEventListener(t, fn) { (this._listeners[t] ||= []).push(fn); }
  removeEventListener(t, fn) { this._listeners[t] = (this._listeners[t] || []).filter((f) => f !== fn); }
}

class Doc {
  constructor(root) {
    this.documentElement = root;
    this.body = root.children[0] || null;
    this.readyState = 'complete';
  }
  createElement(tag) { return new El(tag); }
  getElementById(id) { return null; }
  elementFromPoint(x, y) { return this._pointTarget || null; }
  querySelector(sel) { return this._find(this.documentElement, sel); }
  querySelectorAll(sel) {
    const tags = sel.split(',').map((s) => s.trim().toUpperCase());
    return this._findAll(this.documentElement, (n) => tags.includes(n.tagName));
  }
  _findAll(node, pred) {
    const out = [];
    if (pred(node)) out.push(node);
    for (const c of node.children || []) out.push(...this._findAll(c, pred));
    return out;
  }
  _find(node, sel) {
    if (sel.startsWith('#') && node.id === sel.slice(1)) return node;
    for (const c of node.children || []) { const r = this._find(c, sel); if (r) return r; }
    return null;
  }
  evaluate() { return { singleNodeValue: null }; }
  get activeElement() { return this.body; }
}

/* ---------------- 事件与窗口 ---------------- */
const windowListeners = {};
const documentBody = new El('body');
const html = new El('html');
html.appendChild(documentBody);
const document = new Doc(html);

const chrome = {
  runtime: {
    lastError: null,
    sendMessage: (msg) => { sent.push(msg); return Promise.resolve({}); },
    onMessage: { addListener: (fn) => { onMessageFn = fn; } },
  },
  storage: { session: { set: () => {} } },
};

let sent = [];
let onMessageFn = null;

const window = {
  addEventListener: (t, fn) => { (windowListeners[t] ||= []).push(fn); },
  removeEventListener: (t, fn) => { windowListeners[t] = (windowListeners[t] || []).filter((f) => f !== fn); },
  scrollX: 0, scrollY: 0, top: null,
};

const context = {
  window,
  document,
  chrome,
  location: { href: 'https://example.com/page' },
  navigator: { userAgent: 'node' },
  console,
  setTimeout,
  clearTimeout,
  Element,
  Node,
  Event: class { constructor(t, o) { Object.assign(this, o); } },
  PointerEvent: class { constructor(t, o) { Object.assign(this, o); } },
  MouseEvent: class { constructor(t, o) { Object.assign(this, o); } },
  KeyboardEvent: class { constructor(t, o) { Object.assign(this, o); } },
  CSS: { escape: (s) => s.replace(/[^\w-]/g, '\\$&') },
};
context.window.top = context.window;
context.top = context.window;
context.globalThis = context;
vm.createContext(context);

/* ---------------- 加载 content.js ---------------- */
const code = fs.readFileSync(CONTENT_JS, 'utf8');
vm.runInContext(code, context, { filename: 'content.js' });
console.log('[OK] content.js 加载成功');

/* ---------------- 测试 1：PICK 流程 ---------------- */
const target = new El('button', { id: 'submit', class: 'btn primary', text: 'Submit' });
documentBody.appendChild(target);

// 模拟 onPickMove / onPickClick：直接调用 SW 的 pick-start handler
sent = [];
let pickStartReply = null;
onMessageFn({ type: 'leaf:pick-start', payload: {} }, {}, (r) => { pickStartReply = r; });
console.log('[OK] pick-start:', JSON.stringify(pickStartReply));
if (!pickStartReply || !pickStartReply.data?.started) throw new Error('pick-start 未返回 started');

// 模拟悬停与点击（走 window 捕获监听器）；elementFromPoint 返回目标元素
document._pointTarget = target;
function fire(type, ev) { for (const fn of windowListeners[type] || []) fn(ev); }
fire('mouseover', { target, clientX: 5, clientY: 5 });
fire('mousemove', { target, clientX: 5, clientY: 5 });
sent = [];
fire('click', { target, clientX: 5, clientY: 5, preventDefault() {}, stopPropagation() {} });

if (!sent.length) throw new Error('点击后未上报 leaf:element-picked');
const picked = sent.find((m) => m.type === 'leaf:element-picked');
console.log('[OK] 抓取上报:', JSON.stringify(picked.payload).slice(0, 220));

const info = picked.payload;
const failures = [];
if (info.tagName !== 'button') failures.push('tagName 期望 button，实际 ' + info.tagName);
if (info.id !== 'submit') failures.push('id 期望 submit，实际 ' + info.id);
if (info.cssSelector !== '#submit') failures.push('cssSelector 期望 #submit，实际 ' + info.cssSelector);
if (!info.xpath || !info.xpath.startsWith('/html/')) failures.push('xpath 异常: ' + info.xpath);
if (info.framePath.length !== 0) failures.push('framePath 期望空数组');
if (info.text !== 'Submit') failures.push('text 期望 Submit，实际 ' + info.text);

/* ---------------- 测试 2：选择器定位（含 framePath 分支） ---------------- */
sent = [];
let getTextReply = null;
onMessageFn({ type: 'leaf:get-text', payload: { selector: '#submit' } }, {}, (r) => { getTextReply = r; });
console.log('[OK] get-text(#submit) 响应:', JSON.stringify(getTextReply));
if (!getTextReply?.ok) throw new Error('get-text(#submit) 失败: ' + JSON.stringify(getTextReply));

/* ---------------- 测试 3：framePath 定位 ---------------- */
// 构造 iframe 链：document -> iframe[0] -> 内部按钮
const iframe = new El('iframe');
documentBody.appendChild(iframe);
const innerBody = new El('body');
const innerHtml = new El('html');
innerHtml.appendChild(innerBody);
const innerDoc = new Doc(innerHtml);
const innerBtn = new El('button', { id: 'innerBtn', text: 'Inside' });
innerBody.appendChild(innerBtn);
iframe.contentDocument = innerDoc;
const framePath = [0];

sent = [];
let frameReply = null;
onMessageFn(
  { type: 'leaf:get-text', payload: { selector: { css: '#innerBtn', framePath } } },
  {},
  (r) => { frameReply = r; },
);
console.log('[OK] get-text({css:#innerBtn, framePath:[0]}) 响应:', JSON.stringify(frameReply));
if (!frameReply?.ok) failures.push('iframe 内选择器定位失败: ' + JSON.stringify(frameReply));

// 无效 framePath 应返回明确错误而不是静默错元素
sent = [];
let badFrameReply = null;
onMessageFn(
  { type: 'leaf:get-text', payload: { selector: { css: '#innerBtn', framePath: [9] } } },
  {},
  (r) => { badFrameReply = r; },
);
console.log('[OK] 无效 framePath 响应:', JSON.stringify(badFrameReply));
if (badFrameReply?.ok) failures.push('无效 framePath 应返回错误');

/* ---------------- 结果 ---------------- */
if (failures.length) {
  console.error('\n[FAIL] 断言失败:');
  for (const f of failures) console.error('  - ' + f);
  process.exit(1);
}
console.log('\n全部断言通过 [OK]');
console.log('  tagName =', info.tagName, '| cssSelector =', info.cssSelector, '| xpath =', info.xpath);
