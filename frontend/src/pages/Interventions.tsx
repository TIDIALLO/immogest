import { Pencil, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { EmptyState, ErrorState, PageHeader, StatusBadge } from '@/components/common'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { FormDialog, type FieldDef } from '@/components/FormDialog'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { PRIORITE, PRIORITES } from '@/lib/labels'
import { notifyError, useDelete, useList, useSave } from '@/lib/queries'
import type { Bien, Intervention, InterventionStatut } from '@/lib/types'
import { cn, formatDate, formatFCFA } from '@/lib/utils'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Paginated } from '@/lib/types'

const COLONNES: { statut: InterventionStatut; titre: string }[] = [
  { statut: 'ouverte', titre: 'Ouvertes' },
  { statut: 'en_cours', titre: 'En cours' },
  { statut: 'terminee', titre: 'Terminées' },
  { statut: 'annulee', titre: 'Annulées' },
]

const POIDS: Record<string, number> = { urgente: 4, haute: 3, normale: 2, basse: 1 }

/** Tableau Kanban : glisser une carte d'une colonne à l'autre change son statut (mise à jour instantanée). */
export default function Interventions() {
  const qc = useQueryClient()
  const query = useList<Intervention>('/interventions', { page_size: 200, ordering: '-poids' })
  const biens = useList<Bien>('/biens', { page_size: 200 })
  const save = useSave<Intervention>('/interventions')
  const remove = useDelete('/interventions')
  const [editing, setEditing] = useState<Intervention | 'new' | null>(null)
  const [deleting, setDeleting] = useState<Intervention | null>(null)
  const [over, setOver] = useState<InterventionStatut | null>(null)

  const changeStatut = useMutation({
    mutationFn: ({ id, statut }: { id: number; statut: InterventionStatut }) => api.patch<Intervention>(`/interventions/${id}/`, { statut }),
    onMutate: async ({ id, statut }) => {
      await qc.cancelQueries({ queryKey: ['/interventions'] })
      const snapshots = qc.getQueriesData<Paginated<Intervention>>({ queryKey: ['/interventions', 'list'] })
      qc.setQueriesData<Paginated<Intervention>>({ queryKey: ['/interventions', 'list'] }, (old) =>
        old ? { ...old, results: old.results.map((i) => (i.id === id ? { ...i, statut } : i)) } : old,
      )
      return { snapshots }
    },
    onError: (e, _v, ctx) => { ctx?.snapshots.forEach(([k, d]) => qc.setQueryData<Paginated<Intervention> | undefined>(k, d)); notifyError(e) },
    onSettled: () => { void qc.invalidateQueries({ queryKey: ['/interventions'] }); void qc.invalidateQueries({ queryKey: ['/dashboard'] }) },
  })

  const fields: FieldDef[] = useMemo(() => [
    { name: 'bien', label: 'Bien', type: 'select', required: true, full: true, options: (biens.data?.results ?? []).map((b) => ({ value: b.id, label: `${b.nom} — ${b.ville}` })) },
    { name: 'titre', label: 'Titre', required: true, full: true },
    { name: 'description', label: 'Description', type: 'textarea', required: true },
    { name: 'priorite', label: 'Priorité', type: 'select', required: true, options: PRIORITES },
    { name: 'statut', label: 'Statut', type: 'select', required: true, options: COLONNES.map((c) => ({ value: c.statut, label: c.titre })) },
    { name: 'prestataire', label: 'Prestataire' },
    { name: 'cout', label: 'Coût (FCFA)', type: 'number', nullable: true },
    { name: 'date_intervention', label: "Date d'intervention", type: 'date', nullable: true },
    { name: 'date_resolution', label: 'Date de résolution', type: 'date', nullable: true },
  ], [biens.data])

  const rows = [...(query.data?.results ?? [])].sort((a, b) => POIDS[b.priorite] - POIDS[a.priorite])

  return (
    <>
      <PageHeader title="Interventions" description="Glissez les cartes pour changer leur statut." actions={<Button onClick={() => setEditing('new')}><Plus /> Nouvelle intervention</Button>} />
      {query.isError ? <ErrorState message="Chargement impossible." onRetry={() => void query.refetch()} /> : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {COLONNES.map((col) => {
            const items = rows.filter((i) => i.statut === col.statut)
            return (
              <div
                key={col.statut}
                onDragOver={(e) => { e.preventDefault(); setOver(col.statut) }}
                onDragLeave={() => setOver((o) => (o === col.statut ? null : o))}
                onDrop={(e) => {
                  e.preventDefault()
                  setOver(null)
                  const id = Number(e.dataTransfer.getData('text/plain'))
                  const inter = rows.find((i) => i.id === id)
                  if (inter && inter.statut !== col.statut) changeStatut.mutate({ id, statut: col.statut })
                }}
                className={cn('min-h-40 rounded-lg border bg-muted/40 p-3 transition-colors', over === col.statut && 'border-primary bg-accent/60')}
                aria-label={`Colonne ${col.titre}`}
              >
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-semibold">{col.titre}</h2>
                  <span className="rounded-full bg-card px-2 text-xs text-muted-foreground">{items.length}</span>
                </div>
                <div className="space-y-2">
                  {query.isPending && <Skeleton className="h-24" />}
                  {items.map((i) => (
                    <Card
                      key={i.id}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData('text/plain', String(i.id))}
                      className="cursor-grab space-y-2 p-3 active:cursor-grabbing"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <p className="text-sm font-medium leading-snug">{i.titre}</p>
                        <StatusBadge map={PRIORITE} value={i.priorite} />
                      </div>
                      <p className="text-xs text-muted-foreground">{i.bien_nom} · {formatDate(i.date_signalement)}</p>
                      {i.signale_par_nom && <p className="text-xs text-muted-foreground">Signalé par {i.signale_par_nom}</p>}
                      {i.cout && <p className="text-xs tabular-nums">{formatFCFA(i.cout)}</p>}
                      <div className="flex justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" aria-label="Modifier" onClick={() => setEditing(i)}><Pencil /></Button>
                        <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" aria-label="Supprimer" onClick={() => setDeleting(i)}><Trash2 /></Button>
                      </div>
                    </Card>
                  ))}
                  {!query.isPending && items.length === 0 && <EmptyState title="Vide" />}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <FormDialog
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title={editing === 'new' ? 'Nouvelle intervention' : "Modifier l'intervention"}
        fields={fields}
        defaultValues={editing && editing !== 'new' ? { ...editing } : { priorite: 'normale', statut: 'ouverte' }}
        onSubmit={async (payload) => {
          await save.mutateAsync({ id: editing && editing !== 'new' ? editing.id : undefined, data: payload })
          toast.success(editing === 'new' ? 'Intervention créée.' : 'Intervention modifiée.')
        }}
      />
      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(o) => !o && setDeleting(null)}
        title="Supprimer cette intervention ?"
        description={`« ${deleting?.titre ?? ''} » sera définitivement supprimée.`}
        confirmLabel="Supprimer"
        destructive
        loading={remove.isPending}
        onConfirm={() => deleting && remove.mutate(deleting.id, { onSuccess: () => setDeleting(null) })}
      />
    </>
  )
}
