<script lang="ts">
  import SharedBookmarkForm from "../shared/SharedBookmarkForm.svelte"
  import { createLogger } from "../../utils/logger.util"

  const logger = createLogger("[AddBookmarkPanel]")

  export let onClose: () => void

  async function handleSave(data: {
    url: string
    title: string
    tags: string
    notes: string
  }) {
    logger.debug("Saving bookmark", data)

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000))
  }
</script>

<SharedBookmarkForm onSave={handleSave} onCancel={onClose} />
