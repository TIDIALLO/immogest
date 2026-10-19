import { describe, expect, it } from 'vitest'

import { buildUrl } from '@/lib/api'
import { buildPayload } from '@/components/FormDialog'
import { formatDate, formatFCFA, toNumber } from '@/lib/utils'

describe('formatFCFA', () => {
  it('formate sans décimales avec le suffixe FCFA', () => {
    expect(formatFCFA(1250000).replace(/\s/g, ' ')).toBe('1 250 000 FCFA')
  })
  it('tolère les valeurs vides ou invalides', () => {
    expect(formatFCFA(null)).toContain('0 FCFA')
    expect(formatFCFA('abc')).toContain('0 FCFA')
  })
})

describe('formatDate / toNumber', () => {
  it('renvoie un tiret pour une date absente', () => {
    expect(formatDate(null)).toBe('—')
  })
  it('convertit les chaînes décimales de DRF', () => {
    expect(toNumber('150000.00')).toBe(150000)
  })
})

describe('buildUrl', () => {
  it('ignore les paramètres vides', () => {
    expect(buildUrl('/biens/', { page: 2, search: '', statut: undefined })).toBe('/api/v1/biens/?page=2')
  })
})

describe('buildPayload', () => {
  it('omet les nombres vides non nullables et envoie null pour les nullables', () => {
    const out = buildPayload(
      [
        { name: 'depot', label: 'Dépôt', type: 'number' },
        { name: 'etage', label: 'Étage', type: 'number', nullable: true },
        { name: 'nom', label: 'Nom', type: 'text' },
      ],
      { depot: '', etage: '', nom: '' },
    )
    expect(out).toEqual({ etage: null, nom: '' })
  })
})
