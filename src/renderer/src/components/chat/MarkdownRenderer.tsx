import { memo, useMemo, type ComponentPropsWithoutRef } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import remarkSuperSub from 'remark-supersub'
import rehypeRaw from 'rehype-raw'
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize'
import { Separator } from '@renderer/components/ui/separator'
import { CodeBlock } from './CodeBlock'
import { MermaidBlock } from './MermaidBlock'
import { MathBlock } from './MathBlock'

interface MarkdownRendererProps {
  content: string
  isStreaming?: boolean
  /** When provided, [n] markers in body text become #cite-n links. */
  citationCount?: number
}

interface LatexDelimiter {
  open: string
  close: string
  className: string
}

const latexDelimiters: LatexDelimiter[] = [
  { open: '\\\\[', close: '\\\\]', className: 'language-math math-display' },
  { open: '\\[', close: '\\]', className: 'language-math math-display' },
  { open: '\\\\(', close: '\\\\)', className: 'language-math math-inline' },
  { open: '\\(', close: '\\)', className: 'language-math math-inline' },
]

const sanitizeSchema = {
  ...defaultSchema,
  tagNames: [
    ...(defaultSchema.tagNames || []),
    'sup',
    'sub',
    'mark',
    'kbd',
    'abbr',
    'details',
    'summary',
    'ins',
    'del',
    'math',
    'inlinemath',
  ],
  attributes: {
    ...defaultSchema.attributes,
    code: [['className', /^language-.|^math-/]],
    abbr: [...(defaultSchema.attributes?.abbr || []), 'title'],
    details: [...(defaultSchema.attributes?.details || []), 'open'],
    math: ['value'],
    inlinemath: ['value'],
  },
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Walks the markdown source and replaces `[n]` markers (n: 1..citationCount)
 * with markdown links `[\[n\]](#cite-n)`. Skips fenced code blocks and inline
 * code spans so we don't mangle code samples.
 */
function linkifyCitations(content: string, citationCount: number): string {
  if (citationCount <= 0) return content
  const pattern = new RegExp(`\\[(\\d+)\\]`, 'g')
  const lines = content.split(/(\n)/) // keep newlines as separators

  let inFence = false
  const out: string[] = []
  for (const segment of lines) {
    if (segment === '\n') {
      out.push(segment)
      continue
    }
    if (/^\s*```/.test(segment)) {
      inFence = !inFence
      out.push(segment)
      continue
    }
    if (inFence) {
      out.push(segment)
      continue
    }
    // Within a line: skip inline code spans (backtick-delimited).
    const s = segment
    let result = ''
    let i = 0
    while (i < s.length) {
      const tick = s.indexOf('`', i)
      if (tick === -1) {
        result += s.slice(i).replace(pattern, (m, n) => {
          const idx = parseInt(n, 10)
          return idx >= 1 && idx <= citationCount ? `[\\[${n}\\]](#cite-${n})` : m
        })
        break
      }
      const before = s.slice(i, tick)
      result += before.replace(pattern, (m, n) => {
        const idx = parseInt(n, 10)
        return idx >= 1 && idx <= citationCount ? `[\\[${n}\\]](#cite-${n})` : m
      })
      const close = s.indexOf('`', tick + 1)
      if (close === -1) {
        result += s.slice(tick)
        break
      }
      result += s.slice(tick, close + 1) // keep the inline-code span verbatim
      i = close + 1
    }
    out.push(result)
  }
  return out.join('')
}

function renderLatexDelimiter(value: string, className: string): string {
  const code = `<code class="${className}">${escapeHtml(value)}</code>`

  if (className.includes('math-display')) {
    return `\n\n<pre>${code}</pre>\n\n`
  }

  return code
}

function convertLatexDelimitersInPlainText(value: string): string {
  let output = ''
  let index = 0

  while (index < value.length) {
    const delimiter = latexDelimiters.find((item) => value.startsWith(item.open, index))

    if (!delimiter) {
      output += value[index]
      index += 1
      continue
    }

    const contentStart = index + delimiter.open.length
    const contentEnd = value.indexOf(delimiter.close, contentStart)

    if (contentEnd === -1) {
      output += delimiter.open
      index = contentStart
      continue
    }

    // Skip markdown link bracket-escapes like `[\[1\]](url)` — the closing
    // delimiter is followed by `](`, which is the link-text/href boundary.
    const afterClose = contentEnd + delimiter.close.length
    if (value[afterClose] === ']' && value[afterClose + 1] === '(') {
      output += value.slice(index, afterClose)
      index = afterClose
      continue
    }

    output += renderLatexDelimiter(value.slice(contentStart, contentEnd), delimiter.className)
    index = afterClose
  }

  return output
}

function convertOutsideInlineCode(value: string): string {
  let output = ''
  let index = 0

  while (index < value.length) {
    const tickStart = value.indexOf('`', index)

    if (tickStart === -1) {
      output += convertLatexDelimitersInPlainText(value.slice(index))
      break
    }

    output += convertLatexDelimitersInPlainText(value.slice(index, tickStart))

    let tickEnd = tickStart + 1
    while (value[tickEnd] === '`') tickEnd += 1

    const tickFence = value.slice(tickStart, tickEnd)
    const codeEnd = value.indexOf(tickFence, tickEnd)

    if (codeEnd === -1) {
      output += value.slice(tickStart)
      break
    }

    output += value.slice(tickStart, codeEnd + tickFence.length)
    index = codeEnd + tickFence.length
  }

  return output
}

function normalizeLatexMathDelimiters(content: string): string {
  const lines = content.match(/[^\r\n]*(?:\r\n|\n|\r|$)/g)?.filter(Boolean) ?? []
  let output = ''
  let pendingText = ''
  let fenceMarker = ''
  let fenceLength = 0

  const flushText = (): void => {
    if (!pendingText) return
    output += convertOutsideInlineCode(pendingText)
    pendingText = ''
  }

  for (const line of lines) {
    if (!fenceMarker) {
      const openingFence = /^( {0,3})(`{3,}|~{3,})/.exec(line)

      if (openingFence) {
        flushText()
        fenceMarker = openingFence[2][0]
        fenceLength = openingFence[2].length
        output += line
        continue
      }

      pendingText += line
      continue
    }

    output += line

    const closingFence = new RegExp(`^ {0,3}\\${fenceMarker}{${fenceLength},}(?:\\s|$)`)
    if (closingFence.test(line)) {
      fenceMarker = ''
      fenceLength = 0
    }
  }

  flushText()

  return output
}

function InlineCode({ children, ...props }: ComponentPropsWithoutRef<'code'>): React.JSX.Element {
  return (
    <code
      className="rounded border bg-muted px-1.5 py-0.5 font-mono text-sm text-foreground"
      {...props}>
      {children}
    </code>
  )
}

function createComponents(isStreaming: boolean): Record<string, React.ComponentType<never>> {
  return {
    code({ className, children, ...props }: ComponentPropsWithoutRef<'code'>) {
      const match = /language-(\w+)/.exec(className || '')
      const codeString = String(children).replace(/\n$/, '')

      if (match) {
        if (match[1] === 'math' && className?.includes('math-')) {
          return <MathBlock value={codeString} displayMode={className.includes('math-display')} />
        }
        if (match[1] === 'mermaid') {
          return <MermaidBlock code={codeString} isStreaming={isStreaming} />
        }
        return <CodeBlock code={codeString} language={match[1]} />
      }

      if (codeString.includes('\n')) {
        return <CodeBlock code={codeString} language="text" />
      }

      return <InlineCode {...props}>{children}</InlineCode>
    },

    pre({ children }: ComponentPropsWithoutRef<'pre'>) {
      return <>{children}</>
    },

    // remark-math block: $$...$$
    math({ value }: { value: string }) {
      return <MathBlock value={value} displayMode />
    },

    // remark-math inline: $...$
    inlineMath({ value }: { value: string }) {
      return <MathBlock value={value} displayMode={false} />
    },

    a({ href, children, ...props }: ComponentPropsWithoutRef<'a'>) {
      if (href && href.startsWith('#')) {
        const targetId = href.slice(1)
        return (
          <a
            href={href}
            className="text-primary underline"
            onClick={(event) => {
              event.preventDefault()
              const link = event.currentTarget as HTMLAnchorElement
              const selector = `#${CSS.escape(targetId)}`
              let scope: HTMLElement | null = link.parentElement
              let target: HTMLElement | null = null
              while (scope) {
                target = scope.querySelector<HTMLElement>(selector)
                if (target) break
                scope = scope.parentElement
              }
              if (!target) return
              for (let el: HTMLElement | null = target; el; el = el.parentElement) {
                if (el.tagName === 'DETAILS') (el as HTMLDetailsElement).open = true
              }
              target.scrollIntoView({ behavior: 'smooth', block: 'center' })
            }}
            {...props}>
            {children}
          </a>
        )
      }
      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline"
          {...props}>
          {children}
        </a>
      )
    },

    table({ children, ...props }: ComponentPropsWithoutRef<'table'>) {
      return (
        <div className="my-3 overflow-x-auto">
          <table className="border-collapse border" {...props}>
            {children}
          </table>
        </div>
      )
    },

    th({ children, ...props }: ComponentPropsWithoutRef<'th'>) {
      return (
        <th className="border bg-muted px-3 py-2 font-medium" {...props}>
          {children}
        </th>
      )
    },

    td({ children, ...props }: ComponentPropsWithoutRef<'td'>) {
      return (
        <td className="border px-3 py-2 text-foreground" {...props}>
          {children}
        </td>
      )
    },

    ul({ children, ...props }: ComponentPropsWithoutRef<'ul'>) {
      return (
        <ul className="my-2 ml-6 list-disc space-y-1" {...props}>
          {children}
        </ul>
      )
    },

    ol({ children, ...props }: ComponentPropsWithoutRef<'ol'>) {
      return (
        <ol className="my-2 ml-6 list-decimal space-y-1" {...props}>
          {children}
        </ol>
      )
    },

    blockquote({ children, ...props }: ComponentPropsWithoutRef<'blockquote'>) {
      return (
        <blockquote className="border-l-4 border-primary/30 pl-4 italic text-foreground" {...props}>
          {children}
        </blockquote>
      )
    },

    h1({ children, ...props }: ComponentPropsWithoutRef<'h1'>) {
      return (
        <h1 className="mb-3 mt-5 text-2xl font-semibold" {...props}>
          {children}
        </h1>
      )
    },

    h2({ children, ...props }: ComponentPropsWithoutRef<'h2'>) {
      return (
        <h2 className="mb-2 mt-4 text-xl font-semibold" {...props}>
          {children}
        </h2>
      )
    },

    h3({ children, ...props }: ComponentPropsWithoutRef<'h3'>) {
      return (
        <h3 className="mb-2 mt-3 text-lg font-semibold" {...props}>
          {children}
        </h3>
      )
    },

    h4({ children, ...props }: ComponentPropsWithoutRef<'h4'>) {
      return (
        <h4 className="mb-1 mt-3 text-base font-semibold" {...props}>
          {children}
        </h4>
      )
    },

    h5({ children, ...props }: ComponentPropsWithoutRef<'h5'>) {
      return (
        <h5 className="mb-1 mt-2 text-sm font-semibold" {...props}>
          {children}
        </h5>
      )
    },

    h6({ children, ...props }: ComponentPropsWithoutRef<'h6'>) {
      return (
        <h6 className="mb-1 mt-2 text-sm font-semibold text-foreground/70" {...props}>
          {children}
        </h6>
      )
    },

    p({ children, ...props }: ComponentPropsWithoutRef<'p'>) {
      return (
        <p className="my-2 leading-relaxed text-foreground whitespace-pre-wrap" {...props}>
          {children}
        </p>
      )
    },

    hr() {
      return <Separator className="my-4" />
    },

    sup({ children, ...props }: ComponentPropsWithoutRef<'sup'>) {
      return <sup {...props}>{children}</sup>
    },

    sub({ children, ...props }: ComponentPropsWithoutRef<'sub'>) {
      return <sub {...props}>{children}</sub>
    },

    mark({ children, ...props }: ComponentPropsWithoutRef<'mark'>) {
      return (
        <mark className="rounded bg-yellow-200 px-0.5 dark:bg-yellow-800" {...props}>
          {children}
        </mark>
      )
    },

    kbd({ children, ...props }: ComponentPropsWithoutRef<'kbd'>) {
      return (
        <kbd
          className="rounded border bg-muted px-1.5 py-0.5 font-mono text-xs shadow-sm"
          {...props}>
          {children}
        </kbd>
      )
    },

    details({ children, ...props }: ComponentPropsWithoutRef<'details'>) {
      return (
        <details className="my-2 rounded border p-3" {...props}>
          {children}
        </details>
      )
    },

    summary({ children, ...props }: ComponentPropsWithoutRef<'summary'>) {
      return (
        <summary className="cursor-pointer font-medium" {...props}>
          {children}
        </summary>
      )
    },
  }
}

const remarkPlugins = [remarkGfm, remarkMath, remarkSuperSub]
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const rehypePlugins: any[] = [rehypeRaw, [rehypeSanitize, sanitizeSchema]]

export const MarkdownRenderer = memo(function MarkdownRenderer({
  content,
  isStreaming = false,
  citationCount = 0,
}: MarkdownRendererProps) {
  const components = useMemo(() => createComponents(isStreaming), [isStreaming])
  const normalizedContent = useMemo(() => {
    const linkified = citationCount > 0 ? linkifyCitations(content, citationCount) : content
    return normalizeLatexMathDelimiters(linkified)
  }, [content, citationCount])

  return (
    <div className="markdown-body">
      <Markdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins} components={components}>
        {normalizedContent}
      </Markdown>
    </div>
  )
})
