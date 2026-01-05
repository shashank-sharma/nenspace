export const MARKDOWN_EXTENSIONS = ['.md', '.markdown']

export const DEFAULT_NOTE_CONTENT = `# New Note

`

export const TEMPLATE_VARIABLES = {
  date: () => new Date().toISOString().split('T')[0],
  time: () => new Date().toTimeString().split(' ')[0],
  datetime: () => new Date().toISOString(),
  title: (title: string) => title
}

