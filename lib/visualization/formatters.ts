/**
 * Centralized Formatting Utility for Visualizations
 * Handles currency, percentage, large numbers, and dates based on semantic types.
 */

import { format } from "date-fns"

export type SemanticType =
    | 'currency'
    | 'percentage'
    | 'numeric_continuous'
    | 'numeric_discrete'
    | 'temporal'
    | 'identifier'
    | 'categorical'
    | string

/**
 * Format a value based on its semantic type
 */
export function formatValue(value: any, semanticType?: SemanticType): string {
    if (value === null || value === undefined) return '-'

    // Handle Temporal
    if (semanticType === 'temporal' || value instanceof Date) {
        const date = new Date(value)
        if (isNaN(date.getTime())) return String(value)

        // If it looks like a year (e.g. Jan 1st of a year), just show year
        if (date.getMonth() === 0 && date.getDate() === 1 && date.getHours() === 0) {
            return format(date, 'yyyy')
        }
        return format(date, 'MMM dd, yyyy')
    }

    // Handle Numeric
    if (typeof value === 'number' || !isNaN(Number(value))) {
        const num = Number(value)

        if (semanticType === 'currency') {
            return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
                minimumFractionDigits: 0,
                maximumFractionDigits: 2
            }).format(num)
        }

        if (semanticType === 'percentage') {
            return new Intl.NumberFormat('en-US', {
                style: 'percent',
                minimumFractionDigits: 1,
                maximumFractionDigits: 2
            }).format(num / 100) // Assuming value is 0-100, if 0-1 adjust logic
        }

        // Large numbers (Compact notation)
        if (Math.abs(num) >= 1000000) {
            return new Intl.NumberFormat('en-US', {
                notation: 'compact',
                maximumFractionDigits: 2
            }).format(num)
        }

        return num.toLocaleString()
    }

    return String(value)
}

/**
 * Format axis labels (shorter version)
 */
export function formatAxisLabel(value: any, semanticType?: SemanticType): string {
    if (semanticType === 'currency') {
        const num = Number(value)
        if (Math.abs(num) >= 1000) {
            return '$' + new Intl.NumberFormat('en-US', {
                notation: 'compact',
                maximumFractionDigits: 1
            }).format(num)
        }
        return '$' + num
    }

    if (semanticType === 'temporal') {
        const date = new Date(value)
        if (!isNaN(date.getTime())) {
            // If year
            if (date.getMonth() === 0 && date.getDate() === 1) return format(date, 'yyyy')
            return format(date, 'MMM dd')
        }
    }

    // Truncate long text
    const str = String(value)
    if (str.length > 15) return str.substring(0, 12) + '...'

    return formatValue(value, semanticType)
}
