import { Ban, MoreHorizontal, Pencil, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { PageHeader, StatusBadge } from '@/components/common'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { FormDialog, type FieldDef } from '@/components/FormDialog'
import { ListShell } from '@/components/ListShell'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Select } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { STATUT_CONTRAT, TYPES_BAIL } from '@/lib/labels'
import { notifyError, useDelete, useItemAction, useList, useSave } from '@/lib/queries'
import type { Bien, Contrat, Locataire } from '@/lib/types'
import { formatDate, formatFCFA } from '@/lib/utils'

export default function Contrats() {
  const [page, setPage] = useState(1)
  const [statut, setStatut] = useState('')
  const query = useList<Contrat>('/contrats', { page, statut })
  const biens = useList<Bien>('/biens', { page_size: 200 })
  const locataires = useList<Locataire>('/locataires', { page_size: 200 })
  const save = useSave<Contrat>('/contrats', ['/biens'])
  const remove = useDelete('/contrats', ['/biens'])
  const action = useItemAction<Contrat>('/contrats', ['/biens'])
  const [editing, setEditing] = useState<Contrat | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Contrat | null>(null)
  const [ending, setEnding] = useState<Contrat | null>(null)

  const fields: FieldDef[] = useMemo(() => [
    { name: 'bien', label: 'Bien', type: 'select', required: true, options: (biens.data?.results ?? []).map((b) => ({ value: b.id, label: `${b.nom} — ${b.ville}` })) },
    { name: 'locataire', label: 'Locataire', type: 'select', required: true, options: (locataires.data?.results ?? []).map((l) => ({ value: l.id, label: l.nom_complet })) },
    { name: 'type_bail', label: 'Type de bail', type: 'select', required: true, options: TYPES_BAIL },
    { name: 'date_debut', label: 'Début', type: 'date', required: true },
    { name: 'date_fin', label: 'Fin', type: 'date', nullable: true },
    { name: 'loyer_mensuel', label: 'Loyer mensuel (FCFA)', type: 'number', required: true },
    { name: 'charges_mensuelles', label: 'Charges (FCFA)', type: 'number' },
    { name: 'depot_garantie', label: 'Dépôt de garantie (FCFA)', type: 'number' },
    { name: 'jour_paiement', label: 'Jour de paiement (1-28)', type: 'number', step: '1' },
    { name: 'notes', label: 'Notes', type: 'textarea' },
  ], [biens.data, locataires.data])

  return (
    <>
      <PageHeader title="Contrats" description="Baux en cours et historique." actions={<Button onClick={() => setEditing('new')}><Plus /> Nouveau contrat</Button>} />
      <ListShell
        query={query}
        page={page}
        onPage={setPage}
        cols={6}
        emptyTitle="Aucun contrat"
        emptyDescription="Créez un contrat pour lier un locataire à un bien."
        toolbar={
          <Select className="w-44" value={statut} onChange={(e) => { setStatut(e.target.value); setPage(1) }} aria-label="Filtrer par statut">
            <option value="">Tous les statuts</option>
            {Object.entries(STATUT_CONTRAT).map(([v, s]) => <option key={v} value={v}>{s.label}</option>)}
          </Select>
        }
      >
        {(rows) => (
          <Table>
            <TableHeader>
              <TableRow><TableHead>Bien</TableHead><TableHead>Locataire</TableHead><TableHead>Période</TableHead><TableHead>Loyer + charges</TableHead><TableHead>Statut</TableHead><TableHead className="w-10" /></TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.bien_nom}</TableCell>
                  <TableCell>{c.locataire_nom}</TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(c.date_debut)} → {formatDate(c.date_fin)}</TableCell>
                  <TableCell className="tabular-nums">{formatFCFA(c.loyer_total)}</TableCell>
                  <TableCell><StatusBadge map={STATUT_CONTRAT} value={c.statut} /></TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label="Actions"><MoreHorizontal /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => setEditing(c)}><Pencil /> Modifier</DropdownMenuItem>
                        {c.statut === 'actif' && <DropdownMenuItem onSelect={() => setEnding(c)}><Ban /> Résilier</DropdownMenuItem>}
                        <DropdownMenuItem destructive onSelect={() => setDeleting(c)}><Trash2 /> Supprimer</DropdownMenuItem>
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
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title={editing === 'new' ? 'Nouveau contrat' : 'Modifier le contrat'}
        description="Un bien ne peut avoir qu'un seul contrat actif à la fois."
        fields={fields}
        defaultValues={editing && editing !== 'new' ? { ...editing } : { type_bail: 'vide', charges_mensuelles: 0, depot_garantie: 0, jour_paiement: 5 }}
        onSubmit={async (payload) => {
          await save.mutateAsync({ id: editing && editing !== 'new' ? editing.id : undefined, data: payload })
          toast.success(editing === 'new' ? 'Contrat créé : le bien passe en « loué ».' : 'Contrat modifié.')
        }}
      />
      <ConfirmDialog
        open={ending !== null}
        onOpenChange={(o) => !o && setEnding(null)}
        title="Résilier ce contrat ?"
        description="Le contrat prend fin aujourd'hui, le bien redevient libre et les loyers futurs non payés sont supprimés."
        confirmLabel="Résilier"
        destructive
        loading={action.isPending}
        onConfirm={() => ending && action.mutate({ id: ending.id, action: 'resilier' }, { onSuccess: () => { setEnding(null); toast.success('Contrat résilié.') } })}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Supprimer ce contrat ?"
        description="Les paiements associés seront également supprimés."
        confirmLabel="Supprimer"
        destructive
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id, { onSuccess: () => setDeleting(null), onError: notifyError })}
      />
    </>
  )
}
