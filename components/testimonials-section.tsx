"use client"

import { Star } from "lucide-react"

const testimonials = [
  {
    quote: "NLSQL Pro reduced our reporting time from 2 hours to 2 minutes. The ROI was immediate and measurable.",
    author: "Sarah Chen",
    role: "VP of Data Analytics",
    company: "FinanceCore",
    rating: 5,
  },
  {
    quote:
      "The enterprise security features gave us the confidence to deploy across our entire organization. Compliance was seamless.",
    author: "Michael Rodriguez",
    role: "Chief Data Officer",
    company: "Acme Healthcare",
    rating: 5,
  },
  {
    quote:
      "Our business analysts can now query our database without technical training. Productivity increased by 300%.",
    author: "Emily Thompson",
    role: "Director of Business Intelligence",
    company: "RetailGiant",
    rating: 5,
  },
]

export default function TestimonialsSection() {
  return (
    <section id="testimonials" className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold mb-6 text-balance">Loved by Data Teams</h2>
          <p className="text-lg text-muted-foreground text-balance">
            See real ROI and productivity gains from industry leaders
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {testimonials.map((testimonial, idx) => (
            <div key={idx} className="bg-card border border-border rounded-lg p-8">
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
          ))}
        </div>
      </div>
    </section>
  )
}
