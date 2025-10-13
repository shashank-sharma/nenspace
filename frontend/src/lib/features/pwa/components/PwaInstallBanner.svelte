<script lang="ts">
  import { onMount } from "svelte";
  import { fly } from "svelte/transition";
  import { X, Download, Info, Menu } from "lucide-svelte";
  import { Button } from "$lib/components/ui/button";
  import { PwaService } from "$lib/features/pwa/services/pwa.service.svelte";
  import { browser } from "$app/environment";

  // Most state is now derived from the PwaService
  let show = $state(false);
  let dismissed = $state(false);
  let showManualInstructions = $state(false);
  let unavailabilityReason = $state("Unknown reason");

  // Browser detection for installation instructions
  let browserInfo = $state({
    isChrome: false,
    isFirefox: false,
    isSafari: false,
    isEdge: false,
    isIOS: false,
    name: "your browser",
  });

  function checkDismissed() {
    if (browser) {
      dismissed = sessionStorage.getItem("pwa-banner-dismissed") === "true";
    }
  }

  function dismiss() {
    show = false;
    dismissed = true;
    showManualInstructions = false;
    if (browser) {
      sessionStorage.setItem("pwa-banner-dismissed", "true");
    }
  }

  async function handleInstall() {
    await PwaService.showInstallPrompt();
    // If the prompt was shown, the service will handle the state.
    // If it was unavailable, we might want to show manual instructions.
    if (!PwaService.isPromptAvailable) {
      showManualInstructions = true;
    } else {
      dismiss();
    }
  }

  function detectBrowser() {
    if (!browser) return;
    const ua = navigator.userAgent;
    const isIOS =
      /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
    const isChrome = /CriOS|Chrome/.test(ua) && !/Edge/.test(ua);
    const isFirefox = /Firefox/.test(ua);
    const isSafari = /Safari/.test(ua) && !/Chrome/.test(ua);
    const isEdge = /Edge/.test(ua);

    browserInfo = {
      isIOS,
      isChrome,
      isFirefox,
      isSafari,
      isEdge,
      name: isChrome
        ? "Chrome"
        : isFirefox
          ? "Firefox"
          : isSafari
            ? "Safari"
            : isEdge
              ? "Edge"
              : "your browser",
    };
  }

  // Reactive effect to control banner visibility
  $effect(() => {
    if (!browser) return;

    const shouldShow =
      PwaService.isPromptAvailable &&
      !PwaService.effectiveInstallStatus &&
      !dismissed;
    show = shouldShow;
  });

  onMount(() => {
    if (!browser) return;
    checkDismissed();
    detectBrowser();
  });
</script>

{#if show}
  <div
    class="fixed top-0 left-0 right-0 p-4 z-[100]"
    transition:fly={{ y: -100, duration: 300 }}
  >
    {#if showManualInstructions}
      <!-- Manual installation instructions -->
      <div
        class="bg-card text-card-foreground shadow-lg rounded-lg p-4 mx-auto max-w-lg border"
      >
        <div class="flex justify-between items-start mb-3">
          <div class="flex items-center gap-2">
            <Info class="h-5 w-5 text-blue-500" />
            <h3 class="font-semibold">Install Nen Space Manually</h3>
          </div>
          <Button variant="ghost" size="icon" on:click={dismiss}>
            <X class="w-4 h-4" />
          </Button>
        </div>

        <div class="text-sm space-y-3">
          <!-- Show the specific reason why automatic installation isn't available -->
          <div class="bg-muted/50 p-2 rounded text-muted-foreground mb-2">
            <p>
              Automatic installation is unavailable:
              <strong>{unavailabilityReason}</strong>
            </p>
          </div>

          {#if browserInfo.isIOS}
            <!-- iOS Safari instructions -->
            <p>To install Nen Space on your iPhone or iPad:</p>
            <ol class="list-decimal space-y-2 pl-5">
              <li>
                Tap the
                <span class="inline-block px-2 font-semibold"> Share </span> button
                in Safari
              </li>
              <li>
                Scroll down and tap
                <span class="inline-block px-2 font-semibold">
                  Add to Home Screen
                </span>
              </li>
              <li>
                Tap
                <span class="inline-block px-2 font-semibold"> Add </span>
              </li>
            </ol>
          {:else if browserInfo.isChrome}
            <!-- Chrome instructions -->
            <p>To install Nen Space in Chrome:</p>
            <ol class="list-decimal space-y-2 pl-5">
              <li>
                Click the menu button
                <span class="inline-block px-2 font-semibold">
                  <Menu class="h-4 w-4 inline" />
                </span> in the top right
              </li>
              <li>
                Select
                <span class="inline-block px-2 font-semibold">
                  Install App
                </span>
                or
                <span class="inline-block px-2 font-semibold">
                  Install Nen Space
                </span>
              </li>
            </ol>
          {:else if browserInfo.isFirefox}
            <!-- Firefox instructions -->
            <p>To install Nen Space in Firefox:</p>
            <ol class="list-decimal space-y-2 pl-5">
              <li>
                Click the menu button
                <span class="inline-block px-2 font-semibold">
                  <Menu class="h-4 w-4 inline" />
                </span> in the top right
              </li>
              <li>
                Select
                <span class="inline-block px-2 font-semibold">
                  Install App
                </span>
                or
                <span class="inline-block px-2 font-semibold">
                  Add to Home Screen
                </span>
              </li>
            </ol>
          {:else}
            <!-- Generic instructions -->
            <p>To install Nen Space on your device:</p>
            <ol class="list-decimal space-y-2 pl-5">
              <li>
                Open the menu in {browserInfo.name}
              </li>
              <li>
                Look for an option like
                <span class="inline-block px-2 font-semibold">
                  Install App
                </span>,
                <span class="inline-block px-2 font-semibold">
                  Add to Home Screen
                </span>, or
                <span class="inline-block px-2 font-semibold">
                  Install Nen Space
                </span>
              </li>
            </ol>
          {/if}

          <div class="pt-2 border-t mt-2">
            <p class="text-muted-foreground text-xs">
              After installation, you can launch the app from your home
              screen/desktop and use it offline.
            </p>
          </div>
        </div>
      </div>
    {:else}
      <!-- Main banner content -->
      <div
        class="bg-card text-card-foreground shadow-lg rounded-lg p-4 mx-auto max-w-lg border"
      >
        <div class="flex justify-between items-start mb-3">
          <div class="flex items-center gap-2">
            <Download class="h-5 w-5 text-primary" />
            <h3 class="font-semibold">Install Nen Space</h3>
          </div>
          <Button variant="ghost" size="icon" on:click={dismiss}>
            <X class="w-4 h-4" />
          </Button>
        </div>

        <p class="text-sm mb-3">
          Install Nen Space on your device for a better experience with offline
          access and faster loading.
        </p>

        <div class="flex justify-end gap-2">
          <Button variant="outline" size="sm" on:click={dismiss}>
            Not now
          </Button>
          <Button variant="default" size="sm" on:click={handleInstall}>
            <Download class="w-4 h-4 mr-2" /> Install
          </Button>
        </div>
      </div>
    {/if}
  </div>
{/if}

<!-- Debug UI removed as it's now in the main debug panel -->
