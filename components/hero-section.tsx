"use client"

import { ArrowRight, Zap, Sparkles, Database, Menu, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollReveal } from "@/components/ui/scroll-reveal"
import { useState } from "react"

export default function HeroSection() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <section className="pt-32 pb-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden gradient-bg-animated">
      {/* Animated background glow */}
      <div className="absolute inset-0 gradient-glow pointer-events-none" />

      {/* Floating orbs */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-primary/20 rounded-full blur-3xl animate-float" />
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent/20 rounded-full blur-3xl animate-float-delayed" />

      <div className="max-w-4xl mx-auto relative z-10">
        <ScrollReveal>
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
              Transform natural language into SQL for any database.
              Now with <strong>Business Glossary</strong> and <strong>Golden Query Memory</strong> to understand your specific domain logic.
            </p>

            {/* CTA Buttons with enhanced styling */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button
                size="lg"
                className="bg-primary hover:bg-primary/90 text-primary-foreground h-12 px-8 text-base transition-all hover:scale-105 shadow-lg shadow-primary/25"
                onClick={() => (window.location.href = "/query")}
              >
                Start Querying Now
                <ArrowRight size={18} className="ml-2" />
              </Button>
              <Button
                size="lg"
                variant="outline"
                className="border-primary/20 hover:bg-primary/10 h-12 px-8 text-base backdrop-blur-sm"
                onClick={() => (window.location.href = "#features")}
              >
                View Features
              </Button>
            </div>
          </div>
        </ScrollReveal>
      </div>

      {/* Header Navigation (Absolute positioned) */}
      <header className="absolute top-0 left-0 right-0 flex items-center justify-between py-6 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
        <div className="flex items-center gap-2">
          <Database className="text-primary" size={24} />
          <span className="font-bold text-xl">NLSQL Pro</span>
        </div>
        <div className="hidden md:flex items-center gap-8">
          <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Features</a>
          <a href="#security" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Security</a>
          <a href="#pricing" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">Pricing</a>
          <Button variant="ghost" onClick={() => window.location.href = "/auth/login"}>Sign In</Button>
          <Button onClick={() => window.location.href = "/auth/signup"}>Get Started</Button>
        </div>
        <button className="md:hidden text-foreground" onClick={() => setIsOpen(!isOpen)}>
          {isOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </header>

      {/* Mobile Menu */}
      {isOpen && (
        <div className="absolute top-20 left-0 right-0 bg-background/95 backdrop-blur-md border-b border-border p-4 md:hidden z-50 animate-in slide-in-from-top-5">
          <nav className="flex flex-col gap-4">
            <a href="#features" className="text-sm font-medium p-2 hover:bg-muted rounded-md">Features</a>
            <a href="#security" className="text-sm font-medium p-2 hover:bg-muted rounded-md">Security</a>
            <a href="#pricing" className="text-sm font-medium p-2 hover:bg-muted rounded-md">Pricing</a>
            <div className="flex flex-col gap-2 mt-2">
              <Button variant="outline" onClick={() => window.location.href = "/auth/login"}>Sign In</Button>
              <Button onClick={() => window.location.href = "/auth/signup"}>Get Started</Button>
            </div>
          </nav>
        </div>
      )}
    </section>
  )
}
