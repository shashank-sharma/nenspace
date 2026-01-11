import type { DashboardSection } from "./types";
import {
    LayoutDashboard,
    Server,
    Book,
    FileText,
    Palette,
    Package,
    Mail,
    Bookmark,
    DollarSign,
    CheckSquare,
    KeySquare,
    Inbox,
    MountainSnow,
    Key,
    Terminal,
    ShieldCheck,
    ChevronDown,
    ChevronRight,
    Utensils,
    KeyRound,
    Calendar,
    PenTool,
    Waves,
    GitBranch,
    StickyNote,
    Folder,
    Music,
    Play,
    ScrollText
} from "lucide-svelte";

export const DASHBOARD_SECTIONS: DashboardSection[] = [
    { id: "", label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
    { id: "chronicles", label: "Chronicles", icon: MountainSnow, path: "/dashboard/chronicles" },
    { 
        id: "mails", 
        label: "Mails", 
        icon: Inbox, 
        path: "/dashboard/mails",
        collapsible: true,
        children: [
            { id: "inbox", label: "Inbox", icon: Inbox, path: "/dashboard/mails" },
            { id: "newsletter", label: "Newsletter", icon: Mail, path: "/dashboard/mails/newsletter" }
        ]
    },
    { id: "servers", label: "Servers", icon: Server, path: "/dashboard/servers" },
    { id: "notebooks", label: "Notebooks", icon: Book, path: "/dashboard/notebooks" },
    { id: "notes", label: "Notes", icon: StickyNote, path: "/dashboard/notes" },
    { id: "posts", label: "Posts", icon: FileText, path: "/dashboard/posts" },
    { id: "colors", label: "Colors", icon: Palette, path: "/dashboard/colors" },
    { id: "inventory", label: "Inventory", icon: Package, path: "/dashboard/inventory" },
    { id: "bookmarks", label: "Bookmarks", icon: Bookmark, path: "/dashboard/bookmarks" },
    { id: "expenses", label: "Expenses", icon: DollarSign, path: "/dashboard/expenses" },
    { id: "tasks", label: "Tasks", icon: CheckSquare, path: "/dashboard/tasks" },
    { id: "calendar", label: "Calendar", icon: Calendar, path: "/dashboard/calendar" },
    { id: "food-log", label: "Food Log", icon: Utensils, path: "/dashboard/food-log" },
    { id: "whiteboard", label: "Whiteboard", icon: PenTool, path: "/dashboard/whiteboard" },
    { id: "journal", label: "Stream", icon: Waves, path: "/dashboard/journal" },
    { id: "logging", label: "Logs", icon: ScrollText, path: "/dashboard/logging" },
    { id: "workflows", label: "Workflows", icon: GitBranch, path: "/dashboard/workflows" },
    { id: "file-manager", label: "Files", icon: Folder, path: "/dashboard/file-manager" },
    { 
        id: "music", 
        label: "Music", 
        icon: Music, 
        path: "/dashboard/music",
        collapsible: true,
        children: [
            { id: "player", label: "Player", icon: Play, path: "/dashboard/music" },
            { id: "library", label: "Library", icon: Music, path: "/dashboard/music/library" }
        ]
    },
    { 
        id: "credentials", 
        label: "Credentials", 
        icon: ShieldCheck, 
        path: "/dashboard/credentials",
        collapsible: true,
        children: [
            { id: "tokens", label: "Tokens", icon: KeySquare, path: "/dashboard/credentials/tokens" },
            { id: "developer", label: "Developer", icon: Terminal, path: "/dashboard/credentials/developer" },
            { id: "api-keys", label: "API Keys", icon: Key, path: "/dashboard/credentials/api-keys" },
            { id: "security-keys", label: "Security Keys", icon: KeyRound, path: "/dashboard/credentials/security-keys" }
        ]
    }
];

export const MUSIC_SECTIONS: DashboardSection[] = [
    { id: "", label: "Player", icon: Play, path: "/dashboard/music" },
    { id: "library", label: "Library", icon: Music, path: "/dashboard/music/library" },
];

export const CREDENTIALS_SECTIONS: DashboardSection[] = [
    { id: "", label: "Overview", icon: ShieldCheck, path: "/dashboard/credentials" },
    { id: "tokens", label: "Tokens", icon: KeySquare, path: "/dashboard/credentials/tokens" },
    { id: "developer", label: "Developer", icon: Terminal, path: "/dashboard/credentials/developer" },
    { id: "api-keys", label: "API Keys", icon: Key, path: "/dashboard/credentials/api-keys" },
];