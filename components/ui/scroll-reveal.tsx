
'use client'

import { cn } from '@/lib/utils'
import { useInView } from '@/hooks/use-in-view'

interface ScrollRevealProps {
    children: React.ReactNode
    className?: string
    delay?: number // in ms
    duration?: number // in ms
    threshold?: number // 0-1
}

export function ScrollReveal({
    children,
    className,
    delay = 0,
    duration = 700,
    threshold = 0.1
}: ScrollRevealProps) {
    const { ref, hasTriggered } = useInView({ threshold })

    return (
        <div
            ref={ref}
            className={cn(
                "transition-all ease-out",
                hasTriggered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8",
                className
            )}
            style={{
                transitionDuration: `${duration}ms`,
                transitionDelay: `${delay}ms`
            }}
        >
            {children}
        </div>
    )
}
