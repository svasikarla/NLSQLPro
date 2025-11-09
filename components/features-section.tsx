"use client"

import { Shield, Zap, Code, Lock, Cpu, Sparkles } from "lucide-react"

const features = [
  {
    icon: Sparkles,
    title: "AI-Powered Generation",
    description: "Claude AI understands your database schema and generates accurate PostgreSQL queries from natural language.",
  },
  {
    icon: Zap,
    title: "Lightning Fast",
    description: "Query your data in seconds. Schema introspection, generation, and execution optimized for speed.",
  },
  {
    icon: Lock,
    title: "Secure & Isolated",
    description: "Row-level security ensures users only access their own data. All queries run in read-only mode.",
  },
  {
    icon: Cpu,
    title: "Manual SQL Editing",
    description: "Review and edit generated SQL before execution. Full transparency and control over your queries.",
  },
  {
    icon: Code,
    title: "Multi-Database Support",
    description: "Connect and switch between multiple PostgreSQL databases. Test connections before activation.",
  },
  {
    icon: Shield,
    title: "Export & History",
    description: "Export results to CSV/JSON. Query history saved locally for quick access to previous queries.",
  },
]

export default function FeaturesSection() {
  return (
    <section id="features" className="py-24 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-transparent via-primary/5 to-transparent pointer-events-none" />

      <div className="max-w-6xl mx-auto relative z-10">
        <div className="text-center mb-20">
          <div className="inline-block px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-6">
            <span className="text-sm font-semibold text-primary">Features</span>
          </div>
          <h2 className="text-4xl sm:text-6xl font-extrabold mb-6 text-balance">
            Powerful Features for <span className="gradient-text">Every Use Case</span>
          </h2>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto text-balance leading-relaxed">
            Everything you need to query your data intelligently and securely
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {features.map((feature, idx) => {
            const Icon = feature.icon
            return (
              <div
                key={idx}
                className="group relative bg-card/50 backdrop-blur-sm border border-border/50 rounded-2xl p-8 card-hover-effect glow-on-hover overflow-hidden"
              >
                {/* Gradient overlay on hover */}
                <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                {/* Content */}
                <div className="relative z-10">
                  <div className="w-14 h-14 bg-gradient-to-br from-primary to-accent rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 group-hover:rotate-3 transition-all duration-300 shadow-lg shadow-primary/20">
                    <Icon size={26} className="text-primary-foreground" />
                  </div>
                  <h3 className="text-xl font-bold mb-3 text-foreground group-hover:text-primary transition-colors">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed group-hover:text-foreground/80 transition-colors">
                    {feature.description}
                  </p>
                </div>

                {/* Corner accent */}
                <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-accent/20 to-transparent rounded-bl-full opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
              </div>
            )
          })}
        </div>
      </div>
    </section>
  )
}
