"use client"

import { useState, useEffect } from "react"
import { Code2, ArrowRight, Shield, Zap, Database, Loader2 } from "lucide-react"
import { ScrollReveal } from "@/components/ui/scroll-reveal"

export default function TransformationDemo() {
  const [queryText, setQueryText] = useState("")
  const [sqlText, setSqlText] = useState("")
  const [isTyping, setIsTyping] = useState(true)
  const [isGenerating, setIsGenerating] = useState(false)
  const [showChart, setShowChart] = useState(false)

  const fullQuery = "Show me all customers from New York who made purchases over $1000 in the last 30 days, with their total spending"
  const fullSQL = `SELECT c.id, c.name, c.email,
       SUM(o.amount) as total_spent
FROM customers c
JOIN orders o ON c.id = o.customer_id
WHERE c.state = 'NY'
  AND o.amount > 1000
  AND o.created_at >= NOW() - 
      INTERVAL '30 days'
GROUP BY c.id, c.name, c.email
ORDER BY total_spent DESC`

  useEffect(() => {
    const animate = async () => {
      // Reset
      setQueryText("")
      setSqlText("")
      setIsTyping(true)
      setIsGenerating(false)
      setShowChart(false)

      // Type Query
      for (let i = 0; i <= fullQuery.length; i++) {
        setQueryText(fullQuery.slice(0, i))
        await new Promise(r => setTimeout(r, 30))
      }

      setIsTyping(false)
      setIsGenerating(true)
      await new Promise(r => setTimeout(r, 800)) // Simulate processing

      // Stream SQL
      setIsGenerating(false)
      const lines = fullSQL.split('\n')
      let currentSQL = ""
      for (const line of lines) {
        currentSQL += line + '\n'
        setSqlText(currentSQL)
        await new Promise(r => setTimeout(r, 50))
      }

      // Show SQL for a bit
      await new Promise(r => setTimeout(r, 2000))

      // Switch to Chart
      setShowChart(true)

      // Show Chart for a bit
      await new Promise(r => setTimeout(r, 4000))

      // Restart
      animate()
    }

    animate()

    return () => { }
  }, [])

  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 relative">
      <div className="max-w-6xl mx-auto">
        {/* Feature badges */}
        <ScrollReveal>
          <div className="flex flex-wrap justify-center gap-3 mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-green-500/10 border border-green-500/20">
              <Zap size={14} className="text-green-500" />
              <span className="text-xs font-semibold text-green-500">10-100x Faster</span>
            </div>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-500/10 border border-blue-500/20">
              <Shield size={14} className="text-blue-500" />
              <span className="text-xs font-semibold text-blue-500">Injection Protected</span>
            </div>
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-purple-500/10 border border-purple-500/20">
              <Database size={14} className="text-purple-500" />
              <span className="text-xs font-semibold text-purple-500">4 Database Types</span>
            </div>
          </div>
        </ScrollReveal>

        <div className="grid md:grid-cols-[1fr,auto,1fr] gap-8 items-center">
          {/* Left - Natural Language Input */}
          <ScrollReveal className="space-y-4">
            <p className="text-sm font-semibold text-primary uppercase tracking-wide">Input</p>
            <div className="bg-card border border-border rounded-lg p-6 min-h-[200px] shadow-lg relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
              <p className="text-lg text-foreground font-medium leading-relaxed relative z-10">
                "{queryText}"
                {isTyping && <span className="animate-pulse">|</span>}
              </p>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-8">
                <div className={`w-2 h-2 rounded-full bg-accent ${isTyping ? 'animate-pulse' : ''}`} />
                Natural language query
              </div>
            </div>
          </ScrollReveal>

          {/* Center - Arrow */}
          <ScrollReveal delay={200} className="hidden md:flex justify-center">
            <div className="relative w-16 h-16 flex items-center justify-center">
              <div className={`absolute inset-0 bg-gradient-to-r from-primary to-accent rounded-full opacity-20 blur-lg transition-opacity duration-500 ${isGenerating ? 'opacity-50 scale-110' : ''}`} />
              {isGenerating ? (
                <Loader2 size={28} className="text-accent animate-spin relative z-10" />
              ) : (
                <ArrowRight size={28} className="text-accent relative z-10" />
              )}
            </div>
          </ScrollReveal>

          {/* Right - Output (SQL or Chart) */}
          <ScrollReveal delay={300} className="space-y-4">
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-accent uppercase tracking-wide">Output</p>
              <div className="flex gap-2">
                <span className={`text-xs px-2 py-0.5 rounded-full transition-colors ${!showChart ? 'bg-accent/20 text-accent' : 'text-muted-foreground'}`}>SQL</span>
                <span className={`text-xs px-2 py-0.5 rounded-full transition-colors ${showChart ? 'bg-accent/20 text-accent' : 'text-muted-foreground'}`}>Viz</span>
              </div>
            </div>

            <div className="bg-card border border-border rounded-lg p-6 min-h-[200px] shadow-lg relative overflow-hidden group">
              <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

              {/* SQL View */}
              <div className={`transition-all duration-500 absolute inset-0 p-6 ${showChart ? 'opacity-0 translate-x-10 pointer-events-none' : 'opacity-100 translate-x-0'}`}>
                <pre className="text-sm text-muted-foreground font-mono overflow-x-auto relative z-10 h-[140px]">
                  <code>{sqlText || (isGenerating ? "// Generating SQL..." : "")}</code>
                  {!isTyping && !isGenerating && !showChart && sqlText !== fullSQL && <span className="animate-pulse">|</span>}
                </pre>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-8 absolute bottom-6 left-6">
                  <Code2 size={16} className="text-accent" />
                  Optimized SQL query
                </div>
              </div>

              {/* Chart View */}
              <div className={`transition-all duration-500 absolute inset-0 p-6 ${!showChart ? 'opacity-0 -translate-x-10 pointer-events-none' : 'opacity-100 translate-x-0'}`}>
                <div className="h-[140px] flex items-end gap-4 relative z-10 pb-2">
                  {/* Mock Bar Chart */}
                  <div className="flex-1 flex flex-col justify-end gap-2 group/bar h-full">
                    <div className="w-full bg-accent/80 rounded-t-sm h-[80%] relative overflow-hidden">
                      <div className="absolute inset-0 bg-white/20 translate-y-full group-hover/bar:translate-y-0 transition-transform duration-500" />
                    </div>
                    <span className="text-[10px] text-muted-foreground text-center truncate">Acme Inc</span>
                  </div>
                  <div className="flex-1 flex flex-col justify-end gap-2 group/bar h-full">
                    <div className="w-full bg-accent/60 rounded-t-sm h-[60%] relative overflow-hidden">
                      <div className="absolute inset-0 bg-white/20 translate-y-full group-hover/bar:translate-y-0 transition-transform duration-500" />
                    </div>
                    <span className="text-[10px] text-muted-foreground text-center truncate">Globex</span>
                  </div>
                  <div className="flex-1 flex flex-col justify-end gap-2 group/bar h-full">
                    <div className="w-full bg-accent/40 rounded-t-sm h-[40%] relative overflow-hidden">
                      <div className="absolute inset-0 bg-white/20 translate-y-full group-hover/bar:translate-y-0 transition-transform duration-500" />
                    </div>
                    <span className="text-[10px] text-muted-foreground text-center truncate">Soylent</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground mt-4 absolute bottom-6 left-6">
                  <Zap size={16} className="text-accent" />
                  Visualized Result
                </div>
              </div>

            </div>
          </ScrollReveal>
        </div>

        {/* Mobile Arrow */}
        <div className="md:hidden flex justify-center my-6">
          <div className="text-accent text-3xl">↓</div>
        </div>
      </div>
    </section>
  )
}

