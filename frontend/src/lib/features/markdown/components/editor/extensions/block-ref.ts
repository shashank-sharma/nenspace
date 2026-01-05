import { Decoration } from '@codemirror/view'
import { StateField, Range } from '@codemirror/state'

const blockRefRegex = /\^([a-zA-Z0-9]+)/g

export function blockRefExtension() {
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
        while ((match = blockRefRegex.exec(text)) !== null) {
          const from = line.from + match.index
          const to = from + match[0].length

          newDecorations.push(
            Decoration.mark({
              class: 'cm-block-ref',
              attributes: {
                'data-block-id': match[1]
              }
            }).range(from, to)
          )
        }
      }

      return Decoration.set(newDecorations)
    }
  })
}

