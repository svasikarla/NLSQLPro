'use client'

/**
 * Pie Chart Component
 * Renders categorical breakdown with pie/donut visualization
 */

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { ChartConfig } from '@/lib/visualization/chart-detector'

interface PieChartViewProps {
  data: any[]
  config: ChartConfig
  className?: string
  variant?: 'pie' | 'donut'
}

// Chart theme colors
const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
]

export function PieChartView({ data, config, className, variant = 'pie' }: PieChartViewProps) {
  const { colorBy, yAxis } = config

  if (!data || data.length === 0 || !colorBy || !yAxis) {
    return (
      <div className="flex items-center justify-center h-[400px] text-muted-foreground">
        No data available for visualization
      </div>
    )
  }

  const valueKey = Array.isArray(yAxis) ? yAxis[0] : yAxis

  // Format data for Recharts
  const formattedData = data.map((row, index) => ({
    name: String(row[colorBy]),
    value: typeof row[valueKey] === 'number' ? row[valueKey] : parseFloat(row[valueKey]) || 0,
    fill: CHART_COLORS[index % CHART_COLORS.length],
  }))

  // Calculate total for percentages
  const total = formattedData.reduce((sum, item) => sum + item.value, 0)

  // Prepare chart config for ChartContainer
  const chartConfig: Record<string, { label: string; color?: string }> = {}
  formattedData.forEach((item) => {
    chartConfig[item.name] = {
      label: item.name,
      color: item.fill,
    }
  })

  // Format numbers
  const formatValue = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(2)}M`
    if (value >= 1000) return `${(value / 1000).toFixed(2)}K`
    return value.toLocaleString()
  }

  // Custom label to show percentages
  const renderLabel = (entry: any) => {
    const percentage = ((entry.value / total) * 100).toFixed(1)
    return `${percentage}%`
  }

  return (
    <ChartContainer config={chartConfig} className={className}>
      <PieChart>
        <Pie
          data={formattedData}
          cx="50%"
          cy="50%"
          labelLine={false}
          label={renderLabel}
          outerRadius={120}
          innerRadius={variant === 'donut' ? 60 : 0}
          fill="#8884d8"
          dataKey="value"
        >
          {formattedData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={entry.fill} />
          ))}
        </Pie>
        <ChartTooltip
          content={({ active, payload }) => {
            if (!active || !payload || payload.length === 0) return null

            const data = payload[0]
            const percentage = ((data.value as number / total) * 100).toFixed(1)

            return (
              <div className="rounded-lg border bg-background p-2 shadow-sm">
                <div className="flex flex-col gap-1">
                  <span className="text-xs font-semibold">{data.name}</span>
                  <span className="text-xs text-muted-foreground">
                    {formatValue(data.value as number)} ({percentage}%)
                  </span>
                </div>
              </div>
            )
          }}
        />
        <Legend
          verticalAlign="bottom"
          height={36}
          formatter={(value, entry: any) => {
            const percentage = ((entry.payload.value / total) * 100).toFixed(1)
            return `${value} (${percentage}%)`
          }}
        />
      </PieChart>
    </ChartContainer>
  )
}
