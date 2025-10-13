<script lang="ts">
    import { onMount, onDestroy } from "svelte";
    import { Check, X, TerminalSquare } from "lucide-svelte";
    import * as Dialog from "$lib/components/ui/dialog";
    import { Button } from "$lib/components/ui/button";
    import { Input } from "$lib/components/ui/input";
    import { pb } from "$lib/config/pocketbase";
    import { toast } from "svelte-sonner";
    import type { Server } from "../types";
    import { Terminal } from "xterm";
    import { FitAddon } from "xterm-addon-fit";
    import { WebLinksAddon } from "xterm-addon-web-links";
    import { AttachAddon } from "xterm-addon-attach";

    let {
        open = $bindable(),
        server = null,
        onClose,
    } = $props<{
        open?: boolean;
        server: Server | null;
        onClose: () => void;
    }>();

    let terminalRef: HTMLDivElement;
    let isConnected = $state(false);
    let isConnecting = $state(false);
    let isExecuting = $state(false);
    let command = $state("");
    let terminalOutput = $state("");
    let term: Terminal;
    let fitAddon: FitAddon;
    let connectionId: string | null = null;

    $effect(() => {
        if (terminalRef && open) {
            initializeTerminal();
            window.addEventListener("resize", handleResize);
        }
        return () => {
            window.removeEventListener("resize", handleResize);
        };
    });

    function initializeTerminal() {
        term = new Terminal({
            cursorBlink: true,
            fontSize: 14,
            fontFamily: "monospace",
            theme: {
                background: "#000000",
                foreground: "#00ff00",
                cursor: "#00ff00",
            },
        });

        fitAddon = new FitAddon();
        term.loadAddon(fitAddon);
        term.loadAddon(new WebLinksAddon());

        term.open(terminalRef);
        fitAddon.fit();

        term.onData((data) => {
            if (isConnected) {
                // This part will be handled by the AttachAddon
            }
        });

        term.focus();
    }

    function handleResize() {
        if (fitAddon) {
            fitAddon.fit();
        }
    }

    async function connectToServer() {
        if (!server) return;
        isConnecting = true;
        terminalOutput = `Connecting to ${server.ip}:${server.port} as ${server.username}...\n`;
        try {
            const response = await pb.send("/api/servers/connect", {
                method: "POST",
                body: JSON.stringify({
                    server_id: server.id,
                }),
            });
            console.log("Connection response:", response);
            if (response.id) {
                connectionId = response.id;
                isConnected = true;
                isConnecting = false;
                toast.success(`Connected to ${server.name}`);

                const socket = new WebSocket(
                    `ws://localhost:8090/api/servers/connect?connection_id=${connectionId}`,
                );
                const attachAddon = new AttachAddon(socket);
                term.loadAddon(attachAddon);
            } else {
                throw new Error(
                    response.error || "Failed to get connection ID",
                );
            }
        } catch (error: any) {
            console.error("Connection error:", error);
            terminalOutput += `Connection failed: ${error.message || "Unknown error"}\n`;
            isConnecting = false;
            toast.error(
                `Connection failed: ${error.message || "Unknown error"}`,
            );
        }
    }

    /**
     * Execute a command on the server
     */
    async function executeCommand() {
        if (!command.trim() || !isConnected || !connectionId) return;

        const cmd = command.trim();
        addToTerminal(`$ ${cmd}`);
        command = "";

        if (cmd === "exit") {
            disconnectFromServer();
            return;
        }

        isExecuting = true;

        try {
            // Send the command to the SSH server via API
            await pb.send("/api/servers/execute", {
                method: "POST",
                body: JSON.stringify({
                    connection_id: connectionId,
                    command: cmd,
                }),
            });
            command = ""; // Clear command input after sending
        } catch (error: any) {
            console.error("Execution error:", error);
            toast.error(
                `Execution failed: ${error.message || "Unknown error"}`,
            );
        } finally {
            isExecuting = false;
        }
    }

    /**
     * Disconnect from the server
     */
    async function disconnectFromServer() {
        if (!connectionId) return;

        try {
            // Send disconnect request to API
            await pb.send("/api/servers/disconnect", {
                method: "POST",
                body: JSON.stringify({
                    connection_id: connectionId,
                }),
            });
        } catch (error) {
            console.error("Disconnect error:", error);
        } finally {
            isConnected = false;
            connectionId = null;
            addToTerminal("Disconnected from server.");
        }
    }

    /**
     * Add text to the terminal output
     */
    function addToTerminal(data: string) {
        terminalOutput += data + "\n";

        // Scroll to bottom
        setTimeout(() => {
            if (terminalRef) {
                terminalRef.scrollTop = terminalRef.scrollHeight;
            }
        }, 0);
    }

    /**
     * Handle key press events
     */
    function handleKeyDown(e: KeyboardEvent) {
        if (e.key === "Enter" && !isExecuting) {
            e.preventDefault();
            executeCommand();
        }
    }

    // Connect to server when dialog opens
    $effect(() => {
        if (open && server) {
            connectToServer();
        }
    });

    // Clean up when component is destroyed
    onDestroy(() => {
        if (isConnected && connectionId) {
            disconnectFromServer();
        }
    });
</script>

<Dialog.Root
    bind:open
    onOpenChange={() => {
        if (isConnected) {
            disconnectFromServer();
        }
        onClose();
    }}
>
    <Dialog.Content class="sm:max-w-[80%] max-h-[90vh] flex flex-col">
        <Dialog.Header>
            <Dialog.Title class="flex items-center gap-2">
                <TerminalSquare class="w-5 h-5" />
                {server ? `SSH: ${server.name} (${server.ip})` : "SSH Terminal"}
            </Dialog.Title>
            <Dialog.Description>
                {#if isConnecting}
                    Connecting to server...
                {:else if isConnected}
                    Connected to {server?.username}@{server?.ip}:{server?.port}
                {:else}
                    Terminal session
                {/if}
            </Dialog.Description>
        </Dialog.Header>

        <!-- Terminal Output -->
        <div
            class="flex-1 min-h-[300px] max-h-[60vh] overflow-y-auto bg-black text-green-500 p-4 font-mono text-sm rounded-md mb-4"
            bind:this={terminalRef}
        >
            {#each terminalOutput.split("\n") as line}
                <div class="whitespace-pre-wrap break-all">{line}</div>
            {/each}
            {#if isExecuting}
                <div class="animate-pulse">...</div>
            {/if}
        </div>

        <!-- Command Input -->
        <div class="flex gap-2 items-center">
            <div class="flex-1 relative">
                <Input
                    bind:value={command}
                    on:keydown={handleKeyDown}
                    placeholder={isConnected
                        ? "Enter command..."
                        : "Connecting..."}
                    disabled={!isConnected || isExecuting}
                    class="font-mono pl-6"
                />
                <div
                    class="absolute inset-y-0 left-0 flex items-center pl-3 text-muted-foreground"
                >
                    {#if isConnected}
                        <span class="text-xs">$</span>
                    {/if}
                </div>
            </div>
            <Button
                variant="default"
                disabled={!isConnected || isExecuting || !command.trim()}
                on:click={executeCommand}
            >
                <Check class="w-4 h-4 mr-2" />
                Run
            </Button>
        </div>

        <Dialog.Footer class="mt-4">
            <span class="text-xs text-muted-foreground mr-auto">
                {isConnected ? "Connected" : "Disconnected"}
            </span>
            <Button variant="outline" on:click={onClose}>
                <X class="w-4 h-4 mr-2" />
                Close
            </Button>
        </Dialog.Footer>
    </Dialog.Content>
</Dialog.Root>
