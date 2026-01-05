import { Decoration } from '@codemirror/view'
import { StateField, Range } from '@codemirror/state'

const tagRegex = /#([a-zA-Z0-9_-]+)/g

export function tagExtension() {
  return StateField.define({
    create() {
      return Decoration.none
    },
    update(decorations, tr) {
      if (!tr.docChanged) return decorations

      const newDecorations: Range<Decoration>[] = []
      const doc = tr.state.doc

      for (let i = 0; i < doc.lines; i++) {
        const line = doc.line(i + 1)
        const text = line.text

        let match
        while ((match = tagRegex.exec(text)) !== null) {
          const from = line.from + match.index
          const to = from + match[0].length

          newDecorations.push(
            Decoration.mark({
              class: 'cm-tag',
              attributes: {
                'data-tag': match[1]
              }
            }).range(from, to)
          )
        }
      }

      return Decoration.set(newDecorations)
    }
  })
}

