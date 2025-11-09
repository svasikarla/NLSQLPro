"use client"

import { useState } from "react"
import Link from "next/link"
import { Menu, X } from "lucide-react"
import { Button } from "@/components/ui/button"

export default function Header() {
  const [isOpen, setIsOpen] = useState(false)

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-background/80 backdrop-blur-md border-b border-border">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-lg">N</span>
            </div>
            <span className="font-bold text-lg text-foreground">NLSQL Pro</span>
          </div>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex gap-8 items-center">
            <Link href="#features" className="text-muted-foreground hover:text-foreground transition">
              Features
            </Link>
            <Link href="#security" className="text-muted-foreground hover:text-foreground transition">
              Security
            </Link>
            <Link href="#pricing" className="text-muted-foreground hover:text-foreground transition">
              Pricing
            </Link>
            <Link href="#testimonials" className="text-muted-foreground hover:text-foreground transition">
              Testimonials
            </Link>
          </nav>

          {/* Desktop CTA */}
          <div className="hidden md:flex gap-3">
            <Button
              variant="outline"
              className="border-border hover:bg-card bg-transparent"
              onClick={() => (window.location.href = "/auth/login")}
            >
              Sign In
            </Button>
            <Button
              className="bg-primary hover:bg-primary/90 text-primary-foreground"
              onClick={() => (window.location.href = "/auth/signup")}
            >
              Get Started Free
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button className="md:hidden text-foreground" onClick={() => setIsOpen(!isOpen)} aria-label="Toggle menu">
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>

        {/* Mobile Navigation */}
        {isOpen && (
          <div className="md:hidden pb-4 pt-2 border-t border-border">
            <nav className="flex flex-col gap-3">
              <Link href="#features" className="text-muted-foreground hover:text-foreground transition py-2">
                Features
              </Link>
              <Link href="#security" className="text-muted-foreground hover:text-foreground transition py-2">
                Security
              </Link>
              <Link href="#pricing" className="text-muted-foreground hover:text-foreground transition py-2">
                Pricing
              </Link>
              <Link href="#testimonials" className="text-muted-foreground hover:text-foreground transition py-2">
                Testimonials
              </Link>
              <div className="flex flex-col gap-2 pt-2">
                <Button
                  variant="outline"
                  className="border-border hover:bg-card w-full bg-transparent"
                  onClick={() => (window.location.href = "/auth/login")}
                >
                  Sign In
                </Button>
                <Button
                  className="bg-primary hover:bg-primary/90 text-primary-foreground w-full"
                  onClick={() => (window.location.href = "/auth/signup")}
                >
                  Get Started Free
                </Button>
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  )
}
