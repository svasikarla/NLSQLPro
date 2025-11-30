"use client"

import { Shield, Lock, Eye, Key } from "lucide-react"
import { ScrollReveal } from "@/components/ui/scroll-reveal"

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
        <ScrollReveal>
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

            {/* Right - Visual/Code */}
            <div className="bg-background border border-border rounded-xl p-6 shadow-lg">
              <div className="flex items-center gap-2 mb-4 border-b border-border pb-4">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <div className="w-3 h-3 rounded-full bg-yellow-500" />
                <div className="w-3 h-3 rounded-full bg-green-500" />
                <span className="text-xs text-muted-foreground ml-2">security-audit.log</span>
              </div>
              <pre className="text-xs font-mono text-muted-foreground overflow-x-auto">
                <code>{`[INFO] Validating request signature... OK
[INFO] Checking rate limits... OK
[INFO] Scanning for prompt injection...
[PASS] Pattern "ignore previous instructions" not found
[PASS] Pattern "drop table" not found
[PASS] Pattern "system prompt" not found
[INFO] Analyzing SQL complexity...
[INFO] Row-level security policies applied
[SUCCESS] Query authorized for execution`}</code>
              </pre>
            </div>
          </div>
        </ScrollReveal>
      </div>
    </section>
  )
}
