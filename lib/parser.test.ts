import { HugoHighlightParser, updateHighlightLine } from './parser'
import { expect, describe, it } from 'vitest'

describe('HugoHighlightParser', () => {
  // parses markdown codeblock fence text correctly
  const cases = {
    "```go": "hl_lines=[]",
    "```go {}": "hl_lines=[]",
    '```go {.wrap}': `hl_lines=[]`,
    '```go {hl-lines=[1]}': `hl_lines=[]`, // with dash
    "```go {hl_lines=[1]}": `hl_lines=["1"]`,
    '```go {hl_lines=[1, "2"]}': `hl_lines=["1-2"]`,
    '```go {hl_lines=[1, "2", "4-6"]}': `hl_lines=["1-2","4-6"]`,
    '```go {hl_lines=[1, 2, 3, 4, 5, 999]}': `hl_lines=["1-5","999"]`,
  }

  Object.entries(cases).forEach(([input, expected]) => {
    it(`Parses '${input}' to '${expected}'`, () => {

      const parser = new HugoHighlightParser(input)

      const output = parser.formatAttr()

      expect(output).toBe(expected)
    })
  })
})

describe('updateHighlightLine', () => {
  const cases = {
    "```go": '```go {hl_lines=["1", "2-3"]}', // empty
    "```go {}": '```go {hl_lines=["1", "2-3"]}', // empty (braces)
    "```go {hl_lines=[1]}": '```go {hl_lines=["1", "2-3"]}', // update
    "```go {.wrap}": '```go {.wrap,hl_lines=["1", "2-3"]}', // with class
    "```go {.wrap, hl_lines=[1]}": '```go {.wrap, hl_lines=["1", "2-3"]}', // with class, update
    "```go {linenos=table}": '```go {linenos=table,hl_lines=["1", "2-3"]}', // with attribute
    "```go {HL_LINES=[1]}": '```go {hl_lines=["1", "2-3"]}', // uppercase
    "```go {hl_Lines=[1]}": '```go {hl_lines=["1", "2-3"]}', // mixed case
    "```go { }": '```go {hl_lines=["1", "2-3"]}', // empty attrs
    "```go {.wrap }": '```go {.wrap,hl_lines=["1", "2-3"]}', // class with trailing space
  }

  Object.entries(cases).forEach(([lineText, expected]) => {
    const updatedAttr = `hl_lines=["1", "2-3"]`

    it(`Updates '${lineText}' to '${expected}'`, () => {

      const output = updateHighlightLine(updatedAttr, lineText)
 
      expect(output).toBe(expected)
    })
  })
})


