"use client"

import { Shield, Lock, Eye, Key } from "lucide-react"

const securityFeatures = [
  {
    icon: Shield,
    title: "Prompt Injection Defense",
    description: "Advanced detection blocks 30+ attack patterns including jailbreaks, SQL injection, and LLM manipulation attempts",
  },
  {
    icon: Lock,
    title: "AES-256 Encryption",
    description: "Database credentials encrypted at rest with industry-standard AES-256-GCM. Environment-based key management.",
  },
  {
    icon: Eye,
    title: "Multi-Layer Validation",
    description: "SQL syntax validation, schema verification, and query complexity analysis. Read-only mode enforced.",
  },
  {
    icon: Key,
    title: "Secure Authentication",
    description: "Supabase Auth with Row-Level Security. Users can only access their own connections and queries.",
  },
]

export default function SecuritySection() {
  return (
    <section id="security" className="py-20 px-4 sm:px-6 lg:px-8 bg-card/50 border-y border-border">
      <div className="max-w-6xl mx-auto">
        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Left - Heading */}
          <div>
            <h2 className="text-4xl font-bold mb-6">Enterprise-Grade Security</h2>
            <p className="text-lg text-muted-foreground mb-8">
              Production-hardened with comprehensive security measures. Protects against prompt injection, SQL injection, and unauthorized access with multi-layer defense systems.
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
            <h3 className="font-bold text-lg mb-6">Production Security Features</h3>
            <div className="space-y-4">
              {[
                { feature: "Prompt Injection Blocking", desc: "Real-time detection with 4-level risk classification" },
                { feature: "Schema Fingerprinting", desc: "MD5 hash-based change detection and cache invalidation" },
                { feature: "Environment Validation", desc: "Startup checks prevent configuration errors" },
                { feature: "Connection Pooling", desc: "Secure, efficient multi-database connection management" },
                { feature: "Comprehensive Logging", desc: "Security incident tracking for audit compliance" },
                { feature: "Row-Level Security", desc: "Supabase RLS isolates user data completely" },
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
