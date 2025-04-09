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
    Calendar
} from "lucide-svelte";

export const DASHBOARD_SECTIONS: DashboardSection[] = [
    { id: "", label: "Dashboard", icon: LayoutDashboard, path: "/dashboard" },
    { id: "chronicles", label: "Chronicles", icon: MountainSnow, path: "/dashboard/chronicles" },
    { id: "mails", label: "Mails", icon: Inbox, path: "/dashboard/mails" },
    { id: "servers", label: "Servers", icon: Server, path: "/dashboard/servers" },
    { id: "notebooks", label: "Notebooks", icon: Book, path: "/dashboard/notebooks" },
    { id: "posts", label: "Posts", icon: FileText, path: "/dashboard/posts" },
    { id: "colors", label: "Colors", icon: Palette, path: "/dashboard/colors" },
    { id: "inventory", label: "Inventory", icon: Package, path: "/dashboard/inventory" },
    { id: "newsletter", label: "Newsletter", icon: Mail, path: "/dashboard/newsletter" },
    { id: "bookmarks", label: "Bookmarks", icon: Bookmark, path: "/dashboard/bookmarks" },
    { id: "expenses", label: "Expenses", icon: DollarSign, path: "/dashboard/expenses" },
    { id: "tasks", label: "Tasks", icon: CheckSquare, path: "/dashboard/tasks" },
    { id: "calendar", label: "Calendar", icon: Calendar, path: "/dashboard/calendar" },
    { id: "food-log", label: "Food Log", icon: Utensils, path: "/dashboard/food-log" },
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

export const CREDENTIALS_SECTIONS: DashboardSection[] = [
    { id: "", label: "Overview", icon: ShieldCheck, path: "/dashboard/credentials" },
    { id: "tokens", label: "Tokens", icon: KeySquare, path: "/dashboard/credentials/tokens" },
    { id: "developer", label: "Developer", icon: Terminal, path: "/dashboard/credentials/developer" },
    { id: "api-keys", label: "API Keys", icon: Key, path: "/dashboard/credentials/api-keys" },
];