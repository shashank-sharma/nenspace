import { autocompletion, CompletionContext } from '@codemirror/autocomplete'
import { notesStore } from '../../../stores'

export function linkAutocompleteExtension() {
  return autocompletion({
    override: [
      async (context: CompletionContext) => {
        const { state, pos } = context
        const line = state.doc.lineAt(pos)
        const textBefore = line.text.slice(0, pos - line.from)

        const match = textBefore.match(/\[\[([^\]]*)$/)
        if (!match) return null

        const query = match[1].toLowerCase()
        const notes = notesStore.notes

        const options = notes
          .filter(note =>
            note.title.toLowerCase().includes(query) ||
            note.path.toLowerCase().includes(query) ||
            note.aliases.some(a => a.toLowerCase().includes(query))
          )
          .slice(0, 10)
          .map(note => ({
            label: note.title,
            type: 'note',
            apply: `[[${note.title}]]`,
            info: note.path
          }))

        return {
          from: pos - match[1].length - 2,
          to: pos,
          options
        }
      }
    ]
  })
}

