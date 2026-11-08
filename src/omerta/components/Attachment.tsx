import { FileText } from "lucide-react";

const TOKEN = /\[img:(data:[^[\]]+)\]|\[file:([^:\]]+):(data:[^[\]]+)\]/g;

export const MAX_ATTACHMENT_BYTES = 700 * 1024;

export function packAttachment(file: File, url: string) {
  if (file.type.startsWith("image/")) return `[img:${url}]`;
  const name = encodeURIComponent(file.name || "file");
  return `[file:${name}:${url}]`;
}

export function attachmentLabel(content: string) {
  if (content.startsWith("[img:")) return "Photo";
  if (content.startsWith("[file:")) {
    const name = content.slice(6, content.indexOf(":"));
    try { return decodeURIComponent(name); } catch { return "File"; }
  }
  return content;
}

export function AttachmentView({ content }: { content: string }) {
  const parts: Array<{ kind: "text" | "image" | "file"; value: string; name?: string }> = [];
  let last = 0;
  for (const match of content.matchAll(TOKEN)) {
    const index = match.index ?? 0;
    if (index > last) parts.push({ kind: "text", value: content.slice(last, index).trim() });
    if (match[1]) parts.push({ kind: "image", value: match[1] });
    else if (match[2] && match[3]) {
      let name = match[2];
      try { name = decodeURIComponent(match[2]); } catch { /* keep raw */ }
      parts.push({ kind: "file", value: match[3], name });
    }
    last = index + match[0].length;
  }
  if (last < content.length) parts.push({ kind: "text", value: content.slice(last).trim() });
  const shown = parts.filter((part) => part.kind !== "text" || part.value);
  if (shown.length === 0) return null;
  return (
    <div className="space-y-2">
      {shown.map((part, index) => {
        if (part.kind === "image") {
          return <img key={index} src={part.value} alt="" className="max-w-full max-h-64 rounded-md object-cover" />;
        }
        if (part.kind === "file") {
          return (
            <a key={index} href={part.value} download={part.name} className="flex items-center gap-2 px-2 py-2 rounded-sm border" style={{ borderColor: "hsl(var(--border))", color: "hsl(var(--foreground))" }}>
              <FileText size={14} style={{ color: "hsl(var(--primary))" }} />
              <span className="font-mono text-xs truncate">{part.name}</span>
            </a>
          );
        }
        return <p key={index} className="font-mono text-sm leading-relaxed whitespace-pre-wrap break-words">{part.value}</p>;
      })}
    </div>
  );
}
