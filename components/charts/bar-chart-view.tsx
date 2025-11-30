'use client'

/**
 * Bar Chart Component
 * Renders categorical data with bar visualization
 */

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart'
import { ChartConfig } from '@/lib/visualization/chart-detector'
import { formatAxisLabel, formatValue } from '@/lib/visualization/formatters'

interface BarChartViewProps {
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

export function BarChartView({ data, config, className }: BarChartViewProps) {
  const { xAxis, yAxis, orientation = 'vertical' } = config

  console.log('[BarChartView] Received props:', { dataLength: data?.length, config, xAxis, yAxis })

  if (!data || data.length === 0 || !xAxis || !yAxis) {
    console.log('[BarChartView] Cannot render - missing data or config')
    return (
      <div className="flex items-center justify-center h-[400px] text-muted-foreground">
        No data available for visualization
      </div>
    )
  }

  console.log('[BarChartView] Rendering chart with orientation:', orientation)

  // Prepare chart config for ChartContainer
  const chartConfig: Record<string, { label: string; color: string }> = {}

  // Handle multiple Y axes (grouped bars)
  const yAxes = Array.isArray(yAxis) ? yAxis : [yAxis]

  yAxes.forEach((axis, index) => {
    chartConfig[axis] = {
      label: axis,
      color: CHART_COLORS[index % CHART_COLORS.length],
    }
  })

  // Format data for Recharts
  const formattedData = data.map((row) => {
    const formatted: any = {}
    formatted[xAxis] = row[xAxis]

    yAxes.forEach((axis) => {
      formatted[axis] = typeof row[axis] === 'number' ? row[axis] : parseFloat(row[axis]) || 0
    })

    return formatted
  })

  // Format numbers in tooltip
  const formatTooltipValue = (value: number) => {
    return formatValue(value, config.yAxisSemanticType)
  }

  if (orientation === 'horizontal') {
    return (
      <ChartContainer config={chartConfig} className={className}>
        <BarChart
          data={formattedData}
          layout="horizontal"
          margin={{ top: 20, right: 30, left: 100, bottom: 20 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis type="number" className="text-xs" tickFormatter={(val) => formatAxisLabel(val, config.yAxisSemanticType)} />
          <YAxis type="category" dataKey={xAxis} className="text-xs" width={90} />
          <ChartTooltip content={<ChartTooltipContent />} />
          {yAxes.length > 1 && <Legend />}
          {yAxes.map((axis, index) => (
            <Bar
              key={axis}
              dataKey={axis}
              fill={`var(--color-${axis})`}
              radius={[0, 4, 4, 0]}
            />
          ))}
        </BarChart>
      </ChartContainer>
    )
  }

  return (
    <ChartContainer config={chartConfig} className={className}>
      <BarChart data={formattedData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis
          dataKey={xAxis}
          className="text-xs"
          angle={-45}
          textAnchor="end"
          height={80}
        />
        <YAxis className="text-xs" tickFormatter={(val) => formatAxisLabel(val, config.yAxisSemanticType)} />
        <ChartTooltip content={<ChartTooltipContent />} />
        {yAxes.length > 1 && <Legend />}
        {yAxes.map((axis, index) => (
          <Bar
            key={axis}
            dataKey={axis}
            fill={`var(--color-${axis})`}
            radius={[4, 4, 0, 0]}
          />
        ))}
      </BarChart>
    </ChartContainer>
  )
}
