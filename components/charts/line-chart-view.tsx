'use client'

/**
 * Line Chart Component
 * Renders time series and trend data
 */

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { ChartConfig } from '@/lib/visualization/chart-detector'
import { format } from 'date-fns'

interface LineChartViewProps {
  data: any[]
  config: ChartConfig
  className?: string
}

// Chart theme colors
const CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
]

export function LineChartView({ data, config, className }: LineChartViewProps) {
  const { xAxis, yAxis } = config

  if (!data || data.length === 0 || !xAxis || !yAxis) {
    return (
      <div className="flex items-center justify-center h-[400px] text-muted-foreground">
        No data available for visualization
      </div>
    )
  }

  // Handle multiple Y axes (multiple lines)
  const yAxes = Array.isArray(yAxis) ? yAxis : [yAxis]

  // Prepare chart config for ChartContainer
  const chartConfig: Record<string, { label: string; color: string }> = {}

  yAxes.forEach((axis, index) => {
    chartConfig[axis] = {
      label: axis,
      color: CHART_COLORS[index % CHART_COLORS.length],
    }
  })

  // Format data for Recharts
  const formattedData = data.map((row) => {
    const formatted: any = {}

    // Handle date formatting for X axis
    const xValue = row[xAxis]
    if (xValue instanceof Date || !isNaN(Date.parse(xValue))) {
      formatted[xAxis] = new Date(xValue).getTime()
      formatted[`${xAxis}_formatted`] = format(new Date(xValue), 'MMM dd, yyyy')
    } else {
      formatted[xAxis] = xValue
    }

    // Add Y axis values
    yAxes.forEach((axis) => {
      formatted[axis] = typeof row[axis] === 'number' ? row[axis] : parseFloat(row[axis]) || 0
    })

    return formatted
  })

  // Format numbers in tooltip
  const formatValue = (value: number) => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(2)}M`
    if (value >= 1000) return `${(value / 1000).toFixed(2)}K`
    return value.toLocaleString()
  }

  // Format X axis labels (dates or regular values)
  const formatXAxis = (value: any) => {
    const sample = formattedData[0]?.[xAxis]
    if (typeof sample === 'number' && sample > 1000000000000) {
      // Likely a timestamp
      return format(new Date(value), 'MMM dd')
    }
    return String(value)
  }

  return (
    <ChartContainer config={chartConfig} className={className}>
      <LineChart data={formattedData} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey={xAxis}
          className="text-xs"
          tickFormatter={formatXAxis}
        />
        <YAxis className="text-xs" tickFormatter={formatValue} />
        <ChartTooltip
          content={<ChartTooltipContent />}
          labelFormatter={(label) => {
            const item = formattedData.find((d) => d[xAxis] === label)
            return item?.[`${xAxis}_formatted`] || formatXAxis(label)
          }}
        />
        {yAxes.length > 1 && <Legend />}
        {yAxes.map((axis, index) => (
          <Line
            key={axis}
            type="monotone"
            dataKey={axis}
            stroke={`var(--color-${axis})`}
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 6 }}
          />
        ))}
      </LineChart>
    </ChartContainer>
  )
}
