<script lang="ts">
    import Loading from "./Loading.svelte";
    import { fade } from "svelte/transition";

    export let message = "";
    export let backdropBlur = true;
</script>

<div
    in:fade={{ duration: 150, delay: 100 }}
    out:fade={{ duration: 150 }}
    class="absolute inset-0 flex items-center justify-center bg-background/80 {backdropBlur
        ? 'backdrop-blur-sm'
        : ''}"
>
    <Loading
        fullScreen={false}
        size="sm"
        {message}
        delayIn={0}
        durationIn={150}
        durationOut={150}
    />
</div>
