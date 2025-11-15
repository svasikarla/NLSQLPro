"use client"

import { ArrowRight, Zap, Sparkles, Database } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function HeroSection() {
  return (
    <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden gradient-bg-animated">
      {/* Animated background glow */}
      <div className="absolute inset-0 gradient-glow pointer-events-none" />

      {/* Floating orbs */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-primary/20 rounded-full blur-3xl animate-float" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent/20 rounded-full blur-3xl animate-float-delayed" />

      <div className="max-w-4xl mx-auto relative z-10">
        <div className="text-center mb-12">
          {/* Badge with glow effect */}
          <div className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-card/50 backdrop-blur-sm border border-primary/30 mb-8 shadow-lg shadow-primary/20 animate-pulse-slow">
            <Sparkles size={16} className="text-accent" />
            <span className="text-sm font-semibold text-accent">Production-Ready • Enterprise Security • 10-100x Faster</span>
          </div>

          {/* Headline with animated text */}
          <h1 className="text-5xl sm:text-7xl font-extrabold mb-6 leading-tight text-balance">
            Query Your Data Using
            <span className="gradient-text-animated block mt-3">Plain English</span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg sm:text-xl text-muted-foreground mb-12 max-w-2xl mx-auto text-balance leading-relaxed">
            Transform natural language into SQL for PostgreSQL, MySQL, SQLite, and SQL Server using Claude AI.
            Enterprise-grade security with advanced prompt injection protection. Lightning-fast schema caching.
          </p>

          {/* CTA Buttons with enhanced styling */}
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button
              size="lg"
              className="group bg-gradient-to-r from-primary to-accent hover:shadow-2xl hover:shadow-primary/50 text-primary-foreground text-base h-13 px-8 font-semibold transition-all duration-300 hover:scale-105"
              onClick={() => window.location.href = "/auth/signup"}
            >
              Get Started Free
              <ArrowRight size={18} className="ml-2 group-hover:translate-x-1 transition-transform" />
            </Button>
            <Button
              size="lg"
              variant="outline"
              className="border-2 border-primary/30 hover:border-primary hover:bg-primary/10 text-base h-13 px-8 font-semibold backdrop-blur-sm transition-all duration-300 hover:scale-105"
              onClick={() => window.location.href = "/query"}
            >
              <Database size={18} className="mr-2" />
              Try Live Demo
            </Button>
          </div>

          {/* Trust indicators with icons */}
          <div className="mt-16 pt-12 border-t border-border/50">
            <p className="text-sm text-muted-foreground mb-8 flex items-center justify-center gap-2">
              <span className="inline-block w-2 h-2 rounded-full bg-accent animate-pulse" />
              Trusted by leading enterprises worldwide
            </p>
            <div className="flex justify-center gap-12 flex-wrap">
              {[
                { name: "Healthcare", icon: "🏥" },
                { name: "Finance", icon: "💰" },
                { name: "E-commerce", icon: "🛒" }
              ].map((industry) => (
                <div key={industry.name} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-card/30 backdrop-blur-sm border border-border/50">
                  <span className="text-2xl">{industry.icon}</span>
                  <span className="text-sm font-semibold text-foreground">{industry.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
