"use client"

import { useEffect, useState } from "react"
import { codeToHtml } from "shiki"

interface CodeBlockProps {
	code: string
	language?: string
	theme?: string
	className?: string
}

export function CodeBlock({ code, language = "javascript", theme = "github-light", className = "" }: CodeBlockProps) {
	const [highlightedCode, setHighlightedCode] = useState<string>("")
	const [isLoading, setIsLoading] = useState(true)

	useEffect(() => {
		const highlightCode = async () => {
			try {
				setIsLoading(true)
				const html = await codeToHtml(code, {
					lang: language,
					theme: theme,
				})
				setHighlightedCode(html)
			} catch (error) {
				console.warn("Failed to highlight code:", error)
				// Fallback to plain text
				setHighlightedCode(`<pre><code>${code}</code></pre>`)
			} finally {
				setIsLoading(false)
			}
		}

		highlightCode()
	}, [code, language, theme])

	if (isLoading) {
		return (
			<div className={`bg-gray-50 border border-gray-200 rounded p-4 ${className}`}>
				<div className="flex items-center space-x-2 text-gray-500">
					<div className="animate-spin w-3 h-3 border border-gray-300 border-t-gray-600 rounded-full"></div>
					<span className="text-xs">Highlighting code...</span>
				</div>
			</div>
		)
	}

	return (
		<div
			className={`overflow-auto rounded border border-gray-200 ${className}`}
			dangerouslySetInnerHTML={{ __html: highlightedCode }}
			style={{
				fontSize: "12px",
				lineHeight: "1.5",
			}}
		/>
	)
}
