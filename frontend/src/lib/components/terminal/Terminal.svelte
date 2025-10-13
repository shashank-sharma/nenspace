<script lang="ts">
    import { createEventDispatcher } from "svelte";
    import { Terminal as XTerm } from "xterm";
    import { FitAddon } from "xterm-addon-fit";
    import { WebLinksAddon } from "xterm-addon-web-links";

    import "xterm/css/xterm.css";

    let {
        id = "terminal-" + Math.random().toString(36).substr(2, 9),
        initialText = "",
        autoFocus = true,
        theme = {
            background: "#1e1e1e",
            foreground: "#f0f0f0",
            cursor: "#ffffff",
            cursorAccent: "#000000",
            selection: "rgba(255, 255, 255, 0.3)",
            black: "#000000",
            red: "#e06c75",
            green: "#98c379",
            yellow: "#e5c07b",
            blue: "#61afef",
            magenta: "#c678dd",
            cyan: "#56b6c2",
            white: "#dcdfe4",
        },
    } = $props<{
        id?: string;
        initialText?: string;
        autoFocus?: boolean;
        theme?: {
            background: string;
            foreground: string;
            cursor: string;
            cursorAccent: string;
            selection: string;
            black: string;
            red: string;
            green: string;
            yellow: string;
            blue: string;
            magenta: string;
            cyan: string;
            white: string;
        };
    }>();

    // Local state
    let terminalElement: HTMLElement;
    let terminal: XTerm | undefined;
    let fitAddon: FitAddon | undefined;
    let resizeObserver: ResizeObserver | undefined;
    let isReady = $state(false);

    const dispatch = createEventDispatcher();

    $effect(() => {
        terminal = new XTerm({
            fontFamily: 'Menlo, Monaco, "Courier New", monospace',
            fontSize: isMobile() ? 12 : 14,
            lineHeight: 1.2,
            cursorBlink: true,
            cursorStyle: "block",
            theme,
            scrollback: 10000,
            allowTransparency: true,
            convertEol: true,
            cols: calculateCols(),
            rows: calculateRows(),
        });

        fitAddon = new FitAddon();
        terminal.loadAddon(fitAddon);
        terminal.loadAddon(new WebLinksAddon());

        terminal.open(terminalElement);

        setTimeout(() => {
            fitAddon?.fit();
            if (terminal) {
                dispatch("resize", {
                    cols: terminal.cols,
                    rows: terminal.rows,
                });
            }
        }, 100);

        if (autoFocus) {
            terminal.focus();
        }

        if (initialText) {
            terminal.write(initialText);
        }

        terminal.onData((data) => {
            dispatch("data", { data });
        });

        terminal.onResize((size) => {
            dispatch("resize", {
                cols: size.cols,
                rows: size.rows,
            });
        });

        resizeObserver = new ResizeObserver(() => {
            if (terminal && fitAddon) {
                try {
                    fitAddon.fit();
                } catch (e) {
                    console.error("Failed to fit terminal: ", e);
                }
            }
        });

        resizeObserver.observe(terminalElement);

        window.addEventListener("orientationchange", handleOrientationChange);

        isReady = true;
        dispatch("ready");

        return () => {
            resizeObserver?.disconnect();
            terminal?.dispose();
            window.removeEventListener(
                "orientationchange",
                handleOrientationChange,
            );
        };
    });

    function handleOrientationChange() {
        setTimeout(() => {
            if (fitAddon) {
                fitAddon.fit();
            }
        }, 100);
    }

    function isMobile() {
        return window.innerWidth <= 768;
    }

    function calculateCols() {
        const charWidth = isMobile() ? 7 : 9;
        return Math.floor(Math.min(window.innerWidth * 0.9, 1200) / charWidth);
    }

    function calculateRows() {
        const lineHeight = isMobile() ? 14 : 17;
        return Math.floor(Math.min(window.innerHeight * 0.7, 600) / lineHeight);
    }

    export function write(data: string) {
        if (terminal) {
            terminal.write(data);
        }
    }

    export function writeln(data: string) {
        if (terminal) {
            terminal.writeln(data);
        }
    }

    export function clear() {
        if (terminal) {
            terminal.clear();
        }
    }

    export function focus() {
        if (terminal) {
            terminal.focus();
        }
    }

    export function blur() {
        if (terminal) {
            terminal.blur();
        }
    }

    export function getTerminalSize() {
        if (terminal) {
            return {
                cols: terminal.cols,
                rows: terminal.rows,
            };
        }
        return { cols: 0, rows: 0 };
    }

    export function reset() {
        if (terminal) {
            terminal.reset();
        }
    }
</script>

<div class="terminal-container" class:ready={isReady}>
    <div class="terminal" bind:this={terminalElement} {id}></div>
</div>

<style>
    .terminal-container {
        width: 100%;
        height: 100%;
        min-height: 300px;
        position: relative;
        border-radius: 4px;
        overflow: hidden;
        background-color: #1e1e1e;
        opacity: 0;
        transition: opacity 0.2s ease-in-out;
    }

    .terminal-container.ready {
        opacity: 1;
    }

    .terminal {
        width: 100%;
        height: 100%;
    }
</style>
