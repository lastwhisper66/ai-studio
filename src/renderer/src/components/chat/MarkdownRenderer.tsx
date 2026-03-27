import { memo, type ComponentPropsWithoutRef } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { Separator } from '@renderer/components/ui/separator'
import { CodeBlock } from './CodeBlock'

interface MarkdownRendererProps {
  content: string
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

const components = {
  code({ className, children, ...props }: ComponentPropsWithoutRef<'code'>) {
    const match = /language-(\w+)/.exec(className || '')
    const codeString = String(children).replace(/\n$/, '')

    // Block code: has language class, rendered inside <pre>
    if (match) {
      return <CodeBlock code={codeString} language={match[1]} />
    }

    // Heuristic: multi-line code without language is also a block
    if (codeString.includes('\n')) {
      return <CodeBlock code={codeString} language="text" />
    }

    // Inline code
    return <InlineCode {...props}>{children}</InlineCode>
  },

  pre({ children }: ComponentPropsWithoutRef<'pre'>) {
    // Avoid double wrapping — CodeBlock already renders its own container
    return <>{children}</>
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
}

export const MarkdownRenderer = memo(function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="markdown-body">
      <Markdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </Markdown>
    </div>
  )
})
