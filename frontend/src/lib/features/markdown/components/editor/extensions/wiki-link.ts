import { Decoration, EditorView } from '@codemirror/view'
import { StateField, Range } from '@codemirror/state'
import { syntaxTree } from '@codemirror/language'

const wikiLinkRegex = /\[\[([^\]]+)\]\]/g

export function wikiLinkExtension() {
  return StateField.define({
    create() {
      return Decoration.none
    },
    update(decorations, tr) {
      if (!tr.docChanged && !tr.selection) return decorations

      const newDecorations: Range<Decoration>[] = []
      const doc = tr.state.doc

      for (let i = 0; i < doc.lines; i++) {
        const line = doc.line(i + 1)
        const text = line.text

        let match
        while ((match = wikiLinkRegex.exec(text)) !== null) {
          const from = line.from + match.index
          const to = from + match[0].length

          newDecorations.push(
            Decoration.mark({
              class: 'cm-wiki-link',
              attributes: {
                'data-target': match[1]
              }
            }).range(from, to)
          )
        }
      }

      return Decoration.set(newDecorations)
    },
    provide: f => EditorView.decorations.from(f)
  })
}

