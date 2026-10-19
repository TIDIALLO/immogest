import { Check, MoreHorizontal, Plus, Repeat, X } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { PageHeader, StatusBadge } from '@/components/common'
import { FormDialog, type FieldDef } from '@/components/FormDialog'
import { ListShell } from '@/components/ListShell'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Select } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { MODES_PAIEMENT, STATUT_RESERVATION } from '@/lib/labels'
import { useItemAction, useList, useSave } from '@/lib/queries'
import type { Bien, Reservation, ReservationStatut } from '@/lib/types'
import { formatDate, formatFCFA } from '@/lib/utils'

export default function Reservations() {
  const [page, setPage] = useState(1)
  const [statut, setStatut] = useState('')
  const query = useList<Reservation>('/reservations', { page, statut })
  const biens = useList<Bien>('/biens', { page_size: 200, statut: 'libre' })
  const save = useSave<Reservation>('/reservations')
  const action = useItemAction<Reservation>('/reservations', ['/contrats', '/biens', '/locataires'])
  const [creating, setCreating] = useState(false)

  const fields: FieldDef[] = useMemo(() => [
    { name: 'bien', label: 'Bien', type: 'select', required: true, full: true, options: (biens.data?.results ?? []).map((b) => ({ value: b.id, label: `${b.nom} — ${b.ville}` })) },
    { name: 'nom', label: 'Nom du client', required: true },
    { name: 'telephone', label: 'Téléphone', type: 'tel', required: true },
    { name: 'email', label: 'Email', type: 'email' },
    { name: 'nb_personnes', label: 'Personnes', type: 'number', step: '1' },
    { name: 'date_arrivee', label: 'Arrivée', type: 'date', required: true },
    { name: 'date_depart', label: 'Départ', type: 'date', nullable: true },
    { name: 'mode_paiement', label: 'Mode de paiement', type: 'select', required: true, options: MODES_PAIEMENT.slice(0, 3) },
    { name: 'statut', label: 'Statut', type: 'select', required: true, options: Object.entries(STATUT_RESERVATION).map(([value, s]) => ({ value, label: s.label })) },
    { name: 'message', label: 'Message', type: 'textarea' },
  ], [biens.data])

  const setStatus = (r: Reservation, s: ReservationStatut) =>
    action.mutate({ id: r.id, action: 'statut', body: { statut: s }, optimistic: { statut: s, statut_display: STATUT_RESERVATION[s].label } }, { onSuccess: () => toast.success('Statut mis à jour.') })

  return (
    <>
      <PageHeader title="Réservations" description="Commandes reçues depuis le site public." actions={<Button onClick={() => setCreating(true)}><Plus /> Ajouter</Button>} />
      <ListShell
        query={query}
        page={page}
        onPage={setPage}
        cols={6}
        emptyTitle="Aucune réservation"
        emptyDescription="Les réservations faites sur le site public apparaîtront ici."
        toolbar={
          <Select className="w-52" value={statut} onChange={(e) => { setStatut(e.target.value); setPage(1) }} aria-label="Filtrer par statut">
            <option value="">Tous les statuts</option>
            {Object.entries(STATUT_RESERVATION).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}
          </Select>
        }
      >
        {(rows) => (
          <Table>
            <TableHeader>
              <TableRow><TableHead>Réf.</TableHead><TableHead>Client</TableHead><TableHead>Bien</TableHead><TableHead>Séjour</TableHead><TableHead>Montant</TableHead><TableHead>Statut</TableHead><TableHead className="w-10" /></TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-mono text-xs">{r.reference}</TableCell>
                  <TableCell className="font-medium">{r.nom}<p className="text-xs font-normal text-muted-foreground">{r.telephone}</p></TableCell>
                  <TableCell>{r.bien_nom}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(r.date_arrivee)} → {formatDate(r.date_depart)}<p className="text-xs">{r.nb_nuits} nuit(s) · {r.nb_personnes} pers.</p></TableCell>
                  <TableCell className="tabular-nums">{formatFCFA(r.montant_total)}</TableCell>
                  <TableCell><StatusBadge map={STATUT_RESERVATION} value={r.statut} /></TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label="Actions"><MoreHorizontal /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        {r.statut === 'en_attente' && <DropdownMenuItem onSelect={() => setStatus(r, 'payee')}><Check /> Marquer payée</DropdownMenuItem>}
                        {(r.statut === 'en_attente' || r.statut === 'payee') && <DropdownMenuItem onSelect={() => setStatus(r, 'confirmee')}><Check /> Confirmer</DropdownMenuItem>}
                        {r.statut === 'confirmee' && (
                          <DropdownMenuItem onSelect={() => action.mutate({ id: r.id, action: 'convertir-en-contrat' }, { onSuccess: () => toast.success('Contrat saisonnier créé.') })}><Repeat /> Convertir en contrat</DropdownMenuItem>
                        )}
                        {r.statut !== 'annulee' && <DropdownMenuItem destructive onSelect={() => setStatus(r, 'annulee')}><X /> Annuler</DropdownMenuItem>}
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
        title="Ajouter une réservation"
        description="Le montant est calculé automatiquement ; les dates déjà réservées sont refusées."
        fields={fields}
        defaultValues={{ nb_personnes: 1, mode_paiement: 'wave', statut: 'en_attente' }}
        onSubmit={async (payload) => {
          await save.mutateAsync({ data: payload })
          toast.success('Réservation ajoutée.')
        }}
      />
    </>
  )
}
