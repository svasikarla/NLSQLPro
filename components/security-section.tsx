"use client"

import { Shield, Lock, Eye, Key } from "lucide-react"

const securityFeatures = [
  {
    icon: Lock,
    title: "Encrypted Connections",
    description: "Database credentials stored securely in Supabase with encrypted connections",
  },
  {
    icon: Eye,
    title: "Row-Level Security",
    description: "Supabase RLS ensures users can only access their own database connections",
  },
  {
    icon: Key,
    title: "Email Authentication",
    description: "Secure user authentication with email/password via Supabase Auth",
  },
  {
    icon: Shield,
    title: "Read-Only Queries",
    description: "All SQL queries are validated to prevent destructive operations (SELECT only)",
  },
]

export default function SecuritySection() {
  return (
    <section id="security" className="py-20 px-4 sm:px-6 lg:px-8 bg-card/50 border-y border-border">
      <div className="max-w-6xl mx-auto">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Left - Heading */}
          <div>
            <h2 className="text-4xl font-bold mb-6">Security-First Design</h2>
            <p className="text-lg text-muted-foreground mb-8">
              NLSQL Pro is built with security at its core. Your database credentials and queries are protected with industry-standard practices.
            </p>

            <div className="space-y-4">
              {securityFeatures.map((feature, idx) => {
                const Icon = feature.icon
                return (
                  <div key={idx} className="flex gap-4">
                    <Icon size={24} className="text-accent flex-shrink-0 mt-1" />
                    <div>
                      <h4 className="font-bold text-foreground mb-1">{feature.title}</h4>
                      <p className="text-sm text-muted-foreground">{feature.description}</p>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Right - Security Features */}
          <div className="bg-background rounded-lg p-8 border border-border">
            <h3 className="font-bold text-lg mb-6">Built on Trusted Infrastructure</h3>
            <div className="space-y-4">
              {[
                { feature: "Supabase Platform", desc: "Enterprise-grade PostgreSQL hosting and auth" },
                { feature: "Connection Pooling", desc: "Efficient database connection management" },
                { feature: "Query Validation", desc: "SQL injection prevention and syntax checking" },
                { feature: "Isolated User Data", desc: "Each user's connections are completely isolated" },
              ].map((item, idx) => (
                <div key={idx} className="flex items-start gap-3 pb-4 border-b border-border last:border-0">
                  <div className="w-2 h-2 bg-accent rounded-full mt-2 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-foreground text-sm">{item.feature}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
