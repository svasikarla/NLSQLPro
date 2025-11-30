
'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
    DialogFooter,
} from '@/components/ui/dialog'
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table'
import { Book, Plus, Trash2, Edit2, Search, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

interface GlossaryTerm {
    id: string
    term: string
    definition: string
    sql_logic?: string
}

export function GlossaryManager() {
    const [isOpen, setIsOpen] = useState(false)
    const [terms, setTerms] = useState<GlossaryTerm[]>([])
    const [isLoading, setIsLoading] = useState(false)
    const [searchQuery, setSearchQuery] = useState('')
    const [isEditing, setIsEditing] = useState(false)
    const [currentTerm, setCurrentTerm] = useState<Partial<GlossaryTerm>>({})

    // Fetch terms
    const fetchTerms = async () => {
        setIsLoading(true)
        try {
            const response = await fetch(`/api/glossary?query=${encodeURIComponent(searchQuery)}`)
            if (!response.ok) throw new Error('Failed to fetch terms')
            const data = await response.json()
            setTerms(data.terms)
        } catch (error) {
            toast.error('Failed to load glossary')
        } finally {
            setIsLoading(false)
        }
    }

    useEffect(() => {
        if (isOpen) {
            fetchTerms()
        }
    }, [isOpen, searchQuery])

    const handleSave = async () => {
        if (!currentTerm.term || !currentTerm.definition) {
            toast.error('Term and definition are required')
            return
        }

        try {
            const method = currentTerm.id ? 'PUT' : 'POST'
            const response = await fetch('/api/glossary', {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(currentTerm)
            })

            if (!response.ok) throw new Error('Failed to save term')

            toast.success(currentTerm.id ? 'Term updated' : 'Term created')
            setIsEditing(false)
            setCurrentTerm({})
            fetchTerms()
        } catch (error) {
            toast.error('Failed to save term')
        }
    }

    const handleDelete = async (id: string) => {
        try {
            const response = await fetch(`/api/glossary?id=${id}`, {
                method: 'DELETE'
            })

            if (!response.ok) throw new Error('Failed to delete term')

            toast.success('Term deleted')
            fetchTerms()
        } catch (error) {
            toast.error('Failed to delete term')
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={setIsOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                    <Book size={16} />
                    Glossary
                </Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl h-[80vh] flex flex-col">
                <DialogHeader>
                    <DialogTitle>Business Glossary</DialogTitle>
                    <DialogDescription>
                        Define business terms to help the AI understand your specific domain logic.
                    </DialogDescription>
                </DialogHeader>

                {isEditing ? (
                    <div className="space-y-4 py-4 flex-1 overflow-y-auto">
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Term</label>
                            <Input
                                placeholder="e.g. Churned User"
                                value={currentTerm.term || ''}
                                onChange={(e) => setCurrentTerm({ ...currentTerm, term: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">Definition</label>
                            <Textarea
                                placeholder="Describe what this term means..."
                                value={currentTerm.definition || ''}
                                onChange={(e) => setCurrentTerm({ ...currentTerm, definition: e.target.value })}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-sm font-medium">SQL Logic (Optional)</label>
                            <Textarea
                                placeholder="e.g. status = 'inactive' AND last_login < NOW() - INTERVAL '30 days'"
                                className="font-mono text-xs"
                                value={currentTerm.sql_logic || ''}
                                onChange={(e) => setCurrentTerm({ ...currentTerm, sql_logic: e.target.value })}
                            />
                            <p className="text-xs text-muted-foreground">
                                Provide a SQL fragment that defines this term. This helps the AI generate accurate queries.
                            </p>
                        </div>
                        <div className="flex justify-end gap-2 pt-4">
                            <Button variant="outline" onClick={() => setIsEditing(false)}>Cancel</Button>
                            <Button onClick={handleSave}>Save Term</Button>
                        </div>
                    </div>
                ) : (
                    <>
                        <div className="flex items-center justify-between py-4 gap-4">
                            <div className="relative flex-1">
                                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Search terms..."
                                    className="pl-8"
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                />
                            </div>
                            <Button onClick={() => { setCurrentTerm({}); setIsEditing(true) }} className="gap-2">
                                <Plus size={16} />
                                Add Term
                            </Button>
                        </div>

                        <div className="flex-1 overflow-auto border rounded-md">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Term</TableHead>
                                        <TableHead>Definition</TableHead>
                                        <TableHead className="w-[100px]">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {isLoading ? (
                                        <TableRow>
                                            <TableCell colSpan={3} className="text-center py-8">
                                                <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                                            </TableCell>
                                        </TableRow>
                                    ) : terms.length === 0 ? (
                                        <TableRow>
                                            <TableCell colSpan={3} className="text-center py-8 text-muted-foreground">
                                                No terms found. Add one to get started.
                                            </TableCell>
                                        </TableRow>
                                    ) : (
                                        terms.map((term) => (
                                            <TableRow key={term.id}>
                                                <TableCell className="font-medium">{term.term}</TableCell>
                                                <TableCell>
                                                    <div>{term.definition}</div>
                                                    {term.sql_logic && (
                                                        <code className="text-xs bg-muted px-1 py-0.5 rounded mt-1 block w-fit">
                                                            {term.sql_logic}
                                                        </code>
                                                    )}
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex gap-1">
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8"
                                                            onClick={() => { setCurrentTerm(term); setIsEditing(true) }}
                                                        >
                                                            <Edit2 size={14} />
                                                        </Button>
                                                        <Button
                                                            variant="ghost"
                                                            size="icon"
                                                            className="h-8 w-8 text-destructive hover:text-destructive"
                                                            onClick={() => handleDelete(term.id)}
                                                        >
                                                            <Trash2 size={14} />
                                                        </Button>
                                                    </div>
                                                </TableCell>
                                            </TableRow>
                                        ))
                                    )}
                                </TableBody>
                            </Table>
                        </div>
                    </>
                )}
            </DialogContent>
        </Dialog>
    )
}
