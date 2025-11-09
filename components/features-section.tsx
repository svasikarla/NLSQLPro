"use client"

import { Shield, Zap, Code, Lock, Cpu, Sparkles } from "lucide-react"

const features = [
  {
    icon: Sparkles,
    title: "AI-Powered Generation",
    description: "Advanced NLP models understand context and generate accurate, optimized SQL queries instantly.",
  },
  {
    icon: Zap,
    title: "Lightning Fast",
    description: "Get results in milliseconds. No waiting, no complexity—just instant data access.",
  },
  {
    icon: Lock,
    title: "Enterprise Security",
    description: "Row-level access control, encryption, and compliance with HIPAA, GDPR, and SOC2.",
  },
  {
    icon: Cpu,
    title: "Iterative Refinement",
    description: "Refine queries conversationally. Ask follow-ups and get precisely what you need.",
  },
  {
    icon: Code,
    title: "Industry-Specific",
    description: "Healthcare, Finance, E-commerce versions with domain-specific optimizations.",
  },
  {
    icon: Shield,
    title: "Real-Time Insights",
    description: "Access live data streams and get actionable insights instantly on your dashboard.",
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
