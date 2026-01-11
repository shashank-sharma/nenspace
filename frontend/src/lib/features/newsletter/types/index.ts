export interface NewsletterSettings {
    id: string;
    user: string;
    is_enabled: boolean;
    scan_status: 'pending' | 'scanning' | 'completed' | 'failed' | null;
    total_messages: number;
    processed_messages: number;
    detected_newsletters: number;
    error_message: string | null;
    scan_started_at: string | null;
    scan_completed_at: string | null;
    created: string;
    updated: string;
}

export interface Newsletter {
    id: string;
    user: string;
    sender_email: string;
    sender_name: string;
    name: string;
    first_seen: string;
    last_seen: string;
    total_count: number;
    frequency_days: number;
    is_active: boolean;
    detection_score: number;
    detection_reasons: string[];
    created: string;
    updated: string;
}

export interface NewsletterFilter {
    searchQuery?: string;
    isActive?: boolean;
    sort?: string;
}

export type FrequencyType = 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'irregular';

