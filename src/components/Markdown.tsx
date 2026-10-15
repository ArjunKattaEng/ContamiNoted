import ReactMarkdown from 'react-markdown'
import rehypeSanitize from 'rehype-sanitize'
import { cn } from '@/lib/utils'

/** Renders AI summary markdown. Sanitized, since it is model output. */
export function Markdown({ children, className }: { children: string; className?: string }) {
  return (
    <div
      className={cn(
        'space-y-2 text-sm leading-relaxed [&_em]:text-muted-foreground [&_strong]:font-semibold [&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5',
        className,
      )}
    >
      <ReactMarkdown
        rehypePlugins={[rehypeSanitize]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
              {children}
            </a>
          ),
        }}
      >
        {children}
      </ReactMarkdown>
    </div>
  )
}
