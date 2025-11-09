"use client"

import { Shield, Lock, Eye, Key } from "lucide-react"

const securityFeatures = [
  {
    icon: Lock,
    title: "Encryption at Rest & In Transit",
    description: "AES-256 encryption protects your data from unauthorized access",
  },
  {
    icon: Eye,
    title: "Row-Level Access Control",
    description: "Granular permissions ensure users only access data they should see",
  },
  {
    icon: Key,
    title: "Identity Management",
    description: "SSO, MFA, and OAuth support for enterprise authentication",
  },
  {
    icon: Shield,
    title: "Audit Logging",
    description: "Complete audit trail of all queries and data access for compliance",
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
              NLSQL Pro meets the strictest security and compliance requirements. Your data privacy is our top priority.
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

          {/* Right - Certifications */}
          <div className="bg-background rounded-lg p-8 border border-border">
            <h3 className="font-bold text-lg mb-6">Compliance Certifications</h3>
            <div className="space-y-4">
              {[
                { cert: "SOC 2 Type II", desc: "Security, availability, and confidentiality" },
                { cert: "HIPAA", desc: "Healthcare data protection" },
                { cert: "GDPR", desc: "European data privacy" },
                { cert: "ISO 27001", desc: "Information security management" },
              ].map((item, idx) => (
                <div key={idx} className="flex items-start gap-3 pb-4 border-b border-border last:border-0">
                  <div className="w-2 h-2 bg-accent rounded-full mt-2 flex-shrink-0" />
                  <div>
                    <p className="font-semibold text-foreground text-sm">{item.cert}</p>
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
