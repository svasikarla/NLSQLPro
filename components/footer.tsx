"use client"

import { Mail, Linkedin, X, Github } from "lucide-react"
import Link from "next/link"

export default function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-card border-t border-border">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid md:grid-cols-4 gap-8 mb-12">
          {/* Brand */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-gradient-to-br from-primary to-accent rounded-lg flex items-center justify-center">
                <span className="text-primary-foreground font-bold text-lg">N</span>
              </div>
              <span className="font-bold text-lg text-foreground">NLSQL Pro</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Transform natural language into SQL queries with enterprise-grade security.
            </p>
          </div>

          {/* Product */}
          <div>
            <h4 className="font-bold text-foreground mb-4">Product</h4>
            <ul className="space-y-2">
              <li>
                <Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition">
                  Features
                </Link>
              </li>
              <li>
                <Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition">
                  Pricing
                </Link>
              </li>
              <li>
                <Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition">
                  Security
                </Link>
              </li>
              <li>
                <Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition">
                  Docs
                </Link>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-bold text-foreground mb-4">Company</h4>
            <ul className="space-y-2">
              <li>
                <Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition">
                  About
                </Link>
              </li>
              <li>
                <Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition">
                  Blog
                </Link>
              </li>
              <li>
                <Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition">
                  Careers
                </Link>
              </li>
              <li>
                <Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition">
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-bold text-foreground mb-4">Legal</h4>
            <ul className="space-y-2">
              <li>
                <Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition">
                  Privacy
                </Link>
              </li>
              <li>
                <Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition">
                  Terms
                </Link>
              </li>
              <li>
                <Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition">
                  Cookie Policy
                </Link>
              </li>
              <li>
                <Link href="#" className="text-sm text-muted-foreground hover:text-foreground transition">
                  Status
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom */}
        <div className="border-t border-border pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-muted-foreground">© {currentYear} NLSQL Pro. All rights reserved.</p>

            <div className="flex gap-6">
              <a
                href="mailto:contact@nlsqlpro.com"
                className="text-muted-foreground hover:text-accent transition"
                aria-label="Email us"
              >
                <Mail size={18} />
              </a>
              <a
                href="https://twitter.com/nlsqlpro"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-accent transition"
                aria-label="Follow us on Twitter"
              >
                <X size={18} />
              </a>
              <a
                href="https://linkedin.com/company/nlsqlpro"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-accent transition"
                aria-label="Connect on LinkedIn"
              >
                <Linkedin size={18} />
              </a>
              <a
                href="https://github.com/nlsqlpro"
                target="_blank"
                rel="noopener noreferrer"
                className="text-muted-foreground hover:text-accent transition"
                aria-label="View our GitHub"
              >
                <Github size={18} />
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}
