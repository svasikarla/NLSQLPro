'use client'

/**
 * Scatter Chart Component
 * Renders correlation analysis with scatter plot visualization
 */

import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts'
import { ChartContainer } from '@/components/ui/chart'
import { ChartConfig } from '@/lib/visualization/chart-detector'

interface ScatterChartViewProps {
  data: any[]
  config: ChartConfig
  className?: string
}

// Chart theme colors for categorical grouping
const CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
]

export function ScatterChartView({ data, config, className }: ScatterChartViewProps) {
  const { xAxis, yAxis, colorBy } = config

  if (process.env.NODE_ENV === 'development') {
    console.log('[ScatterChartView] Received props:', { dataLength: data?.length, config, xAxis, yAxis, colorBy })
  }

  // Extract string values (handle arrays if needed)
  const xAxisKey = Array.isArray(xAxis) ? xAxis[0] : xAxis
  const yAxisKey = Array.isArray(yAxis) ? yAxis[0] : yAxis

  if (!data || data.length === 0 || !xAxisKey || !yAxisKey) {
    if (process.env.NODE_ENV === 'development') {
      console.log('[ScatterChartView] Cannot render - missing data or config')
    }
    return (
      <div className="flex items-center justify-center h-[400px] text-muted-foreground">
        No data available for scatter visualization
      </div>
    )
  }

  // Prepare chart config for ChartContainer
  const chartConfig: Record<string, { label: string; color: string }> = {
    [xAxisKey]: {
      label: xAxisKey,
      color: CHART_COLORS[0],
    },
    [yAxisKey]: {
      label: yAxisKey,
      color: CHART_COLORS[1],
    },
  }

  // Format data for Recharts scatter plot
  const formattedData = data.map((row) => {
    const xValue = typeof row[xAxisKey] === 'number' ? row[xAxisKey] : parseFloat(row[xAxisKey])
    const yValue = typeof row[yAxisKey] === 'number' ? row[yAxisKey] : parseFloat(row[yAxisKey])

    // Skip rows with invalid numeric values
    if (isNaN(xValue) || isNaN(yValue)) {
      return null
    }

    return {
      x: xValue,
      y: yValue,
      category: colorBy ? row[colorBy] : 'default',
      // Store original row for tooltip
      ...row,
    }
  }).filter(Boolean) // Remove null entries

  if (process.env.NODE_ENV === 'development') {
    console.log('[ScatterChartView] Formatted data points:', formattedData.length)
  }

  if (formattedData.length === 0) {
    return (
      <div className="flex items-center justify-center h-[400px] text-muted-foreground">
        No valid numeric data points for scatter visualization
      </div>
    )
  }

  // Group data by category if colorBy is specified
  const groupedData: Record<string, any[]> = {}
  if (colorBy) {
    formattedData.forEach((point) => {
      const category = point.category || 'Unknown'
      if (!groupedData[category]) {
        groupedData[category] = []
      }
      groupedData[category].push(point)
    })
  } else {
    groupedData['All Data'] = formattedData
  }

  // Add categories to chart config
  Object.keys(groupedData).forEach((category, index) => {
    chartConfig[category] = {
      label: category,
      color: CHART_COLORS[index % CHART_COLORS.length],
    }
  })

  // Format numbers for axes
  const formatValue = (value: number) => {
    if (Math.abs(value) >= 1000000) return `${(value / 1000000).toFixed(1)}M`
    if (Math.abs(value) >= 1000) return `${(value / 1000).toFixed(1)}K`
    if (Math.abs(value) < 1 && value !== 0) return value.toFixed(2)
    return value.toLocaleString()
  }

  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload
      return (
        <div className="rounded-lg border bg-background p-3 shadow-md">
          <div className="grid gap-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium">{xAxisKey}:</span>
              <span className="text-xs text-muted-foreground">{formatValue(data.x)}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium">{yAxisKey}:</span>
              <span className="text-xs text-muted-foreground">{formatValue(data.y)}</span>
            </div>
            {colorBy && data.category && (
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium">{colorBy}:</span>
                <span className="text-xs text-muted-foreground">{data.category}</span>
              </div>
            )}
          </div>
        </div>
      )
    }
    return null
  }

  return (
    <ChartContainer config={chartConfig} className={className}>
      <ResponsiveContainer width="100%" height={400}>
        <ScatterChart
          margin={{ top: 20, right: 30, left: 20, bottom: 60 }}
        >
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis
            type="number"
            dataKey="x"
            name={xAxisKey}
            className="text-xs"
            label={{ value: xAxisKey, position: 'insideBottom', offset: -10, className: 'fill-muted-foreground text-xs' }}
            tickFormatter={formatValue}
          />
          <YAxis
            type="number"
            dataKey="y"
            name={yAxisKey}
            className="text-xs"
            label={{ value: yAxisKey, angle: -90, position: 'insideLeft', className: 'fill-muted-foreground text-xs' }}
            tickFormatter={formatValue}
          />
          <Tooltip content={<CustomTooltip />} />
          {colorBy && Object.keys(groupedData).length > 1 && <Legend />}

          {Object.entries(groupedData).map(([category, points], index) => (
            <Scatter
              key={category}
              name={category}
              data={points}
              fill={CHART_COLORS[index % CHART_COLORS.length]}
              fillOpacity={0.6}
              strokeWidth={2}
              stroke={CHART_COLORS[index % CHART_COLORS.length]}
            />
          ))}
        </ScatterChart>
      </ResponsiveContainer>
    </ChartContainer>
  )
}
