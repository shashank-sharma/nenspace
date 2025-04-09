export const PROVIDERS = [
    { value: "google", label: "Google" },
    { value: "google_calendar", label: "Google Calendar" },
    { value: "coolify", label: "Coolify" },
    { value: "github", label: "GitHub" },
    { value: "gitlab", label: "GitLab" }
] as const;

export const DEFAULT_TOKEN_FORM = {
    provider: "",
    account: "",
    access_token: "",
    token_type: "Bearer",
    refresh_token: "",
    expiry: "",
    scope: ""
};