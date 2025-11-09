"use client"

export default function TrustedBySection() {
  const companies = [
    { name: "Acme Healthcare", industry: "Healthcare" },
    { name: "FinanceCore", industry: "Finance" },
    { name: "RetailGiant", industry: "E-commerce" },
    { name: "DataStream", industry: "SaaS" },
    { name: "TechVentures", industry: "Tech" },
    { name: "GlobalAnalytics", industry: "Analytics" },
  ]

  return (
    <section className="py-16 px-4 sm:px-6 lg:px-8 bg-card/50 border-y border-border">
      <div className="max-w-6xl mx-auto">
        <h3 className="text-center text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-12">
          Trusted by leading enterprises
        </h3>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-8 items-center">
          {companies.map((company, idx) => (
            <div
              key={idx}
              className="flex flex-col items-center justify-center p-4 rounded-lg bg-background/50 border border-border/50 hover:border-accent/30 transition"
            >
              <p className="font-semibold text-foreground text-sm text-center">{company.name}</p>
              <p className="text-xs text-muted-foreground text-center mt-1">{company.industry}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
