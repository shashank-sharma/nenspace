export interface SyncStatus {
    last_synced: string;
    message_count: number;
    status: string;
    id?: string;
}

export interface MailMessage {
    id: string;
    message_id: string;
    thread_id: string;
    from: string;
    to: string;
    subject: string;
    snippet: string;
    body: string;
    is_unread: boolean;
    is_important: boolean;
    is_starred: boolean;
    is_spam: boolean;
    is_inbox: boolean;
    is_trash: boolean;
    is_draft: boolean;
    is_sent: boolean;
    internal_date: string;
    received_date: string;
    created: string;
    updated: string;
}

export interface MailState {
    isAuthenticated: boolean;
    isLoading: boolean;
    isAuthenticating: boolean;
    syncStatus: SyncStatus | null;
    lastChecked: number | null;
    syncAvailable: boolean;
}

export interface MailMessagesState {
    messages: MailMessage[];
    isLoading: boolean;
    totalItems: number;
    page: number;
    perPage: number;
    selectedMail: MailMessage | null;
}