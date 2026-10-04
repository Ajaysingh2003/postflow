import type { ReactNode } from "react";

function inline(text: string): ReactNode[] {
  return text
    .split(
      /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^\s)]+\)|\*[^*]+\*)/g,
    )
    .map((part, index) => {
      if (part.startsWith("**") && part.endsWith("**"))
        return <strong key={index}>{part.slice(2, -2)}</strong>;
      if (part.startsWith("`") && part.endsWith("`"))
        return <code key={index}>{part.slice(1, -1)}</code>;
      if (part.startsWith("*") && part.endsWith("*"))
        return <em key={index}>{part.slice(1, -1)}</em>;
      const link = part.match(/^\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)$/);
      if (link)
        return (
          <a
            key={index}
            href={link[2]}
            target="_blank"
            rel="noopener noreferrer"
          >
            {link[1]}
          </a>
        );
      return part;
    });
}

/** Renders common Reddit writing syntax as React text nodes; raw HTML is never interpreted. */
export default function MarkdownPreview({ text }: { text: string }) {
  const lines = text.split("\n");
  const nodes: ReactNode[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.startsWith("```")) {
      const start = i;
      const code: string[] = [];
      while (++i < lines.length && !lines[i].startsWith("```"))
        code.push(lines[i]);
      nodes.push(
        <pre key={start}>
          <code>{code.join("\n")}</code>
        </pre>,
      );
    } else if (/^#{1,3} /.test(line)) {
      const level = line.indexOf(" ");
      const content = inline(line.slice(level + 1));
      nodes.push(
        level === 1 ? <h2 key={i}>{content}</h2> : <h3 key={i}>{content}</h3>,
      );
    } else if (/^[-*] /.test(line) || /^\d+\. /.test(line)) {
      const start = i;
      const ordered = /^\d+\./.test(line);
      const pattern = ordered ? /^\d+\. / : /^[-*] /;
      const items: ReactNode[] = [];
      while (i < lines.length && pattern.test(lines[i])) {
        items.push(<li key={i}>{inline(lines[i].replace(pattern, ""))}</li>);
        i++;
      }
      i--;
      nodes.push(
        ordered ? <ol key={start}>{items}</ol> : <ul key={start}>{items}</ul>,
      );
    } else if (line.startsWith("> "))
      nodes.push(<blockquote key={i}>{inline(line.slice(2))}</blockquote>);
    else
      nodes.push(
        line ? (
          <p key={i}>{inline(line)}</p>
        ) : (
          <div className="h-3" key={i} />
        ),
      );
  }
  return (
    <div className="whitespace-normal text-[15px] leading-[1.85] [&_p]:whitespace-pre-wrap [&_h2]:text-[21px] [&_h2]:font-semibold [&_h2]:mt-[18px] [&_h2]:mb-[9px] [&_h3]:text-[18px] [&_h3]:font-semibold [&_h3]:mt-[15px] [&_h3]:mb-2 [&_ul]:pl-[23px] [&_ul]:my-2 [&_ul]:list-disc [&_ol]:pl-[23px] [&_ol]:my-2 [&_ol]:list-decimal [&_li]:my-[3px] [&_blockquote]:border-l-[3px] [&_blockquote]:border-border [&_blockquote]:pl-3.5 [&_blockquote]:text-muted-foreground [&_blockquote]:my-2.5 [&_code]:font-mono [&_code]:text-xs [&_code]:rounded [&_code]:bg-muted [&_code]:px-1 [&_code]:py-0.5 [&_pre]:whitespace-pre-wrap [&_pre]:bg-muted [&_pre]:p-3.5 [&_pre]:rounded-md [&_pre]:my-3 [&_a]:text-[#287cad] [&_a]:underline [&_a]:break-all">
      {nodes}
    </div>
  );
}
