import Header from "@/components/header"
import HeroSection from "@/components/hero-section"
import FeaturesSection from "@/components/features-section"
import TransformationDemo from "@/components/transformation-demo"
import TrustedBySection from "@/components/trusted-by-section"
import TestimonialsSection from "@/components/testimonials-section"
import SecuritySection from "@/components/security-section"
import PricingSection from "@/components/pricing-section"
import CTASection from "@/components/cta-section"
import Footer from "@/components/footer"

export default function Home() {
  return (
    <main className="w-full overflow-hidden">
      <Header />
      <HeroSection />
      <TransformationDemo />
      <FeaturesSection />
      <TrustedBySection />
      <TestimonialsSection />
      <SecuritySection />
      <PricingSection />
      <CTASection />
      <Footer />
    </main>
  )
}
