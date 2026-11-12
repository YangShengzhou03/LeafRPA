import type { CommandDefinition } from './types'

export const COMMAND_CATEGORIES = [
  '网页自动化',
  '桌面自动化',
  '数据处理',
  '控制流',
  '网络与通知',
  'Python',
  '等待与录屏',
] as const

export const COMMANDS: CommandDefinition[] = [
  // 网页自动化
  {
    type: 'web.open', name: '打开网页', category: '网页自动化', color: '#3b82f6',
    description: '调用系统默认浏览器打开一个网址',
    params: [
      { key: 'url', label: '网址', type: 'string', value: 'https://www.example.com' },
      { key: 'browser', label: '浏览器', type: 'select', value: 'chrome', options: [
        { label: 'Chrome', value: 'chrome' }, { label: 'Edge', value: 'edge' }, { label: '轻羽浏览器', value: 'shadowbot' },
      ] },
    ],
  },
  {
    type: 'web.click', name: '点击元素', category: '网页自动化', color: '#3b82f6',
    description: '点击网页中的指定元素',
    params: [
      { key: 'selector', label: '元素选择器', type: 'string', value: '' },
      { key: 'waitFor', label: '等待超时(秒)', type: 'number', value: 10 },
    ],
  },
  {
    type: 'web.input', name: '输入文本', category: '网页自动化', color: '#3b82f6',
    description: '在网页输入框中输入文本',
    params: [
      { key: 'selector', label: '元素选择器', type: 'string', value: '' },
      { key: 'text', label: '文本', type: 'string', value: '' },
      { key: 'clear', label: '先清空', type: 'boolean', value: true },
    ],
  },
  {
    type: 'web.getText', name: '获取文本', category: '网页自动化', color: '#3b82f6',
    description: '读取网页元素的文本并保存到变量',
    params: [
      { key: 'selector', label: '元素选择器', type: 'string', value: '' },
      { key: 'variable', label: '保存到变量', type: 'string', value: 'result' },
    ],
  },
  {
    type: 'web.screenshot', name: '网页截图', category: '网页自动化', color: '#3b82f6',
    description: '截取当前网页并保存',
    params: [{ key: 'savePath', label: '保存路径', type: 'string', value: '' }],
  },
  {
    type: 'list-web-pages', name: '获取已打开的网页对象', category: '网页自动化', color: '#3b82f6',
    description: '列出浏览器插件中所有已打开的网页标签（含标签页ID/标题/网址）并保存到变量',
    params: [{ key: 'variable', label: '保存到变量', type: 'string', value: 'webPages' }],
  },
  {
    type: 'close-web', name: '关闭网页', category: '网页自动化', color: '#3b82f6',
    description: '关闭指定标签页；标签页ID填 0 时关闭当前活动标签',
    params: [{ key: 'tabId', label: '标签页ID（0=当前活动标签）', type: 'number', value: 0 }],
  },
  {
    type: 'activate-browser', name: '激活浏览器', category: '网页自动化', color: '#3b82f6',
    description: '把浏览器窗口聚焦到前台',
    params: [],
  },
  {
    type: 'hover-web', name: '鼠标悬停在元素上', category: '网页自动化', color: '#3b82f6',
    description: '模拟鼠标悬停在网页指定元素上（触发 mouseover/mouseenter 等）',
    params: [{ key: 'selector', label: '元素选择器', type: 'string', value: '' }],
  },
  {
    type: 'drag-web', name: '拖拽元素', category: '网页自动化', color: '#3b82f6',
    description: '把源元素拖拽到目标元素，或按像素偏移拖拽（二者填其一）',
    params: [
      { key: 'selector', label: '源元素选择器', type: 'string', value: '' },
      { key: 'targetSelector', label: '目标元素选择器（与偏移二选一）', type: 'string', value: '' },
      { key: 'offsetX', label: '水平偏移(px)', type: 'number', value: 0 },
      { key: 'offsetY', label: '垂直偏移(px)', type: 'number', value: 0 },
    ],
  },
  {
    type: 'wait-web', name: '等待元素', category: '网页自动化', color: '#3b82f6',
    description: '轮询等待网页元素出现后再继续执行（超时即失败）',
    params: [
      { key: 'selector', label: '元素选择器', type: 'string', value: '' },
      { key: 'timeout', label: '等待超时(秒，≤9)', type: 'number', value: 8 },
    ],
  },
  {
    type: 'input-password-web', name: '填写密码框', category: '网页自动化', color: '#3b82f6',
    description: '向密码输入框写入密码（日志与变量中不回显明文）',
    params: [
      { key: 'selector', label: '元素选择器', type: 'string', value: '' },
      { key: 'value', label: '密码', type: 'string', value: '' },
      { key: 'clear', label: '先清空', type: 'boolean', value: true },
    ],
  },
  {
    type: 'select-web', name: '设置下拉框', category: '网页自动化', color: '#3b82f6',
    description: '按选项值或显示文本选中网页下拉框的一项',
    params: [
      { key: 'selector', label: '下拉框选择器', type: 'string', value: '' },
      { key: 'value', label: '选项值或文本', type: 'string', value: '' },
    ],
  },
  {
    type: 'set-checkbox-web', name: '设置复选框', category: '网页自动化', color: '#3b82f6',
    description: '勾选或取消勾选网页复选框/单选框',
    params: [
      { key: 'selector', label: '元素选择器', type: 'string', value: '' },
      { key: 'checked', label: '是否勾选', type: 'boolean', value: true },
    ],
  },
  {
    type: 'set-value-web', name: '设置元素值', category: '网页自动化', color: '#3b82f6',
    description: '直接设置网页元素的值（支持 contenteditable 富文本）',
    params: [
      { key: 'selector', label: '元素选择器', type: 'string', value: '' },
      { key: 'value', label: '值', type: 'string', value: '' },
    ],
  },
  {
    type: 'set-attr-web', name: '设置元素属性', category: '网页自动化', color: '#3b82f6',
    description: '设置网页元素的 HTML 属性',
    params: [
      { key: 'selector', label: '元素选择器', type: 'string', value: '' },
      { key: 'attribute', label: '属性名', type: 'string', value: '' },
      { key: 'value', label: '属性值', type: 'string', value: '' },
    ],
  },
  {
    type: 'get-element-web', name: '获取元素对象', category: '网页自动化', color: '#3b82f6',
    description: '读取网页元素的完整信息（标签/文本/属性/位置等）并保存到变量',
    params: [
      { key: 'selector', label: '元素选择器', type: 'string', value: '' },
      { key: 'variable', label: '保存到变量', type: 'string', value: 'elementInfo' },
    ],
  },
  {
    type: 'get-related-web', name: '获取关联元素', category: '网页自动化', color: '#3b82f6',
    description: '获取元素的父/子/相邻兄弟元素信息并保存到变量',
    params: [
      { key: 'selector', label: '元素选择器', type: 'string', value: '' },
      { key: 'relation', label: '关联关系', type: 'select', value: 'parent', options: [
        { label: '父元素', value: 'parent' }, { label: '子元素', value: 'child' },
        { label: '下一个兄弟', value: 'next' }, { label: '上一个兄弟', value: 'prev' },
      ] },
      { key: 'variable', label: '保存到变量', type: 'string', value: 'relatedInfo' },
    ],
  },
  {
    type: 'get-similar-web', name: '获取相似元素列表', category: '网页自动化', color: '#3b82f6',
    description: '获取与目标元素同 class 的相似元素信息列表并保存到变量',
    params: [
      { key: 'selector', label: '元素选择器', type: 'string', value: '' },
      { key: 'limit', label: '数量上限', type: 'number', value: 50 },
      { key: 'variable', label: '保存到变量', type: 'string', value: 'similarList' },
    ],
  },
  // 桌面自动化
  {
    type: 'desktop.startApp', name: '启动程序', category: '桌面自动化', color: '#8b5cf6',
    description: '启动一个本地应用程序',
    params: [
      { key: 'path', label: '程序路径', type: 'string', value: '' },
      { key: 'args', label: '启动参数', type: 'string', value: '' },
    ],
  },
  {
    type: 'desktop.click', name: '点击控件', category: '桌面自动化', color: '#8b5cf6',
    description: '点击桌面应用中的指定控件',
    params: [
      { key: 'selector', label: '控件选择器', type: 'string', value: '' },
      { key: 'button', label: '鼠标按键', type: 'select', value: 'left', options: [
        { label: '左键', value: 'left' }, { label: '右键', value: 'right' },
      ] },
    ],
  },
  {
    type: 'desktop.input', name: '模拟输入', category: '桌面自动化', color: '#8b5cf6',
    description: '在当前焦点处模拟键盘输入',
    params: [{ key: 'text', label: '文本', type: 'string', value: '' }],
  },
  {
    type: 'desktop.key', name: '模拟按键', category: '桌面自动化', color: '#8b5cf6',
    description: '模拟按下快捷键',
    params: [{ key: 'keys', label: '按键组合', type: 'string', value: 'enter' }],
  },
  {
    type: 'desktop.ocr', name: '图像识别点击', category: '桌面自动化', color: '#8b5cf6',
    description: '根据图片在屏幕上定位并点击',
    params: [{ key: 'image', label: '图片路径', type: 'string', value: '' }],
  },
  // 数据处理
  {
    type: 'data.setVar', name: '设置变量', category: '数据处理', color: '#10b981',
    description: '设置或修改变量的值',
    params: [
      { key: 'name', label: '变量名', type: 'string', value: 'var1' },
      { key: 'value', label: '值', type: 'string', value: '' },
    ],
  },
  {
    type: 'data.text', name: '文本处理', category: '数据处理', color: '#10b981',
    description: '对字符串进行截取、替换、拼接',
    params: [
      { key: 'input', label: '输入文本', type: 'string', value: '' },
      { key: 'operation', label: '操作', type: 'select', value: 'trim', options: [
        { label: '去空格', value: 'trim' }, { label: '替换', value: 'replace' }, { label: '截取', value: 'substring' }, { label: '转大写', value: 'upper' },
      ] },
      { key: 'variable', label: '结果变量', type: 'string', value: 'out' },
    ],
  },
  {
    type: 'data.excel', name: '读写Excel', category: '数据处理', color: '#10b981',
    description: '读取或写入 Excel 表格数据',
    params: [
      { key: 'path', label: '文件路径', type: 'string', value: '' },
      { key: 'sheet', label: '工作表', type: 'string', value: 'Sheet1' },
      { key: 'mode', label: '模式', type: 'select', value: 'read', options: [
        { label: '读取', value: 'read' }, { label: '写入', value: 'write' },
      ] },
    ],
  },
  {
    type: 'data.json', name: 'JSON解析', category: '数据处理', color: '#10b981',
    description: '解析 JSON 字符串并按字段路径提取值',
    params: [
      { key: 'input', label: 'JSON文本', type: 'textarea', value: '' },
      { key: 'path', label: '字段路径（如 data.list.0.name）', type: 'string', value: '' },
      { key: 'variable', label: '结果变量', type: 'string', value: 'jsonOut' },
    ],
  },
  // 控制流
  {
    type: 'flow.if', name: '条件判断', category: '控制流', color: '#f59e0b',
    description: '根据条件决定执行分支',
    params: [{ key: 'condition', label: '条件表达式', type: 'string', value: '' }],
  },
  {
    type: 'flow.loop', name: '循环', category: '控制流', color: '#f59e0b',
    description: '重复执行一段流程',
    params: [
      { key: 'count', label: '循环次数', type: 'number', value: 3 },
      { key: 'variable', label: '索引变量', type: 'string', value: 'i' },
    ],
  },
  {
    type: 'flow.tryCatch', name: '异常处理', category: '控制流', color: '#f59e0b',
    description: '捕获执行过程中的异常',
    params: [{ key: 'onError', label: '失败后执行', type: 'select', value: 'stop', options: [
      { label: '停止', value: 'stop' }, { label: '继续', value: 'continue' },
    ] }],
  },
  {
    type: 'flow.break', name: '中断流程', category: '控制流', color: '#f59e0b',
    description: '提前终止当前流程',
    params: [],
  },
  {
    type: 'instruction', name: '子流程', category: '控制流', color: '#f59e0b',
    description: '调用已创建的「自定义指令」流程，并把执行结果保存到变量',
    params: [
      { key: 'name', label: '子流程名称', type: 'string', value: '' },
      { key: 'outKey', label: '结果变量', type: 'string', value: 'subResult' },
    ],
  },
  // 网络与通知
  {
    type: 'net.http', name: 'HTTP 请求', category: '网络与通知', color: '#0ea5e9',
    description: '发起真实的 HTTP 请求，并把状态码与响应内容保存到变量',
    params: [
      { key: 'url', label: '请求地址', type: 'string', value: 'https://example.com' },
      { key: 'method', label: '请求方法', type: 'select', value: 'GET', options: [
        { label: 'GET', value: 'GET' }, { label: 'POST', value: 'POST' }, { label: 'PUT', value: 'PUT' }, { label: 'DELETE', value: 'DELETE' },
      ] },
      { key: 'headers', label: '请求头（每行 Key: Value）', type: 'textarea', value: '' },
      { key: 'body', label: '请求体', type: 'textarea', value: '' },
      { key: 'timeout', label: '超时(秒)', type: 'number', value: 15 },
      { key: 'output', label: '结果变量前缀', type: 'string', value: 'httpResult' },
    ],
  },
  // Python
  {
    type: 'python.code', name: 'Python代码', category: 'Python', color: '#06b6d4',
    description: '运行一段 Python 脚本，可调用 leafbot SDK 完成网络请求、文件读写等操作',
    params: [
      { key: 'code', label: '脚本内容', type: 'textarea', value: 'import leafbot\n\ndef main(args):\n    """args 为流程变量字典，返回值会写入"返回值变量"""\n    leafbot.log.info("开始执行 Python 节点")\n    name = leafbot.flow.get_var("name", "world")\n    result = leafbot.http.get("https://httpbin.org/get?n=" + name)\n    leafbot.flow.set_var("status", result["status"])\n    return result["status"]' },
      { key: 'output', label: '返回值变量', type: 'string', value: 'pyResult' },
    ],
  },
  {
    type: 'python.call', name: '调用Python包', category: 'Python', color: '#06b6d4',
    description: '调用已安装的 Python 库',
    params: [
      { key: 'module', label: '模块名', type: 'string', value: '' },
      { key: 'function', label: '函数名', type: 'string', value: '' },
    ],
  },
  // 等待与录屏
  {
    type: 'util.wait', name: '等待', category: '等待与录屏', color: '#64748b',
    description: '暂停流程一段时间',
    params: [
      { key: 'seconds', label: '等待秒数', type: 'number', value: 1 },
      { key: 'mode', label: '方式', type: 'select', value: 'fixed', options: [
        { label: '固定时长', value: 'fixed' }, { label: '等待元素出现', value: 'element' },
      ] },
    ],
  },
  {
    type: 'util.record', name: '录制操作', category: '等待与录屏', color: '#64748b',
    description: '录制网页或桌面操作并生成流程',
    params: [{ key: 'target', label: '录制目标', type: 'select', value: 'web', options: [
      { label: '网页', value: 'web' }, { label: '桌面', value: 'desktop' },
    ] }],
  },
  {
    type: 'util.log', name: '输出日志', category: '等待与录屏', color: '#64748b',
    description: '在运行日志中输出一条信息',
    params: [{ key: 'message', label: '内容', type: 'string', value: '' }],
  },
]

export function commandByType(type: string): CommandDefinition | undefined {
  return COMMANDS.find((c) => c.type === type)
}
