"use client"

import { Zap, Database, Clock, TrendingUp, RefreshCw, CheckCircle2 } from "lucide-react"

export default function PerformanceSection() {
  return (
    <section className="py-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-accent/5 to-transparent pointer-events-none" />

      <div className="max-w-6xl mx-auto relative z-10">
        <div className="text-center mb-16">
          <div className="inline-block px-4 py-2 rounded-full bg-accent/10 border border-accent/20 mb-6">
            <span className="text-sm font-semibold text-accent">Performance Optimized</span>
          </div>
          <h2 className="text-4xl sm:text-6xl font-extrabold mb-6 text-balance">
            <span className="gradient-text">Lightning Fast</span> Query Generation
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto text-balance leading-relaxed">
            Production-hardened caching delivers 10-100x faster performance than traditional approaches
          </p>
        </div>

        {/* Performance Stats Grid */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          {[
            {
              icon: Zap,
              metric: "10-100x",
              label: "Faster Schema Loading",
              description: "24-hour cache reduces latency from seconds to milliseconds",
              color: "text-yellow-500"
            },
            {
              icon: Clock,
              metric: "50-200ms",
              label: "Query Generation Time",
              description: "Sub-second responses with intelligent schema caching",
              color: "text-green-500"
            },
            {
              icon: TrendingUp,
              metric: "90%+",
              label: "Cache Hit Rate",
              description: "Majority of requests served from cache in production",
              color: "text-blue-500"
            }
          ].map((stat, idx) => {
            const Icon = stat.icon
            return (
              <div
                key={idx}
                className="group relative bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-8 card-hover-effect text-center"
              >
                <div className={`inline-flex w-16 h-16 items-center justify-center rounded-full bg-gradient-to-br from-${stat.color}/20 to-transparent mb-6 group-hover:scale-110 transition-transform duration-300`}>
                  <Icon size={32} className={stat.color} />
                </div>
                <div className="text-4xl font-extrabold mb-2 gradient-text">
                  {stat.metric}
                </div>
                <div className="text-lg font-semibold mb-3 text-foreground">
                  {stat.label}
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {stat.description}
                </p>
              </div>
            )
          })}
        </div>

        {/* How It Works */}
        <div className="bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-8 md:p-12">
          <h3 className="text-2xl font-bold mb-8 text-center">Smart Caching Architecture</h3>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Left - Cache Features */}
            <div className="space-y-6">
              {[
                {
                  icon: Database,
                  title: "24-Hour TTL Cache",
                  description: "Schema metadata cached in Supabase for lightning-fast access"
                },
                {
                  icon: RefreshCw,
                  title: "One-Click Refresh",
                  description: "Manual schema refresh button for instant updates after database changes"
                },
                {
                  icon: CheckCircle2,
                  title: "Auto-Invalidation",
                  description: "MD5 fingerprinting detects schema changes and auto-refreshes cache"
                }
              ].map((feature, idx) => {
                const Icon = feature.icon
                return (
                  <div key={idx} className="flex gap-4 items-start">
                    <div className="flex-shrink-0 w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Icon size={20} className="text-primary" />
                    </div>
                    <div>
                      <h4 className="font-semibold text-foreground mb-1">{feature.title}</h4>
                      <p className="text-sm text-muted-foreground">{feature.description}</p>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Right - Performance Comparison */}
            <div className="bg-background/50 rounded-xl p-6 border border-border">
              <h4 className="font-semibold mb-4 text-center">Before vs After</h4>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-3 rounded-lg bg-destructive/10">
                  <span className="text-sm font-medium">Without Cache</span>
                  <span className="text-lg font-bold text-destructive">2-5 seconds</span>
                </div>
                <div className="flex items-center justify-center">
                  <div className="text-3xl font-bold text-accent">↓ 10-100x</div>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-green-500/10">
                  <span className="text-sm font-medium">With Cache</span>
                  <span className="text-lg font-bold text-green-500">50-200ms</span>
                </div>
              </div>
              <div className="mt-6 pt-6 border-t border-border">
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <CheckCircle2 size={14} className="text-green-500" />
                  <span>Cache automatically expires after 24 hours</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2">
                  <CheckCircle2 size={14} className="text-green-500" />
                  <span>Fingerprint-based staleness detection</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
