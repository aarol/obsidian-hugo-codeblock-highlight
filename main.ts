import { Decoration, DecorationSet, EditorView, PluginValue, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { Range, RangeSet } from '@codemirror/state'
import { syntaxTree } from '@codemirror/language'
import { Editor, MarkdownFileInfo, MarkdownView, Menu, Plugin } from "obsidian";
import { HugoHighlightParser, updateHighlightLine } from "lib/parser";

export default class HugoHighlight extends Plugin {
	async onload() {
		this.registerEditorExtension(ViewPlugin.fromClass(HighlightViewPlugin, { decorations: (plugin) => plugin.decorations }))

		this.registerEvent(
			this.app.workspace.on("editor-menu", this.showHighlightMenu)
		);
	}

	showHighlightMenu = (menu: Menu, editor: Editor, view: MarkdownView | MarkdownFileInfo) => {
		if (!view.file) return

		// Use the file cache to get a list of all markdown sections
		const cache = this.app.metadataCache.getFileCache(view.file)

		const selections = editor.listSelections()
		// From all selection ranges, get the minimum and maximum line numbers
		const minLine = Math.min(...selections.map(sel => Math.min(sel.anchor.line, sel.head.line)))
		const maxLine = Math.max(...selections.map(sel => Math.max(sel.anchor.line, sel.head.line)))

		cache?.sections?.forEach(section => {
			const { end: codeblockEnd, start: codeblockStart } = section.position
			// Check if all selected lines are within a codeblock 
			if (section.type === 'code' && minLine > codeblockStart.line && maxLine < codeblockEnd.line) {

				// Parse the codeblock fence text (```js {hl_lines=...})
				const lineText = editor.getLine(codeblockStart.line)
				const hlParser = new HugoHighlightParser(lineText)

				const updateCodeblockFence = () => {
					// newAttr is something like hl_lines=["1"]
					const newAttr = hlParser.formatAttr()
					const newLineText = updateHighlightLine(newAttr, lineText);

					editor.replaceRange(newLineText, { ch: 0, line: codeblockStart.line }, { ch: lineText.length, line: codeblockStart.line });
				}

				const allSelectedLinesAreHighlighted = selections.every(sel => {
					let [start, end] = [sel.head.line - codeblockStart.line, sel.anchor.line - codeblockStart.line]
					if (start > end) {
						[start, end] = [end, start]
					}
					for (let line = start; line <= end; line++) {
						if (!hlParser.containsLine(line)) {
							return false
						}
					}
					return true
				})

				// Show "unhighlight" button when all selected lines are highlighted
				if (allSelectedLinesAreHighlighted) {
					menu.addItem(item => {
						item.setTitle("Unhighlight selected lines")
							.setIcon('eraser')
							.onClick(() => {
								for (const sel of selections) {
									hlParser.removeRange(sel.head.line - codeblockStart.line, sel.anchor.line - codeblockStart.line)
								}
								updateCodeblockFence();
							})
					})
				} else {
					menu.addItem((item) => {
						item
							.setTitle("Highlight selected lines")
							.setIcon("highlighter")
							.onClick(() => {
								for (const sel of selections) {
									hlParser.addRange(sel.head.line - codeblockStart.line, sel.anchor.line - codeblockStart.line)
								}
								updateCodeblockFence();
							});
					});
				}
			}
		})
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
		let hlParser: HugoHighlightParser | null = null

		for (const { from, to } of view.visibleRanges) {
			syntaxTree(view.state).iterate({
				from, to,
				enter(node) {
					if (node.type.name.includes("HyperMD-codeblock-begin")) {
						const line = view.state.doc.lineAt(node.from)

						beginLineNumber = line.number
						const lineText = view.state.sliceDoc(line.from, line.to)

						hlParser = new HugoHighlightParser(lineText)
					}
					if (node.type.name.includes("HyperMD-codeblock-bg")) {
						const line = view.state.doc.lineAt(node.from)

						const lineNumber = line.number - beginLineNumber
						if (hlParser !== null && hlParser.containsLine(lineNumber)) {
							decorations.push(Decoration.line({ class: "hugo-line-highlight" }).range(node.from))
						}
					}
				}
			})
		}

		return RangeSet.of(decorations, true)
	}
}
