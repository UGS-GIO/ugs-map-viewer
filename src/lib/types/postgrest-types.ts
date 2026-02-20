/**
 * PostgREST API Response Type Definitions
 *
 * Provides type-safe handling of PostgREST API responses
 * Used throughout the application for database queries
 */

/**
 * Generic PostgREST row response
 * Represents a single row returned from a PostgREST query
 * Constraints ensure type safety while allowing flexibility for different tables
 */
export type PostgRESTRow = Record<string, string | number | boolean | null>;

/**
 * Generic PostgREST array response
 * Represents the array of rows returned from a PostgREST query
 */
export type PostgRESTResponse<T extends PostgRESTRow = PostgRESTRow> = T[];

/**
 * PostgREST RPC function response
 * Used for responses from stored procedures/functions
 */
export type PostgRESTRPCResponse<T = unknown> = T[];

/**
 * PostgREST query configuration
 * Helps with building consistent PostgREST requests
 */
export interface PostgRESTFetchConfig {
    /**
     * Accept-Profile header value
     * Specifies which PostgreSQL schema to query
     * Examples: 'hazards', 'emp', 'mapping'
     */
    acceptProfile: string;

    /**
     * Optional select clause
     * Limits which columns are returned
     * Example: 'id,name,description'
     */
    select?: string;

    /**
     * Optional filter condition
     * Uses PostgREST filter syntax
     * Example: 'status=eq.active'
     */
    filter?: string;

    /**
     * Optional ordering
     * Example: 'id.desc' or 'name.asc'
     */
    order?: string;

    /**
     * Optional limit for pagination
     */
    limit?: number;

    /**
     * Optional offset for pagination
     */
    offset?: number;
}

/**
 * Helper type for mapping PostgREST rows to domain objects
 * @example
 * type HazardUnit = PostgRESTRowOf<{
 *   relate_id: string
 *   hazardname: string
 *   description: string
 *   notes: string | null
 * }>
 */
export type PostgRESTRowOf<T extends Record<string, any>> = T & PostgRESTRow;
