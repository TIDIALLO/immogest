import { Download } from 'lucide-react'
import { useState } from 'react'

import { PageHeader, StatusBadge } from '@/components/common'
import { ListShell } from '@/components/ListShell'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { downloadFile } from '@/lib/api'
import { STATUT_PAIEMENT } from '@/lib/labels'
import { notifyError, useList } from '@/lib/queries'
import type { Paiement } from '@/lib/types'
import { formatDate, formatFCFA, formatMois } from '@/lib/utils'

export default function EspacePaiements() {
  const [page, setPage] = useState(1)
  const query = useList<Paiement>('/espace/paiements', { page })
  return (
    <>
      <PageHeader title="Mes paiements" description="Historique de vos loyers et quittances." />
      <ListShell query={query} page={page} onPage={setPage} emptyTitle="Aucun paiement" cols={5}>
        {(rows) => (
          <Table>
            <TableHeader>
              <TableRow><TableHead>Mois</TableHead><TableHead>Dû</TableHead><TableHead>Payé</TableHead><TableHead>Date</TableHead><TableHead>Statut</TableHead><TableHead className="w-10" /></TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium capitalize">{formatMois(p.mois)}</TableCell>
                  <TableCell className="tabular-nums">{formatFCFA(p.montant_du)}</TableCell>
                  <TableCell className="tabular-nums">{formatFCFA(p.montant_paye)}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(p.date_paiement)}</TableCell>
                  <TableCell><StatusBadge map={STATUT_PAIEMENT} value={p.statut} /></TableCell>
                  <TableCell>
                    {p.statut === 'paye' && (
                      <Button variant="ghost" size="icon" aria-label="Quittance PDF" onClick={() => downloadFile(`/espace/paiements/${p.id}/quittance/`, undefined, 'quittance.pdf').catch(notifyError)}><Download /></Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </ListShell>
    </>
  )
}
