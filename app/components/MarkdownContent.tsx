import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

const chatClasses =
  "text-sm leading-relaxed [&_p]:my-1 [&_ul]:my-1.5 [&_ul]:list-disc [&_ul]:pl-4 [&_ol]:my-1.5 [&_ol]:list-decimal [&_ol]:pl-4 [&_li]:my-0.5 [&_strong]:text-slate-200 [&_code]:rounded [&_code]:bg-white/10 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:text-[13px]";

const summaryClasses =
  "text-[14.5px] leading-relaxed text-slate-50 " +

  "[&_h1]:mt-8 [&_h1]:mb-4 [&_h1]:text-2xl [&_h1]:font-bold " +
  "[&_h1]:text-fuchsia-300 " +

  "[&_h2]:mt-6 [&_h2]:mb-3 [&_h2]:text-xl [&_h2]:font-bold " +
  "[&_h2]:bg-gradient-to-br [&_h2]:from-purple-300 [&_h2]:to-fuchsia-400 " +
  "[&_h2]:bg-clip-text [&_h2]:text-transparent " +

  "[&_h3]:mt-5 [&_h3]:mb-2 [&_h3]:text-base [&_h3]:font-semibold " +
  "[&_h3]:text-purple-300 " +

  "[&_h4]:mt-4 [&_h4]:mb-2 [&_h4]:font-semibold " +
  "[&_h4]:text-purple-200 " +

  "[&_p]:my-2 " +

  "[&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5 " +
  "[&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 " +
  "[&_li]:my-1 " +

  "[&_strong]:font-semibold [&_strong]:text-slate-200 " +

  "[&_blockquote]:my-3 " +
  "[&_blockquote]:rounded-r-lg " +
  "[&_blockquote]:border-l-[3px] " +
  "[&_blockquote]:border-amber-500/50 " +
  "[&_blockquote]:bg-amber-500/10 " +
  "[&_blockquote]:py-3 " +
  "[&_blockquote]:pl-4 " +

  "[&_pre]:my-3 " +
  "[&_pre]:overflow-x-auto " +
  "[&_pre]:rounded-lg " +
  "[&_pre]:bg-black/30 " +
  "[&_pre]:p-4 " +

  "[&_code]:rounded " +
  "[&_code]:bg-white/10 " +
  "[&_code]:px-1.5 " +
  "[&_code]:py-0.5 " +
  "[&_code]:text-[13px] " +

  "[&_table]:my-3 " +
  "[&_table]:w-full " +
  "[&_table]:border-collapse " +
  "[&_table]:overflow-hidden " +

  "[&_th]:border " +
  "[&_th]:border-purple-400/20 " +
  "[&_th]:bg-purple-600/20 " +
  "[&_th]:px-3.5 " +
  "[&_th]:py-2.5 " +
  "[&_th]:text-left " +
  "[&_th]:font-semibold " +
  "[&_th]:text-purple-300 " +

  "[&_td]:border " +
  "[&_td]:border-purple-400/20 " +
  "[&_td]:px-3.5 " +
  "[&_td]:py-2 " +

  "[&_a]:text-blue-400 " +
  "[&_a]:underline " +
  "[&_a:hover]:text-blue-300";

type Variant = "chat" | "summary";

interface MarkdownContentProps {
  children: string;
  variant?: Variant;
}

export default function MarkdownContent({
  children,
  variant = "summary",
}: MarkdownContentProps) {
  return (
    <div className={variant === "chat" ? chatClasses : summaryClasses}>
      <ReactMarkdown remarkPlugins={[remarkGfm]}>
        {children}
      </ReactMarkdown>
    </div>
  );
}