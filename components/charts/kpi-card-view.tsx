'use client'

/**
 * KPI Card Component
 * Renders single high-level metrics with optional trend indicators
 */

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatValue } from "@/lib/visualization/formatters"
import { ArrowUpRight, ArrowDownRight, Minus } from "lucide-react"

interface KpiCardViewProps {
    data: any[]
    config: {
        title?: string
        metric?: string
        trend?: number // Percentage change (optional)
        semanticType?: string
    }
    className?: string
}

export function KpiCardView({ data, config, className }: KpiCardViewProps) {
    // Extract the single value
    const row = data[0]
    const metricKey = config.metric || Object.keys(row)[0]
    const value = row[metricKey]

    const formattedValue = formatValue(value, config.semanticType)

    return (
        <div className={`grid gap-4 md:grid-cols-2 lg:grid-cols-4 ${className}`}>
            <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">
                        {config.title || metricKey}
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <div className="text-2xl font-bold">{formattedValue}</div>
                    {config.trend !== undefined && (
                        <p className="text-xs text-muted-foreground flex items-center mt-1">
                            {config.trend > 0 ? (
                                <ArrowUpRight className="mr-1 h-4 w-4 text-green-500" />
                            ) : config.trend < 0 ? (
                                <ArrowDownRight className="mr-1 h-4 w-4 text-red-500" />
                            ) : (
                                <Minus className="mr-1 h-4 w-4 text-gray-500" />
                            )}
                            <span className={config.trend > 0 ? "text-green-500" : config.trend < 0 ? "text-red-500" : ""}>
                                {Math.abs(config.trend)}%
                            </span>
                            <span className="ml-1">from last period</span>
                        </p>
                    )}
                </CardContent>
            </Card>
        </div>
    )
}
