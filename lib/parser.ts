
export class HugoHighlightParser {
	lines: Set<number> = new Set()

	constructor(line: string) {
		// First, make sure the line has text inside braces (ex. ```js {some text})
		if (!/{.*}/.test(line)) {
			return
		}

		// Match a single number
		let match = line.match(/hl_lines="?(\d+)"?\s*/i)
		if (match) {
			this.addLine(Number.parseInt(match[1]))
			return
		}

		// Match an array of numbers
		match = line.match(/hl_lines=\[(.*)\]\s*/i)
		if (!match) {
			return
		}
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
						this.addRange(start, end)
					}
				}
			} else {
				// entry is a single number, which may be quoted
				const unquoted = quotedMatch?.at(1) ?? entry
				const num = Number.parseInt(unquoted)
				if (!Number.isNaN(num)) {
					this.addLine(num)
				}
			}
		}
	}

	addLine(line: number) {
		this.lines.add(line)
	}

	addRange(start: number, end: number) {
		if (start > end) {
			[start, end] = [end, start]
		}
		for (let line = start; line <= end; line++) {
			this.lines.add(line)
		}
	}

	removeRange(start: number, end: number) {
		if (start > end) {
			[start, end] = [end, start]
		}
		for (let line = start; line <= end; line++) {
			this.lines.delete(line)
		}
	}

	containsLine(line: number): boolean {
		return this.lines.has(line)
	}

	/**
	 * Format `lines` into Hugo's `hl_lines` attribute format,
	 * Converting consecutive lines into ranges
	 */
	formatAttr(): string {
		let out = "hl_lines=["

		if (this.lines.size > 0) {
			const lines = [...this.lines]
			lines.sort((a, b) => a - b)

			for (let i = 0; i < lines.length; i++) {
				const rangeStart = lines[i]
				let rangeEnd = rangeStart
				// detect continous ranges
				while (lines[i] + 1 === lines[i + 1]) {
					rangeEnd = lines[i + 1]
					i++
				}
				if (rangeStart === rangeEnd) {
					out += `"${rangeStart}",`
				} else {
					out += `"${rangeStart}-${rangeEnd}",`
				}
			}

			out = out.slice(0, -1) // remove last comma
		}

		out += "]"
		return out
	}
}

export function updateHighlightLine(newAttr: string, lineText: string) {
	if (/hl_lines=\[.*\]/i.test(lineText)) {
		// replace the existing hl_lines declaration
		return lineText.replace(/hl_lines=\[.*\]/i, newAttr);
	} else {
		const indexOfOpenBrace = lineText.indexOf('{');
		const indexOfCloseBrace = lineText.lastIndexOf('}')
		if (indexOfOpenBrace >= indexOfCloseBrace /* -1 >= -1 */) {
			// invalid / no braces, append to the end
			return lineText.trimEnd() + ` {${newAttr}}`;
		}

		const inside = lineText.slice(indexOfOpenBrace + 1, indexOfCloseBrace).trim()
		// Insert attr inside braces
		return lineText.slice(0, indexOfCloseBrace).trimEnd()
			+ (inside.length === 0 ? newAttr : `,${newAttr}`)
			+ lineText.slice(indexOfCloseBrace);
	}
}