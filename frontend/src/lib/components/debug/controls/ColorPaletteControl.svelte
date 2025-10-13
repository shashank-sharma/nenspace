<script lang="ts">
    import { browser } from "$app/environment";
    import { ThemeService } from "$lib/services/theme.service.svelte";
    import { IslandNotificationService } from "$lib/services/island-notification.service.svelte";
    import { hexToHslValues, hslToHex, parseHsl } from "$lib/utils/color.utils";

    type ColorInfo = {
        name: string;
        value: string;
        hsl: string;
    };

    let activeThemeColors = $state<ColorInfo[]>([]);
    let activeThemeName = $state("");
    let colorPickerElement: HTMLInputElement;
    let currentEditingColorVar = "";

    function getThemeColors(theme: string): ColorInfo[] {
        if (!browser) return [];

        const themeSelector = `[data-theme="${theme}"]`;
        const styleSheets = document.styleSheets;
        const colors: Record<string, { value: string; hsl: string }> = {};

        for (let i = 0; i < styleSheets.length; i++) {
            try {
                const sheet = styleSheets[i];
                if (sheet.cssRules) {
                    for (let j = 0; j < sheet.cssRules.length; j++) {
                        const rule = sheet.cssRules[j] as CSSStyleRule;
                        if (rule.selectorText === themeSelector) {
                            const style = rule.style;
                            for (let k = 0; k < style.length; k++) {
                                const propName = style[k];
                                if (propName.startsWith("--")) {
                                    const hslValue = style
                                        .getPropertyValue(propName)
                                        .trim();
                                    const hslArr = parseHsl(hslValue);
                                    if (hslArr) {
                                        const hexValue = hslToHex(...hslArr);
                                        colors[propName] = {
                                            value: hexValue,
                                            hsl: `hsl(${hslArr[0]}, ${hslArr[1]}%, ${hslArr[2]}%)`,
                                        };
                                    }
                                }
                            }
                        }
                    }
                }
            } catch (e) {
                // CORS errors can happen with external stylesheets
            }
        }

        return Object.entries(colors).map(([name, { value, hsl }]) => ({
            name,
            value,
            hsl,
        }));
    }

    $effect(() => {
        if (browser) {
            let currentTheme = ThemeService.theme;
            if (currentTheme === "system") {
                currentTheme = window.matchMedia("(prefers-color-scheme: dark)")
                    .matches
                    ? "dark"
                    : "light";
            }
            activeThemeColors = getThemeColors(currentTheme);
            activeThemeName = currentTheme;
        }
    });

    function openColorPicker(variableName: string, currentColor: string) {
        currentEditingColorVar = variableName;
        colorPickerElement.value = currentColor;
        colorPickerElement.click();
    }

    function handleColorChange(event: Event) {
        const newColorHex = (event.target as HTMLInputElement).value;
        const newColorHsl = hexToHslValues(newColorHex);

        document.documentElement.style.setProperty(
            currentEditingColorVar,
            newColorHsl,
        );

        const colorToUpdate = activeThemeColors.find(
            (c) => c.name === currentEditingColorVar,
        );
        if (colorToUpdate) {
            colorToUpdate.value = newColorHex.toUpperCase();
        }
    }

    async function copyToClipboard(text: string) {
        try {
            await navigator.clipboard.writeText(text);
            IslandNotificationService.success("Copied to clipboard!");
        } catch (err) {
            IslandNotificationService.error("Failed to copy");
            console.error("Failed to copy text: ", err);
        }
    }
</script>

<input
    type="color"
    bind:this={colorPickerElement}
    on:input={handleColorChange}
    class="absolute -z-10 w-0 h-0 opacity-0"
/>

<div class="space-y-2 p-2 text-xs">
    <h3 class="font-semibold text-sm mb-2 capitalize">
        {activeThemeName} Theme
    </h3>
    <div class="space-y-1">
        {#each activeThemeColors as color}
            <div
                class="flex items-center justify-between p-1 hover:bg-muted/50 rounded"
            >
                <div class="flex items-center gap-2">
                    <button
                        class="w-4 h-4 rounded border"
                        style="background-color: {color.value}"
                        title="Click to change color"
                        on:click={() =>
                            openColorPicker(color.name, color.value)}
                    ></button>
                    <span class="font-mono text-xs">{color.name}</span>
                </div>
                <button
                    class="font-mono text-xs text-muted-foreground"
                    on:click={() => copyToClipboard(color.value)}
                    title="Click to copy HEX"
                >
                    {color.value}
                </button>
            </div>
        {/each}
    </div>
</div>
