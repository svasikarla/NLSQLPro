'use client'

/**
 * Line Chart Component
 * Renders time series and trend data
 */

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { ChartConfig } from '@/lib/visualization/chart-detector'
import { formatAxisLabel, formatValue } from '@/lib/visualization/formatters'
import { format } from 'date-fns'

interface LineChartViewProps {
  data: any[]
  config: ChartConfig
  className?: string
}

// Chart theme colors
const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
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
  const formatTooltipValue = (value: number) => {
    return formatValue(value, config.yAxisSemanticType)
  }

  // Format X axis labels (dates or regular values)
  const formatXAxis = (value: any) => {
    return formatAxisLabel(value, config.xAxisSemanticType)
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
        <YAxis className="text-xs" tickFormatter={(val) => formatAxisLabel(val, config.yAxisSemanticType)} />
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
