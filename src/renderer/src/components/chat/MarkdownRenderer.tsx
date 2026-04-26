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
}

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
  ],
  attributes: {
    ...defaultSchema.attributes,
    code: [['className', /^language-.|^math-/]],
    abbr: [...(defaultSchema.attributes?.abbr || []), 'title'],
    details: [...(defaultSchema.attributes?.details || []), 'open'],
  },
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
}: MarkdownRendererProps) {
  const components = useMemo(() => createComponents(isStreaming), [isStreaming])

  return (
    <div className="markdown-body">
      <Markdown remarkPlugins={remarkPlugins} rehypePlugins={rehypePlugins} components={components}>
        {content}
      </Markdown>
    </div>
  )
})
