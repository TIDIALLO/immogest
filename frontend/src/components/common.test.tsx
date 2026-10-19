import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { EmptyState, Pagination, StatusBadge } from '@/components/common'
import { STATUT_PAIEMENT } from '@/lib/labels'

describe('StatusBadge', () => {
  it('affiche le libellé français du statut', () => {
    render(<StatusBadge map={STATUT_PAIEMENT} value="retard" />)
    expect(screen.getByText('En retard')).toBeInTheDocument()
  })
  it('retombe sur la valeur brute pour un statut inconnu', () => {
    render(<StatusBadge map={STATUT_PAIEMENT} value="inconnu" />)
    expect(screen.getByText('inconnu')).toBeInTheDocument()
  })
})

describe('Pagination', () => {
  it("n'affiche rien quand tout tient sur une page", () => {
    const { container } = render(<Pagination page={1} count={10} pageSize={20} onChange={() => {}} />)
    expect(container).toBeEmptyDOMElement()
  })
  it('désactive Précédent sur la première page', () => {
    render(<Pagination page={1} count={45} pageSize={20} onChange={() => {}} />)
    expect(screen.getByText('Précédent')).toBeDisabled()
    expect(screen.getByText(/Page 1 sur 3/)).toBeInTheDocument()
  })
})

describe('EmptyState', () => {
  it('affiche le titre et la description', () => {
    render(<EmptyState title="Aucun bien" description="Ajoutez-en un." />)
    expect(screen.getByText('Aucun bien')).toBeInTheDocument()
    expect(screen.getByText('Ajoutez-en un.')).toBeInTheDocument()
  })
})
