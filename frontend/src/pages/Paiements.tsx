import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Banknote, Download, FileText, MoreHorizontal, Plus, RefreshCw } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { PageHeader, StatCard, StatusBadge } from '@/components/common'
import { FormDialog, type FieldDef } from '@/components/FormDialog'
import { ListShell } from '@/components/ListShell'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Select } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { api, downloadFile } from '@/lib/api'
import { MODES_PAIEMENT, STATUT_PAIEMENT } from '@/lib/labels'
import { invalidateAll, notifyError, useList, useSave } from '@/lib/queries'
import type { Contrat, Paiement, PaiementsPage } from '@/lib/types'
import { formatDate, formatFCFA, formatMois, toNumber } from '@/lib/utils'

export default function Paiements() {
  const qc = useQueryClient()
  const [page, setPage] = useState(1)
  const [statut, setStatut] = useState('')
  const query = useList<Paiement, PaiementsPage>('/paiements', { page, statut })
  const contrats = useList<Contrat>('/contrats', { statut: 'actif', page_size: 200 })
  const save = useSave<Paiement>('/paiements')
  const [creating, setCreating] = useState(false)
  const [paying, setPaying] = useState<Paiement | null>(null)

  const generer = useMutation({
    mutationFn: () => api.post<{ crees: number }>('/paiements/generer-mois/'),
    onSuccess: (r) => {
      invalidateAll(qc, '/paiements')
      toast.success(r.crees ? `${r.crees} loyer(s) généré(s).` : 'Tous les loyers du mois existent déjà.')
    },
    onError: notifyError,
  })
  const verser = useMutation({
    mutationFn: ({ id, data }: { id: number; data: unknown }) => api.post<Paiement>(`/paiements/${id}/versement/`, data),
    onSuccess: () => invalidateAll(qc, '/paiements'),
  })

  const creationFields: FieldDef[] = useMemo(() => [
    { name: 'contrat', label: 'Contrat', type: 'select', required: true, full: true, options: (contrats.data?.results ?? []).map((c) => ({ value: c.id, label: `${c.bien_nom} — ${c.locataire_nom}` })) },
    { name: 'mois', label: 'Mois concerné (1er jour)', type: 'date', required: true },
    { name: 'montant_du', label: 'Montant dû (FCFA)', type: 'number', hint: 'Laissez vide pour utiliser loyer + charges du contrat.' },
    { name: 'montant_paye', label: 'Déjà payé (FCFA)', type: 'number' },
    { name: 'mode_paiement', label: 'Mode de paiement', type: 'select', options: MODES_PAIEMENT },
  ], [contrats.data])

  const versementFields: FieldDef[] = [
    { name: 'montant', label: 'Montant du versement (FCFA)', type: 'number', required: true, hint: paying ? `Solde restant : ${formatFCFA(paying.solde)}` : undefined },
    { name: 'mode_paiement', label: 'Mode de paiement', type: 'select', options: MODES_PAIEMENT, required: true },
    { name: 'date_versement', label: 'Date', type: 'date' },
  ]

  const totaux = query.data?.totaux

  return (
    <>
      <PageHeader
        title="Paiements"
        description="Suivi des loyers : le statut est calculé automatiquement."
        actions={
          <>
            <Button variant="outline" loading={generer.isPending} onClick={() => generer.mutate()}><RefreshCw /> Générer les loyers du mois</Button>
            <Button variant="outline" onClick={() => downloadFile('/rapports/financier/', { export: 'xlsx' }, 'rapport.xlsx').catch(notifyError)}><Download /> Excel</Button>
            <Button onClick={() => setCreating(true)}><Plus /> Nouveau paiement</Button>
          </>
        }
      />
      <div className="mb-4 grid gap-4 sm:grid-cols-3">
        <StatCard label="Encaissé" value={formatFCFA(totaux?.encaisse)} tone="success" icon={<Banknote className="h-5 w-5" />} />
        <StatCard label="Reste à payer" value={formatFCFA(totaux?.reste_a_payer)} tone="warning" icon={<Banknote className="h-5 w-5" />} />
        <StatCard label="Loyers en retard" value={totaux?.nb_retard ?? 0} tone={totaux?.nb_retard ? 'danger' : 'neutral'} icon={<Banknote className="h-5 w-5" />} />
      </div>
      <ListShell
        query={query}
        page={page}
        onPage={setPage}
        cols={6}
        emptyTitle="Aucun paiement"
        emptyDescription="Générez les loyers du mois pour tous vos contrats actifs en un clic."
        emptyAction={<Button onClick={() => generer.mutate()} loading={generer.isPending}><RefreshCw /> Générer les loyers du mois</Button>}
        toolbar={
          <Select className="w-44" value={statut} onChange={(e) => { setStatut(e.target.value); setPage(1) }} aria-label="Filtrer par statut">
            <option value="">Tous les statuts</option>
            {Object.entries(STATUT_PAIEMENT).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}
          </Select>
        }
      >
        {(rows) => (
          <Table>
            <TableHeader>
              <TableRow><TableHead>Mois</TableHead><TableHead>Locataire / bien</TableHead><TableHead>Dû</TableHead><TableHead>Payé</TableHead><TableHead>Échéance</TableHead><TableHead>Statut</TableHead><TableHead className="w-10" /></TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium capitalize">{formatMois(p.mois)}</TableCell>
                  <TableCell>{p.locataire_nom}<p className="text-xs text-muted-foreground">{p.bien_nom}</p></TableCell>
                  <TableCell className="tabular-nums">{formatFCFA(p.montant_du)}</TableCell>
                  <TableCell className="tabular-nums">{formatFCFA(p.montant_paye)}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(p.date_echeance)}</TableCell>
                  <TableCell><StatusBadge map={STATUT_PAIEMENT} value={p.statut} /></TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label="Actions"><MoreHorizontal /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {toNumber(p.solde) > 0 && <DropdownMenuItem onSelect={() => setPaying(p)}><Banknote /> Enregistrer un versement</DropdownMenuItem>}
                        <DropdownMenuItem onSelect={() => downloadFile(`/paiements/${p.id}/quittance/`, undefined, 'quittance.pdf').catch(notifyError)}><FileText /> Quittance PDF</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </ListShell>

      <FormDialog
        open={creating}
        onOpenChange={setCreating}
        title="Nouveau paiement"
        fields={creationFields}
        defaultValues={{ montant_paye: 0 }}
        onSubmit={async (payload) => {
          await save.mutateAsync({ data: payload })
          toast.success('Paiement enregistré.')
        }}
      />
      <FormDialog
        open={paying !== null}
        onOpenChange={(o) => !o && setPaying(null)}
        title="Enregistrer un versement"
        description={paying ? `${paying.locataire_nom} — ${formatMois(paying.mois)}` : undefined}
        fields={versementFields}
        defaultValues={{ montant: paying?.solde, mode_paiement: 'wave' }}
        submitLabel="Valider le versement"
        onSubmit={async (payload) => {
          if (!paying) return
          await verser.mutateAsync({ id: paying.id, data: payload })
          toast.success('Versement enregistré.')
        }}
      />
    </>
  )
}
