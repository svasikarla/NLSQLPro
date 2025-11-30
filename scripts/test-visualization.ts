
import { analyzeQueryResultsV2, detectColumnTypeV2 } from '../lib/visualization/data-analyzer-v2'
import { detectBestVisualizationV2 } from '../lib/visualization/chart-detector-v2'

console.log('Running Visualization Tests...')

// Test 1: Year Detection
const yearData = [
    { year: 2020, sales: 100 },
    { year: 2021, sales: 120 },
    { year: 2022, sales: 150 }
]
const yearStats = analyzeQueryResultsV2(yearData)
const yearCol = yearStats.temporalColumns.find(c => c.name === 'year')
console.log('Test 1 - Year Detection:', yearCol ? 'PASS' : 'FAIL')
if (yearCol) console.log('  Detected type:', yearCol.type, yearCol.semanticType)

// Test 2: KPI Detection
const kpiData = [{ total_revenue: 50000 }]
const kpiStats = analyzeQueryResultsV2(kpiData)
const kpiRec = detectBestVisualizationV2(kpiData, kpiStats)
const hasKpi = kpiRec.recommendations.some(r => r.type === 'kpi')
console.log('Test 2 - KPI Detection:', hasKpi ? 'PASS' : 'FAIL')
if (hasKpi) console.log('  Top recommendation:', kpiRec.recommendations[0].type)

// Test 3: Currency Detection
const currencyData = [
    { product: 'A', price: '$10.50' },
    { product: 'B', price: '$20.00' }
]
const currencyStats = analyzeQueryResultsV2(currencyData)
const priceCol = currencyStats.numericColumns.find(c => c.name === 'price')
console.log('Test 3 - Currency Detection:', priceCol ? 'PASS' : 'FAIL')
if (priceCol) console.log('  Detected type:', priceCol.type, priceCol.semanticType)

// Test 4: ID Detection
const idData = [
    { user_id: 1, name: 'Alice' },
    { user_id: 2, name: 'Bob' }
]
const idStats = analyzeQueryResultsV2(idData)
const idCol = idStats.textColumns.find(c => c.name === 'user_id')
console.log('Test 4 - ID Detection:', idCol ? 'PASS' : 'FAIL')
if (idCol) console.log('  Detected type:', idCol.type, idCol.semanticType)
