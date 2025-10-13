/**
 * PocketBase Filter Builder
 * Type-safe, fluent API for building PocketBase filter strings
 * 
 * Prevents SQL injection and improves code readability
 */

/**
 * Fluent filter builder for PocketBase queries
 * Automatically escapes values to prevent SQL injection
 * 
 * @example
 * const filter = FilterBuilder.create()
 *     .equals('user', userId)
 *     .contains('title', searchTerm)
 *     .equals('category', 'focus')
 *     .build();
 * // Result: 'user = "abc123" && title ~ "search" && category = "focus"'
 */
export class FilterBuilder {
    private filters: string[] = [];

    /**
     * Add equality filter (field = value)
     * 
     * @example
     * builder.equals('user', userId)
     * // Result: user = "abc123"
     */
    equals(field: string, value: string | number | boolean): this {
        if (value !== null && value !== undefined && value !== '') {
            this.filters.push(`${field} = "${this.escape(value)}"`);
        }
        return this;
    }

    /**
     * Add contains filter (field ~ value) - case insensitive search
     * 
     * @example
     * builder.contains('title', 'search term')
     * // Result: title ~ "search term"
     */
    contains(field: string, value: string): this {
        if (value?.trim()) {
            this.filters.push(`${field} ~ "${this.escape(value)}"`);
        }
        return this;
    }

    /**
     * Add greater than or equal filter (field >= value)
     * 
     * @example
     * builder.greaterThanOrEqual('created', '2024-01-01')
     * // Result: created >= "2024-01-01"
     */
    greaterThanOrEqual(field: string, value: string | number): this {
        if (value !== null && value !== undefined) {
            this.filters.push(`${field} >= "${this.escape(value)}"`);
        }
        return this;
    }

    /**
     * Add less than or equal filter (field <= value)
     * 
     * @example
     * builder.lessThanOrEqual('due', '2024-12-31')
     * // Result: due <= "2024-12-31"
     */
    lessThanOrEqual(field: string, value: string | number): this {
        if (value !== null && value !== undefined) {
            this.filters.push(`${field} <= "${this.escape(value)}"`);
        }
        return this;
    }

    /**
     * Add greater than filter (field > value)
     */
    greaterThan(field: string, value: string | number): this {
        if (value !== null && value !== undefined) {
            this.filters.push(`${field} > "${this.escape(value)}"`);
        }
        return this;
    }

    /**
     * Add less than filter (field < value)
     */
    lessThan(field: string, value: string | number): this {
        if (value !== null && value !== undefined) {
            this.filters.push(`${field} < "${this.escape(value)}"`);
        }
        return this;
    }

    /**
     * Add NOT equal filter (field != value)
     */
    notEquals(field: string, value: string | number | boolean): this {
        if (value !== null && value !== undefined) {
            this.filters.push(`${field} != "${this.escape(value)}"`);
        }
        return this;
    }

    /**
     * Add IN filter (field ?~ [values])
     * 
     * @example
     * builder.in('category', ['focus', 'learn', 'build'])
     * // Result: category ?~ ["focus", "learn", "build"]
     */
    in(field: string, values: string[]): this {
        if (values && values.length > 0) {
            const escaped = values.map((v) => `"${this.escape(v)}"`).join(', ');
            this.filters.push(`${field} ?~ [${escaped}]`);
        }
        return this;
    }

    /**
     * Add OR group of conditions
     * 
     * @example
     * builder.or('title ~ "task"', 'description ~ "task"')
     * // Result: (title ~ "task" || description ~ "task")
     */
    or(...conditions: string[]): this {
        if (conditions.length > 0) {
            const validConditions = conditions.filter((c) => c?.trim());
            if (validConditions.length > 0) {
                this.filters.push(`(${validConditions.join(' || ')})`);
            }
        }
        return this;
    }

    /**
     * Add AND group of conditions
     * 
     * @example
     * builder.and('completed = false', 'priority > 2')
     * // Result: (completed = false && priority > 2)
     */
    and(...conditions: string[]): this {
        if (conditions.length > 0) {
            const validConditions = conditions.filter((c) => c?.trim());
            if (validConditions.length > 0) {
                this.filters.push(`(${validConditions.join(' && ')})`);
            }
        }
        return this;
    }

    /**
     * Add IS NULL check
     */
    isNull(field: string): this {
        this.filters.push(`${field} = null`);
        return this;
    }

    /**
     * Add IS NOT NULL check
     */
    isNotNull(field: string): this {
        this.filters.push(`${field} != null`);
        return this;
    }

    /**
     * Add custom raw filter condition
     * Use with caution - no escaping is performed
     * 
     * @example
     * builder.raw('(parent_id = null || parent_id = "")')
     */
    raw(condition: string): this {
        if (condition?.trim()) {
            this.filters.push(condition);
        }
        return this;
    }

    /**
     * Build the final filter string
     * 
     * @returns Filter string ready for PocketBase API
     */
    build(): string {
        return this.filters.join(' && ');
    }

    /**
     * Check if any filters have been added
     */
    isEmpty(): boolean {
        return this.filters.length === 0;
    }

    /**
     * Clear all filters
     */
    clear(): this {
        this.filters = [];
        return this;
    }

    /**
     * Get the number of filters
     */
    count(): number {
        return this.filters.length;
    }

    /**
     * Escape value for PocketBase filter
     * Prevents SQL injection by escaping special characters
     */
    private escape(value: string | number | boolean): string {
        return String(value)
            .replace(/\\/g, '\\\\') // Escape backslashes first
            .replace(/'/g, "\\'") // Escape single quotes
            .replace(/"/g, '\\"'); // Escape double quotes
    }

    /**
     * Create a new FilterBuilder instance
     * 
     * @example
     * const filter = FilterBuilder.create()
     *     .equals('user', userId)
     *     .contains('title', search)
     *     .build();
     */
    static create(): FilterBuilder {
        return new FilterBuilder();
    }
}
