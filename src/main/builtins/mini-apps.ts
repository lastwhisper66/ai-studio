/**
 * Built-in mini app (vendor web service) definitions.
 *
 * Each entry is seeded into the `mini_apps` table via INSERT OR IGNORE on boot,
 * so user edits are never clobbered. Bump BUILTIN_MINI_APPS_VERSION in
 * ./index.ts when changing anything here.
 *
 * `icon` is a single glyph rendered on a `color` background — no network
 * fetches, no bundled logo assets, and it stays legible in both themes.
 * Trademarked vendor logos are deliberately avoided.
 */
export interface BuiltinMiniApp {
  id: string
  name: string
  url: string
  icon: string
  color: string
  sortOrder: number
}

export const MINI_APPS: BuiltinMiniApp[] = [
  {
    id: 'builtin-chatgpt',
    name: 'ChatGPT',
    url: 'https://chatgpt.com/',
    icon: 'G',
    color: '#10a37f',
    sortOrder: 1,
  },
  {
    id: 'builtin-claude',
    name: 'Claude',
    url: 'https://claude.ai/new',
    icon: 'C',
    color: '#d97757',
    sortOrder: 2,
  },
  {
    id: 'builtin-gemini',
    name: 'Gemini',
    url: 'https://gemini.google.com/app',
    icon: 'G',
    color: '#4285f4',
    sortOrder: 3,
  },
  {
    id: 'builtin-deepseek',
    name: 'DeepSeek',
    url: 'https://chat.deepseek.com/',
    icon: 'D',
    color: '#4d6bfe',
    sortOrder: 4,
  },
  {
    id: 'builtin-kimi',
    name: 'Kimi',
    url: 'https://www.kimi.com/',
    icon: 'K',
    color: '#1f1f1f',
    sortOrder: 5,
  },
  {
    id: 'builtin-qwen',
    name: '通义千问',
    url: 'https://www.tongyi.com/qianwen/',
    icon: '通',
    color: '#615ced',
    sortOrder: 6,
  },
  {
    id: 'builtin-doubao',
    name: '豆包',
    url: 'https://www.doubao.com/chat/',
    icon: '豆',
    color: '#2b7fff',
    sortOrder: 7,
  },
  {
    id: 'builtin-zhipu',
    name: '智谱清言',
    url: 'https://chatglm.cn/main/alltoolsdetail',
    icon: '智',
    color: '#3859ff',
    sortOrder: 8,
  },
  {
    id: 'builtin-yuanbao',
    name: '腾讯元宝',
    url: 'https://yuanbao.tencent.com/chat',
    icon: '元',
    color: '#0052d9',
    sortOrder: 9,
  },
  {
    id: 'builtin-grok',
    name: 'Grok',
    url: 'https://grok.com/',
    icon: 'X',
    color: '#1f1f1f',
    sortOrder: 10,
  },
  {
    id: 'builtin-perplexity',
    name: 'Perplexity',
    url: 'https://www.perplexity.ai/',
    icon: 'P',
    color: '#20808d',
    sortOrder: 11,
  },
  {
    id: 'builtin-yiyan',
    name: '文心一言',
    url: 'https://yiyan.baidu.com/',
    icon: '文',
    color: '#2932e1',
    sortOrder: 12,
  },
]
