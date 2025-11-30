
import { useEffect, useState, useRef } from 'react'

export function useInView(options: IntersectionObserverInit = {}) {
    const ref = useRef<HTMLDivElement>(null)
    const [isInView, setIsInView] = useState(false)
    const [hasTriggered, setHasTriggered] = useState(false)

    useEffect(() => {
        const observer = new IntersectionObserver(([entry]) => {
            if (entry.isIntersecting) {
                setIsInView(true)
                setHasTriggered(true)
            } else {
                setIsInView(false)
            }
        }, options)

        if (ref.current) {
            observer.observe(ref.current)
        }

        return () => {
            if (ref.current) {
                observer.unobserve(ref.current)
            }
        }
    }, [ref, options])

    return { ref, isInView, hasTriggered }
}
