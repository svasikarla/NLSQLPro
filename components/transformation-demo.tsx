"use client"

import { Code2, ArrowRight, Shield, Zap, Database } from "lucide-react"

export default function TransformationDemo() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 relative">
      <div className="max-w-6xl mx-auto">
        {/* Feature badges */}
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
        <div className="grid md:grid-cols-2 gap-8 items-center">
          {/* Left - Natural Language Input */}
          <div className="space-y-4">
            <p className="text-sm font-semibold text-accent uppercase tracking-wide">Input</p>
            <div className="bg-card border border-border rounded-lg p-6 space-y-4 animate-float">
              <p className="text-lg font-medium text-foreground">
                "Show me all customers from New York who made purchases over $1000 in the last 30 days, with their total
                spending"
              </p>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                Natural language query
              </div>
            </div>
          </div>

          {/* Center - Arrow */}
          <div className="hidden md:flex justify-center">
            <div className="relative w-16 h-16 flex items-center justify-center">
              <div className="absolute inset-0 bg-gradient-to-r from-primary to-accent rounded-full opacity-20 blur-lg" />
              <ArrowRight size={28} className="text-accent relative z-10" />
            </div>
          </div>

          {/* Right - SQL Output */}
          <div className="space-y-4">
            <p className="text-sm font-semibold text-accent uppercase tracking-wide">Output</p>
            <div className="bg-card border border-border rounded-lg p-6 animate-float animation-delay-1">
              <pre className="text-sm text-muted-foreground font-mono overflow-x-auto">
                <code>{`SELECT c.id, c.name, c.email,
       SUM(o.amount) as total_spent
FROM customers c
JOIN orders o ON c.id = o.customer_id
WHERE c.state = 'NY'
  AND o.amount > 1000
  AND o.created_at >= NOW() - 
      INTERVAL '30 days'
GROUP BY c.id, c.name, c.email
ORDER BY total_spent DESC`}</code>
              </pre>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-4">
                <Code2 size={16} className="text-accent" />
                Optimized SQL query
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Arrow */}
        <div className="md:hidden flex justify-center my-6">
          <div className="text-accent text-3xl">↓</div>
        </div>
      </div>

      <style>{`
        .animation-delay-1 {
          animation-delay: 0.5s;
        }
      `}</style>
    </section>
  )
}
