"use client"

import { Star } from "lucide-react"
import { ScrollReveal } from "@/components/ui/scroll-reveal"

const testimonials = [
  {
    quote: "Being able to query my database using natural language is incredible. No more struggling with JOIN syntax!",
    author: "Alex Johnson",
    role: "Full-Stack Developer",
    company: "Indie Projects",
    rating: 5,
  },
  {
    quote:
      "The schema visualization and ER diagrams help me understand my database structure at a glance. Very helpful for new projects.",
    author: "Maria Garcia",
    role: "Data Analyst",
    company: "Startup Inc",
    rating: 5,
  },
  {
    quote:
      "I love that I can review and edit the generated SQL before running it. Perfect balance of automation and control.",
    author: "David Kim",
    role: "Backend Engineer",
    company: "Tech Solutions",
    rating: 5,
  },
]

export default function TestimonialsSection() {
  return (
    <section id="testimonials" className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <ScrollReveal>
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold mb-6 text-balance">What Developers Are Saying</h2>
            <p className="text-lg text-muted-foreground text-balance">
              Real feedback from developers using NLSQL Pro
            </p>
          </div>
        </ScrollReveal>

        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, idx) => (
            <ScrollReveal key={idx} delay={idx * 100}>
              <div className="bg-card border border-border rounded-lg p-8 h-full">
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: testimonial.rating }).map((_, i) => (
                    <Star key={i} size={18} className="fill-accent text-accent" />
                  ))}
                </div>

                <p className="text-foreground mb-6 leading-relaxed italic">"{testimonial.quote}"</p>

                <div>
                  <p className="font-bold text-foreground">{testimonial.author}</p>
                  <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                  <p className="text-sm text-accent font-medium">{testimonial.company}</p>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  )
}
