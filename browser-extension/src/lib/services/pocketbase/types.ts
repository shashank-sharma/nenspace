/**
 * PocketBase Service Types
 * 
 * Local type definitions for PocketBase service utilities.
 */

export interface PocketBaseConfig {
    baseUrl: string;
    enableLogging?: boolean;
}

export interface RequestInterceptor {
    (url: string, options: RequestInit): { url: string; options: RequestInit };
}

export interface ResponseInterceptor {
    (response: Response, data: any): any;
}

