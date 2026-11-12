/** 复制文本到剪贴板，失败时返回 false（非安全上下文下浏览器可能拒绝） */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
