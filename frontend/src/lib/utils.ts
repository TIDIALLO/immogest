import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}

const fcfa = new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 0 })

/** Formate un montant en FCFA sans décimales (le FCFA n'a pas de centimes). */
export function formatFCFA(value: number | string | null | undefined): string {
  const n = Number(value ?? 0)
  return `${fcfa.format(Number.isFinite(n) ? n : 0)} FCFA`
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(value.length === 10 ? `${value}T00:00:00` : value)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('fr-FR')
}

export function formatMois(value: string | null | undefined): string {
  if (!value) return '—'
  const d = new Date(`${value.slice(0, 10)}T00:00:00`)
  return d.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })
}

export function toNumber(value: string | number | null | undefined): number {
  const n = Number(value ?? 0)
  return Number.isFinite(n) ? n : 0
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) return error.message
  return 'Une erreur inattendue est survenue.'
}
