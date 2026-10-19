import { MoreHorizontal, Pencil, Plus, Search, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { PageHeader, StatusBadge } from '@/components/common'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { FormDialog, type FieldDef } from '@/components/FormDialog'
import { ListShell } from '@/components/ListShell'
import { Button } from '@/components/ui/button'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Input, Select } from '@/components/ui/input'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { useDebounce } from '@/hooks/useDebounce'
import { STATUT_BIEN, STATUTS_BIEN, TYPES_BIEN } from '@/lib/labels'
import { notifyError, useDelete, useList, useSave } from '@/lib/queries'
import type { Bien } from '@/lib/types'
import { formatFCFA } from '@/lib/utils'

export const BIEN_FIELDS: FieldDef[] = [
  { name: 'nom', label: 'Nom du bien', required: true, full: true },
  { name: 'type_bien', label: 'Type', type: 'select', options: TYPES_BIEN, required: true },
  { name: 'statut', label: 'Statut', type: 'select', options: STATUTS_BIEN, required: true },
  { name: 'adresse', label: 'Adresse', required: true, full: true },
  { name: 'ville', label: 'Ville', required: true },
  { name: 'code_postal', label: 'Code postal', required: true },
  { name: 'surface', label: 'Surface (m²)', type: 'number', required: true },
  { name: 'nb_pieces', label: 'Nombre de pièces', type: 'number', required: true },
  { name: 'etage', label: 'Étage', type: 'number', nullable: true },
  { name: 'loyer_charges', label: 'Loyer charges comprises (FCFA)', type: 'number', required: true },
  { name: 'prix_nuit', label: 'Tarif par nuit (FCFA)', type: 'number', nullable: true, hint: 'Pour les réservations du site public.' },
  { name: 'depot_garantie', label: 'Dépôt de garantie (FCFA)', type: 'number' },
  { name: 'photo', label: 'Photo', type: 'file', full: true },
  { name: 'description', label: 'Description', type: 'textarea' },
]

export const BIEN_DEFAULTS = { type_bien: 'appartement', statut: 'libre', nb_pieces: 1, depot_garantie: 0 }

export default function Biens() {
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [statut, setStatut] = useState('')
  const q = useDebounce(search)
  const query = useList<Bien>('/biens', { page, search: q, statut })
  const save = useSave<Bien>('/biens')
  const remove = useDelete('/biens')
  const [editing, setEditing] = useState<Bien | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Bien | null>(null)

  return (
    <>
      <PageHeader
        title="Biens"
        description="Appartements, maisons, studios, commerces…"
        actions={<Button onClick={() => setEditing('new')}><Plus /> Ajouter un bien</Button>}
      />
      <ListShell
        query={query}
        page={page}
        onPage={setPage}
        cols={6}
        emptyTitle="Aucun bien"
        emptyDescription="Ajoutez votre premier bien pour commencer."
        emptyAction={<Button onClick={() => setEditing('new')}><Plus /> Ajouter un bien</Button>}
        toolbar={
          <>
            <div className="relative min-w-52 flex-1">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" placeholder="Rechercher (nom, adresse, ville)…" value={search} onChange={(e) => { setSearch(e.target.value); setPage(1) }} aria-label="Rechercher un bien" />
            </div>
            <Select className="w-44" value={statut} onChange={(e) => { setStatut(e.target.value); setPage(1) }} aria-label="Filtrer par statut">
              <option value="">Tous les statuts</option>
              {STATUTS_BIEN.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
            </Select>
          </>
        }
      >
        {(rows) => (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bien</TableHead><TableHead>Ville</TableHead><TableHead>Type</TableHead>
                <TableHead>Loyer</TableHead><TableHead>Statut</TableHead><TableHead>Locataire</TableHead><TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((b) => (
                <TableRow key={b.id}>
                  <TableCell>
                    <Link to={`/biens/${b.id}`} className="flex items-center gap-3 font-medium hover:underline">
                      {b.photo ? <img src={b.photo} alt="" loading="lazy" className="h-10 w-10 rounded-md object-cover" /> : <div className="h-10 w-10 rounded-md bg-muted" />}
                      {b.nom}
                    </Link>
                  </TableCell>
                  <TableCell>{b.ville}</TableCell>
                  <TableCell>{b.type_display}</TableCell>
                  <TableCell className="tabular-nums">{formatFCFA(b.loyer_charges)}</TableCell>
                  <TableCell><StatusBadge map={STATUT_BIEN} value={b.statut} /></TableCell>
                  <TableCell>{b.locataire_actuel ? <Link className="hover:underline" to={`/locataires/${b.locataire_actuel.id}`}>{b.locataire_actuel.nom}</Link> : <span className="text-muted-foreground">—</span>}</TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button variant="ghost" size="icon" aria-label={`Actions pour ${b.nom}`}><MoreHorizontal /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onSelect={() => setEditing(b)}><Pencil /> Modifier</DropdownMenuItem>
                        <DropdownMenuItem destructive onSelect={() => setDeleting(b)}><Trash2 /> Supprimer</DropdownMenuItem>
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
        title={editing === 'new' ? 'Ajouter un bien' : 'Modifier le bien'}
        fields={BIEN_FIELDS}
        defaultValues={editing && editing !== 'new' ? { ...editing, photo: undefined } : BIEN_DEFAULTS}
        onSubmit={async (payload) => {
          await save.mutateAsync({ id: editing && editing !== 'new' ? editing.id : undefined, data: payload })
          toast.success(editing === 'new' ? 'Bien ajouté.' : 'Bien modifié.')
        }}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Supprimer ce bien ?"
        description={`« ${deleting?.nom ?? ''} » et ses contrats, paiements et interventions seront définitivement supprimés.`}
        confirmLabel="Supprimer"
        destructive
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id, { onSuccess: () => setDeleting(null), onError: notifyError })}
      />
    </>
  )
}
