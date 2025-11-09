"use client"

import { useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Database } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { ErrorDisplay } from "@/components/error-display"
import { createClient } from "@/lib/supabase/client"

export default function SignupPage() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [success, setSuccess] = useState(false)
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = createClient()

  const redirect = searchParams.get("redirect") || "/query"

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    setSuccess(false)

    // Validate passwords match
    if (password !== confirmPassword) {
      setError("Passwords do not match")
      setLoading(false)
      return
    }

    // Validate password length
    if (password.length < 6) {
      setError("Password must be at least 6 characters")
      setLoading(false)
      return
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    } else {
      setSuccess(true)
      setLoading(false)
      // Auto-login after signup
      setTimeout(() => {
        router.push(redirect)
        router.refresh()
      }, 2000)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md p-8">
        <div className="flex items-center justify-center gap-2 mb-6">
          <Database className="text-primary" size={32} />
          <h1 className="text-2xl font-bold">NLSQL Pro</h1>
        </div>

        <h2 className="text-xl font-semibold mb-6 text-center">Create your account</h2>

        {success ? (
          <div className="text-center py-8">
            <div className="text-primary text-5xl mb-4">✓</div>
            <p className="text-lg font-semibold mb-2">Account created successfully!</p>
            <p className="text-sm text-muted-foreground">Redirecting you to the app...</p>
          </div>
        ) : (
          <form onSubmit={handleSignup} className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-1.5 block">Email</label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                autoComplete="email"
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">Password</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="••••••••"
                autoComplete="new-password"
                minLength={6}
              />
              <p className="text-xs text-muted-foreground mt-1">At least 6 characters</p>
            </div>

            <div>
              <label className="text-sm font-medium mb-1.5 block">Confirm Password</label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                placeholder="••••••••"
                autoComplete="new-password"
                minLength={6}
              />
            </div>

            {error && <ErrorDisplay error={error} context="generation" />}

            <Button type="submit" className="w-full" disabled={loading} size="lg">
              {loading ? "Creating account..." : "Sign up"}
            </Button>
          </form>
        )}

        {!success && (
          <>
            <div className="mt-6 text-center text-sm">
              <span className="text-muted-foreground">Already have an account? </span>
              <a
                href={`/auth/login${redirect ? `?redirect=${redirect}` : ""}`}
                className="text-primary hover:underline font-medium"
              >
                Login
              </a>
            </div>

            <div className="mt-4 text-center">
              <a href="/" className="text-sm text-muted-foreground hover:text-foreground">
                ← Back to Home
              </a>
            </div>
          </>
        )}
      </Card>
    </div>
  )
}
