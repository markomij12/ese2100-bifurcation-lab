import { useMemo } from "react"
import katex from "katex"

export function Markdown({ source }: { source: string }) {
  const html = useMemo(() => renderMarkdown(source), [source])
  return <div className="md" dangerouslySetInnerHTML={{ __html: html }} />
}

function renderMarkdown(source: string): string {
  const blocks = source.split(/\$\$([\s\S]+?)\$\$/g)
  let html = ""
  for (let i = 0; i < blocks.length; i++) {
    if (i % 2 === 1) {
      html += `<div class="math-display">${katex.renderToString(blocks[i].trim(), {
        displayMode: true,
        throwOnError: false,
      })}</div>`
    } else {
      html += renderText(blocks[i])
    }
  }
  return html
}

function renderText(text: string): string {
  const parts = text.split(/\$([^$\n]+?)\$/g)
  let html = ""
  for (let i = 0; i < parts.length; i++) {
    if (i % 2 === 1) {
      html += katex.renderToString(parts[i], { displayMode: false, throwOnError: false })
    } else {
      html += inlineFormat(escapeHtml(parts[i]))
    }
  }
  return paragraphs(html)
}

function inlineFormat(escaped: string): string {
  return escaped
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/(^|[\s(])\*([^*\n]+?)\*(?=$|[\s).,;:])/g, "$1<em>$2</em>")
}

function paragraphs(html: string): string {
  const chunks = html
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
  return chunks
    .map((chunk) => {
      const lines = chunk
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean)
      if (lines.length > 0 && lines.every((line) => line.startsWith("- "))) {
        return `<ul>${lines.map((line) => `<li>${line.slice(2)}</li>`).join("")}</ul>`
      }
      return `<p>${lines.join(" ")}</p>`
    })
    .join("")
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
}
