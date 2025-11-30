"use client"

import { Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ScrollReveal } from "@/components/ui/scroll-reveal"

const plans = [
  {
    name: "Starter",
    price: "Free",
    description: "Perfect for hobby projects and testing.",
    features: ["50 queries per month", "1 database connection", "Basic schema caching", "Community support"],
    cta: "Get Started",
    popular: false,
  },
  {
    name: "Pro",
    price: "$29",
    period: "/month",
    description: "For professional developers and small teams.",
    features: [
      "Unlimited queries",
      "5 database connections",
      "Advanced schema caching",
      "Priority email support",
      "Team collaboration",
    ],
    cta: "Start Free Trial",
    popular: true,
  },
  {
    name: "Enterprise",
    price: "Custom",
    description: "For large organizations with custom needs.",
    features: [
      "Unlimited everything",
      "Custom deployment (VPC)",
      "SSO & Audit logs",
      "Dedicated success manager",
      "SLA guarantee",
      "Compliance assistance",
    ],
    cta: "Contact Us",
    popular: false,
  },
]

export default function PricingSection() {
  return (
    <section id="pricing" className="py-24 px-4 sm:px-6 lg:px-8 relative">
      <div className="max-w-6xl mx-auto">
        <ScrollReveal>
          <div className="text-center mb-16">
            <h2 className="text-4xl sm:text-5xl font-bold mb-6 text-balance">Simple, Transparent Pricing</h2>
            <p className="text-lg text-muted-foreground text-balance">
              Start for free, upgrade as you grow. No hidden fees.
            </p>
          </div>
        </ScrollReveal>

        <div className="grid md:grid-cols-3 gap-8">
          {plans.map((plan, idx) => (
            <ScrollReveal key={idx} delay={idx * 100}>
              <div
                className={`relative rounded-2xl p-8 border ${plan.popular
                    ? "bg-card border-primary shadow-2xl shadow-primary/10 scale-105 z-10"
                    : "bg-card/50 border-border"
                  }`}
              >
                {plan.popular && (
                  <div className="absolute -top-4 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full">
                    MOST POPULAR
                  </div>
                )}

                <div className="mb-8">
                  <h3 className="text-xl font-bold mb-2">{plan.name}</h3>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-extrabold">{plan.price}</span>
                    {plan.price !== "Custom" && plan.price !== "Free" && <span className="text-muted-foreground">/month</span>}
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">{plan.description}</p>
                </div>

                <Button
                  className={`w-full mb-8 ${plan.popular ? "bg-primary hover:bg-primary/90" : "bg-secondary hover:bg-secondary/80"}`}
                  variant={plan.popular ? "default" : "secondary"}
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
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  )
}
