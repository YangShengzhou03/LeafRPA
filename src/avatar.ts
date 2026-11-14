/* 头像展示工具：优先用户自定义图片 URL，否则回退到用户名首字默认头像 */

export interface AvatarDisplay {
  /** 自定义头像图片地址（未设置时为 null） */
  src: string | null
  /** 默认头像展示字符：用户名首字母（无用户名时为 U） */
  initial: string
}

/** 规范化头像展示信息：空白地址视为未设置，首字统一大写 */
export function avatarSrcOrInitial(
  avatarUrl: string | null | undefined,
  username: string | null | undefined,
): AvatarDisplay {
  const src = (avatarUrl ?? '').trim() || null
  const name = (username ?? '').trim()
  return { src, initial: name ? name.charAt(0).toUpperCase() : 'U' }
}
