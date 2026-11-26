import Markdown from "react-markdown";
import remarkGfm from "remark-gfm";

export function RichText({ text }: { text: string }) {
  return <div className="markdown"><Markdown remarkPlugins={[remarkGfm]} skipHtml components={{
    img: ({ alt }) => <span>{alt}</span>,
    a: ({ href, children }) => /^https?:\/\//i.test(href ?? "")
      ? <a href={href} target="_blank" rel="noreferrer">{children}</a> : <span>{children}</span>
  }}>{text}</Markdown></div>;
}
