"use client"

import { ArrowRight } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function CTASection() {
  return (
    <section className="py-20 px-4 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-accent/10 pointer-events-none" />

      <div className="max-w-4xl mx-auto relative z-10 text-center">
        <h2 className="text-4xl sm:text-5xl font-bold mb-6 text-balance">Ready to Query Your Database with AI?</h2>
        <p className="text-xl text-muted-foreground mb-10 text-balance">
          Start using natural language to query your PostgreSQL databases. Free forever, no credit card required.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <Button
            size="lg"
            className="bg-primary hover:bg-primary/90 text-primary-foreground h-12 text-base"
            onClick={() => (window.location.href = "/auth/signup")}
          >
            Get Started Free
            <ArrowRight size={18} className="ml-2" />
          </Button>
          <Button
            size="lg"
            variant="outline"
            className="border-border hover:bg-card h-12 text-base bg-transparent"
            onClick={() => (window.location.href = "/query")}
          >
            Try Demo
          </Button>
        </div>

        <p className="mt-8 text-sm text-muted-foreground">No credit card required. Get started in minutes.</p>
      </div>
    </section>
  )
}
