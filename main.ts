import { Decoration, DecorationSet, EditorView, PluginValue, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { Range, RangeSet } from '@codemirror/state'
import { syntaxTree } from '@codemirror/language'
import { Plugin } from "obsidian";

export default class HugoHighlight extends Plugin {
	async onload() {
		this.registerEditorExtension(ViewPlugin.fromClass(HighlightViewPlugin, { decorations: (plugin) => plugin.decorations }))
	}
}

class HighlightViewPlugin implements PluginValue {
	decorations: DecorationSet;

	constructor(view: EditorView) {
		this.decorations = this.buildDecorations(view)
	}

	update(update: ViewUpdate): void {
		if (update.viewportChanged || update.docChanged) {
			this.decorations = this.buildDecorations(update.view)
		}
	}

	buildDecorations(view: EditorView): DecorationSet {
		const decorations: Array<Range<Decoration>> = []

		// tree will be iterated in such order that
		// these variables will be reassigned when a new codeblock begins
		let beginLineNumber = 0
		let linesToHighlight: number[] = []

		for (const { from, to } of view.visibleRanges) {
			syntaxTree(view.state).iterate({
				from, to,
				enter(node) {
					if (node.type.name.includes("HyperMD-codeblock-begin")) {
						const line = view.state.doc.lineAt(node.from)

						beginLineNumber = line.number
						const lineText = view.state.sliceDoc(line.from, line.to)

						if (/{.*}/.test(lineText)) {
							linesToHighlight = extractHLLines(lineText)
						} else {
							linesToHighlight = []
						}
					}
					if (node.type.name.includes("HyperMD-codeblock-bg")) {
						const line = view.state.doc.lineAt(node.from)

						const lineNumber = line.number - beginLineNumber
						if (linesToHighlight.includes(lineNumber)) {
							decorations.push(Decoration.line({ class: "hugo-line-highlight" }).range(node.from))
						}
					}
				}
			})
		}

		return RangeSet.of(decorations, true)
	}
}

function extractHLLines(line: string): number[] {

	// Match a single number
	let match = line.match(/hl_lines="?(\d+)"?\s*/)
	if (match) {
		return [Number.parseInt(match[1])]
	}

	// Match an array of numbers
	match = line.match(/hl_lines=\[(.*)\]\s*/)
	if (!match) {
		return []
	}
	const lineNumbers: number[] = []
	// valid matches: "3", 3, "3-6"
	// invalid matches: 3-6, '3', '3-6', "6-3"
	const lineEntries = match[1].split(",").map(s => s.trim())
	for (const entry of lineEntries) {

		const isRange = entry.includes("-")
		const quotedMatch = entry.match(/^"(.+)"$/)
		if (isRange) {
			// only accept quoted ranges
			if (quotedMatch) {
				const [start, end] = quotedMatch[1].split("-").map(n => Number.parseInt(n))

				if (start < end) {
					for (let i = start; i <= end; i++) {
						lineNumbers.push(i)
					}
				}
			}
		} else {
			// entry is a single number, which may be quoted
			const unquoted = quotedMatch?.at(1) ?? entry
			const num = Number.parseInt(unquoted)
			if (!Number.isNaN(num)) {
				lineNumbers.push(num)
			}
		}
	}

	return lineNumbers
}