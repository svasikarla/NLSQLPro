
import { analyzeQueryResultsV2 } from '../lib/visualization/data-analyzer-v2'
import { detectBestVisualizationV2 } from '../lib/visualization/chart-detector-v2'

console.log('Running Reproduction Test...')

// Simulate result for "total chapter and topics for each subject"
const data = [
    { subject_name: 'Math', total_chapters: 10, total_topics: 50 },
    { subject_name: 'Science', total_chapters: 12, total_topics: 60 },
    { subject_name: 'History', total_chapters: 8, total_topics: 40 },
    { subject_name: 'English', total_chapters: 15, total_topics: 70 },
    { subject_name: 'Art', total_chapters: 5, total_topics: 20 }
]

const sqlFeatures = {
    hasGroupBy: true,
    hasAggregation: true,
    hasOrderBy: false,
    hasJoin: true,
    hasLimit: false,
    aggregateFunctions: ['COUNT'],
    isTimeSeriesOrdered: false
}

const stats = analyzeQueryResultsV2(data)
console.log('Categorical Columns:', stats.categoricalColumns.map(c => c.name))
console.log('Text Columns:', stats.textColumns.map(c => c.name))
console.log('Numeric Columns:', stats.numericColumns.map(c => c.name))

const dummySql = "SELECT subject_name, count(*) FROM subjects GROUP BY subject_name"
const analysis = detectBestVisualizationV2(data, stats, dummySql, undefined)
// Actually detectBestVisualizationV2 calls analyzeSQLPattern if sql is provided.
// Let's just pass the data and let it infer.

console.log('Top Recommendation:', analysis.recommendations[0].type)
console.log('Score Breakdown:')
analysis.recommendations.forEach(r => {
    console.log(`- ${r.type}: ${r.score} (DataFit: ${r.scoreBreakdown.dataFit}, Semantic: ${r.scoreBreakdown.semanticAlignment}, SQL: ${r.scoreBreakdown.sqlContext})`)
})
