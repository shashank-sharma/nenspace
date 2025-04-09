<script lang="ts">
    import { mailStore, mailMessagesStore } from "../stores";
    import { Search } from "lucide-svelte";
    import { Input } from "$lib/components/ui/input";
    import { Button } from "$lib/components/ui/button";
    import { cn } from "$lib/utils";
    import { slide, fade } from "svelte/transition";
    import { quintOut } from "svelte/easing";

    let searchQuery = "";
    let selectedCategory = "inbox";

    function selectCategory(category: string) {
        selectedCategory = category;
        if (category === "inbox") {
            mailMessagesStore.fetchMails();
        }
    }
</script>

<nav class="mail-nav">
    <!-- Search -->
    <div class="mb-6">
        <form
            class="relative"
            on:submit|preventDefault={() => {
                if (searchQuery.trim()) {
                    mailMessagesStore.searchMails(searchQuery);
                } else {
                    mailMessagesStore.fetchMails();
                }
            }}
        >
            <Input
                type="search"
                bind:value={searchQuery}
                placeholder="Search emails..."
                class="w-full pl-9 bg-slate-50 dark:bg-slate-900 border-slate-200 dark:border-slate-700"
            />
            <Button
                variant="ghost"
                size="icon"
                type="submit"
                class="absolute left-0 top-0 text-slate-500"
            >
                <Search class="h-4 w-4" />
                <span class="sr-only">Search email</span>
            </Button>
        </form>
    </div>

    <!-- Navigation Items -->
    <div class="mb-6">
        <h3
            class="mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider px-2"
        >
            Mailboxes
        </h3>
        <ul class="space-y-1">
            <li>
                <button
                    class={cn(
                        "flex items-center w-full p-2 text-sm rounded-lg transition-colors",
                        selectedCategory === "inbox"
                            ? "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white"
                            : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800",
                    )}
                    on:click={() => selectCategory("inbox")}
                >
                    <svg
                        class={cn(
                            "w-5 h-5 mr-3 transition-colors",
                            selectedCategory === "inbox"
                                ? "text-blue-600 dark:text-blue-400"
                                : "text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300",
                        )}
                        aria-hidden="true"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                    >
                        <path
                            d="m17.418 3.623-.018-.008a6.713 6.713 0 0 0-2.4-.569V2h1a1 1 0 1 0 0-2h-2a1 1 0 0 0-1 1v2H9.89A6.977 6.977 0 0 1 12 8v5h-2V8A5 5 0 1 0 0 8v6a1 1 0 0 0 1 1h8v4a1 1 0 0 0 1 1h2a1 1 0 0 0 1-1v-4h6a1 1 0 0 0 1-1V8a5 5 0 0 0-2.582-4.377ZM6 12H4a1 1 0 0 1 0-2h2a1 1 0 0 1 0 2Z"
                        />
                    </svg>
                    <span>Inbox</span>
                    {#if $mailMessagesStore.messages.filter((m) => m.is_unread).length > 0}
                        <span
                            in:fade={{ duration: 200 }}
                            class="inline-flex items-center justify-center h-5 min-w-[20px] px-1.5 ml-auto text-xs font-medium text-white bg-blue-600 rounded-full dark:bg-blue-500"
                        >
                            {$mailMessagesStore.messages.filter(
                                (m) => m.is_unread,
                            ).length}
                        </span>
                    {/if}
                </button>
            </li>
            <li>
                <button
                    class={cn(
                        "flex items-center w-full p-2 text-sm rounded-lg transition-colors",
                        selectedCategory === "sent"
                            ? "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white"
                            : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800",
                    )}
                    on:click={() => selectCategory("sent")}
                >
                    <svg
                        class={cn(
                            "w-5 h-5 mr-3 transition-colors",
                            selectedCategory === "sent"
                                ? "text-blue-600 dark:text-blue-400"
                                : "text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300",
                        )}
                        aria-hidden="true"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                    >
                        <path
                            d="M14.707 7.793a1 1 0 0 0-1.414 0L11 10.086V1.5a1 1 0 0 0-2 0v8.586L6.707 7.793a1 1 0 1 0-1.414 1.414l4 4a1 1 0 0 0 1.416 0l4-4a1 1 0 0 0-.002-1.414Z"
                        />
                        <path
                            d="M18 12h-2.55l-2.975 2.975a3.5 3.5 0 0 1-4.95 0L4.55 12H2a2 2 0 0 0-2 2v4a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-4a2 2 0 0 0-2-2Zm-3 5a1 1 0 1 1 0-2 1 1 0 0 1 0 2Z"
                        />
                    </svg>
                    <span>Sent</span>
                </button>
            </li>
            <li>
                <button
                    class={cn(
                        "flex items-center w-full p-2 text-sm rounded-lg transition-colors",
                        selectedCategory === "drafts"
                            ? "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white"
                            : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800",
                    )}
                    on:click={() => selectCategory("drafts")}
                >
                    <svg
                        class={cn(
                            "w-5 h-5 mr-3 transition-colors",
                            selectedCategory === "drafts"
                                ? "text-blue-600 dark:text-blue-400"
                                : "text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300",
                        )}
                        aria-hidden="true"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                    >
                        <path
                            d="M8.5 4.466V1.75a1.75 1.75 0 1 0-3.5 0v5.284a1.75 1.75 0 0 0 3.5 0V4.466zM14.5 4.466V1.75a1.75 1.75 0 1 0-3.5 0v5.284a1.75 1.75 0 0 0 3.5 0V4.466z"
                        />
                        <path
                            d="M8.5 9.466V1.75a1.75 1.75 0 1 0-3.5 0v5.284a1.75 1.75 0 0 0 3.5 0V9.466zM14.5 9.466V1.75a1.75 1.75 0 1 0-3.5 0v5.284a1.75 1.75 0 0 0 3.5 0V9.466z"
                        />
                    </svg>
                    <span>Drafts</span>
                </button>
            </li>
        </ul>
    </div>

    <!-- Categories -->
    <div class="mb-6">
        <h3
            class="mb-2 text-xs font-semibold text-slate-500 uppercase tracking-wider px-2"
        >
            Categories
        </h3>
        <ul class="space-y-1">
            <li>
                <button
                    class={cn(
                        "flex items-center w-full p-2 text-sm rounded-lg transition-colors",
                        selectedCategory === "trash"
                            ? "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white"
                            : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800",
                    )}
                    on:click={() => selectCategory("trash")}
                >
                    <svg
                        class={cn(
                            "w-5 h-5 mr-3 transition-colors",
                            selectedCategory === "trash"
                                ? "text-blue-600 dark:text-blue-400"
                                : "text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300",
                        )}
                        aria-hidden="true"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                    >
                        <path
                            d="M17 4h-4V2a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v2H1a1 1 0 0 0 0 2h1v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V6h1a1 1 0 1 0 0-2ZM7 2h4v2H7V2Zm1 14a1 1 0 1 1-2 0V8a1 1 0 0 1 2 0v8Zm4 0a1 1 0 0 1-2 0V8a1 1 0 0 1 2 0v8Z"
                        />
                    </svg>
                    <span>Trash</span>
                </button>
            </li>
            <li>
                <button
                    class={cn(
                        "flex items-center w-full p-2 text-sm rounded-lg transition-colors",
                        selectedCategory === "spam"
                            ? "bg-slate-100 text-slate-900 dark:bg-slate-800 dark:text-white"
                            : "text-slate-700 hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800",
                    )}
                    on:click={() => selectCategory("spam")}
                >
                    <svg
                        class={cn(
                            "w-5 h-5 mr-3 transition-colors",
                            selectedCategory === "spam"
                                ? "text-blue-600 dark:text-blue-400"
                                : "text-slate-500 group-hover:text-slate-700 dark:group-hover:text-slate-300",
                        )}
                        aria-hidden="true"
                        xmlns="http://www.w3.org/2000/svg"
                        fill="currentColor"
                        viewBox="0 0 20 20"
                    >
                        <path
                            d="M10 .5a9.5 9.5 0 1 0 9.5 9.5A9.51 9.51 0 0 0 10 .5ZM10 15a1 1 0 1 1 0-2 1 1 0 0 1 0 2Zm1-4a1 1 0 0 1-2 0V6a1 1 0 0 1 2 0v5Z"
                        />
                    </svg>
                    <span>Spam</span>
                </button>
            </li>
        </ul>
    </div>

    <!-- Sync Status -->
    {#if $mailStore.syncStatus}
        <div
            in:slide={{ duration: 300, easing: quintOut }}
            class="mt-auto p-4 text-xs text-slate-500 border-t border-slate-200 dark:border-slate-700"
        >
            <div class="flex items-center mb-2">
                <div class="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
                <span class="font-medium">Status: Connected</span>
            </div>
            <p class="mb-1">
                Last synced: {new Date(
                    $mailStore.syncStatus.last_synced,
                ).toLocaleString()}
            </p>
            <p>Messages: {$mailStore.syncStatus.message_count}</p>
        </div>
    {/if}
</nav>

<style>
    .mail-nav {
        display: flex;
        flex-direction: column;
        height: 100%;
    }
</style>
