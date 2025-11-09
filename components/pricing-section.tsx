"use client"

import { Check } from "lucide-react"
import { Button } from "@/components/ui/button"

const plans = [
  {
    name: "Free",
    description: "Perfect for individual developers and testing",
    price: "Free",
    period: "Forever",
    features: [
      "Unlimited queries",
      "Multiple database connections",
      "PostgreSQL support",
      "AI-powered SQL generation",
      "Export to CSV/JSON",
      "Query history",
      "Schema visualization",
    ],
    cta: "Get Started",
    featured: true,
  },
  {
    name: "Pro",
    description: "Coming soon - For teams and businesses",
    price: "TBD",
    period: "Future release",
    features: [
      "Everything in Free",
      "Team collaboration",
      "Shared connections",
      "Advanced permissions",
      "Priority support",
      "Extended history",
      "Custom integrations",
    ],
    cta: "Join Waitlist",
    featured: false,
  },
  {
    name: "Enterprise",
    description: "Coming soon - Custom solutions for organizations",
    price: "Custom",
    period: "Future release",
    features: [
      "Everything in Pro",
      "SSO & MFA",
      "Dedicated support",
      "SLA guarantees",
      "On-premise deployment",
      "Custom features",
      "Compliance assistance",
    ],
    cta: "Contact Us",
    featured: false,
  },
]

export default function PricingSection() {
  return (
    <section id="pricing" className="py-20 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-4xl sm:text-5xl font-bold mb-6 text-balance">Simple, Transparent Pricing</h2>
          <p className="text-lg text-muted-foreground text-balance">
            Start free. Scale as you grow. No credit card required.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          {plans.map((plan, idx) => (
            <div
              key={idx}
              className={`rounded-lg border transition-all duration-300 ${
                plan.featured
                  ? "bg-gradient-to-br from-primary/10 to-accent/10 border-accent/50 md:scale-105 md:z-10"
                  : "bg-card border-border hover:border-border"
              } p-8`}
            >
              {plan.featured && (
                <div className="mb-4 inline-block px-3 py-1 rounded-full bg-accent/20 text-accent text-xs font-bold uppercase">
                  Most Popular
                </div>
              )}

              <h3 className="text-2xl font-bold mb-2 text-foreground">{plan.name}</h3>
              <p className="text-sm text-muted-foreground mb-6">{plan.description}</p>

              <div className="mb-8">
                <p className="text-4xl font-bold text-foreground">{plan.price}</p>
                <p className="text-sm text-muted-foreground mt-2">{plan.period}</p>
              </div>

              <Button
                className={`w-full mb-8 ${
                  plan.featured
                    ? "bg-primary hover:bg-primary/90 text-primary-foreground"
                    : "border-border hover:bg-card"
                }`}
                variant={plan.featured ? "default" : "outline"}
                onClick={() => (window.location.href = "/auth/signup")}
              >
                {plan.cta}
              </Button>

              <div className="space-y-4">
                {plan.features.map((feature, fidx) => (
                  <div key={fidx} className="flex gap-3">
                    <Check size={18} className="text-accent flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-foreground/80">{feature}</p>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
