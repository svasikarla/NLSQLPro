'use client'

import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Sparkles } from "lucide-react"

interface ClarificationDialogProps {
    isOpen: boolean
    onClose: () => void
    options: string[]
    reasoning?: string
    onSelect: (option: string) => void
}

export function ClarificationDialog({
    isOpen,
    onClose,
    options,
    reasoning,
    onSelect,
}: ClarificationDialogProps) {
    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-amber-500" />
                        Clarification Needed
                    </DialogTitle>
                    <DialogDescription>
                        {reasoning || "Your question has multiple interpretations. Please select one to proceed:"}
                    </DialogDescription>
                </DialogHeader>
                <div className="grid gap-3 py-4">
                    {options.map((option, index) => (
                        <Button
                            key={index}
                            variant="outline"
                            className="justify-start h-auto py-3 px-4 text-left hover:bg-amber-50 hover:text-amber-900 hover:border-amber-200 transition-colors"
                            onClick={() => onSelect(option)}
                        >
                            <span className="font-medium">{option}</span>
                        </Button>
                    ))}
                </div>
            </DialogContent>
        </Dialog>
    )
}
