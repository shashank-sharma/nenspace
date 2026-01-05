/**
 * Authentication Types
 * 
 * Type definitions for authentication, users, and tokens.
 */

export interface StoredAuth {
    userId: string;
    primaryToken: string;
    backendUrl: string;
    email: string;
    expiresAt?: number;
}

export interface PocketBaseUser {
    id: string;
    email: string;
    name?: string;
    username?: string;
    verified: boolean;
    created: string;
    updated: string;
}

export interface DevTokenMetadata {
    id: string;
    name: string;
    token: string; // Token value for selection/storage
    isActive: boolean;
    environment?: 'development' | 'production';
    createdAt: string;
    lastUsed: string | null;
}

export interface GeneratedDevToken {
    id: string;
    user: string;
    name?: string;
    token: string;
    is_active: boolean;
    environment?: 'development' | 'production';
    created: string;
    updated: string;
}

