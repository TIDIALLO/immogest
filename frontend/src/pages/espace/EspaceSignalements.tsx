import { Plus } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { PageHeader, StatusBadge } from '@/components/common'
import { FormDialog, type FieldDef } from '@/components/FormDialog'
import { ListShell } from '@/components/ListShell'
import { Button } from '@/components/ui/button'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { PRIORITE, PRIORITES, STATUT_INTERVENTION } from '@/lib/labels'
import { useList, useSave } from '@/lib/queries'
import type { Intervention } from '@/lib/types'
import { formatDate } from '@/lib/utils'

const FIELDS: FieldDef[] = [
  { name: 'titre', label: 'Titre', required: true, full: true, placeholder: 'Ex : Fuite sous l’évier' },
  { name: 'description', label: 'Décrivez le problème', type: 'textarea', required: true },
  { name: 'priorite', label: 'Urgence', type: 'select', required: true, options: PRIORITES, full: true },
]

export default function EspaceSignalements() {
  const [page, setPage] = useState(1)
  const [open, setOpen] = useState(false)
  const query = useList<Intervention>('/espace/interventions', { page })
  const save = useSave<Intervention>('/espace/interventions')

  return (
    <>
      <PageHeader title="Mes signalements" description="Signalez un problème dans votre logement." actions={<Button onClick={() => setOpen(true)}><Plus /> Signaler un problème</Button>} />
      <ListShell query={query} page={page} onPage={setPage} emptyTitle="Aucun signalement" emptyDescription="Tout va bien ? Parfait. Sinon, signalez-nous un problème." cols={4}>
        {(rows) => (
          <Table>
            <TableHeader><TableRow><TableHead>Problème</TableHead><TableHead>Date</TableHead><TableHead>Urgence</TableHead><TableHead>Statut</TableHead></TableRow></TableHeader>
            <TableBody>
              {rows.map((i) => (
                <TableRow key={i.id}>
                  <TableCell className="font-medium">{i.titre}<p className="line-clamp-1 text-xs font-normal text-muted-foreground">{i.description}</p></TableCell>
                  <TableCell className="text-muted-foreground">{formatDate(i.date_signalement)}</TableCell>
                  <TableCell><StatusBadge map={PRIORITE} value={i.priorite} /></TableCell>
                  <TableCell><StatusBadge map={STATUT_INTERVENTION} value={i.statut} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </ListShell>
      <FormDialog
        open={open}
        onOpenChange={setOpen}
        title="Signaler un problème"
        description="Votre bailleur sera prévenu immédiatement."
        fields={FIELDS}
        defaultValues={{ priorite: 'normale' }}
        submitLabel="Envoyer"
        onSubmit={async (payload) => {
          await save.mutateAsync({ data: payload })
          toast.success('Signalement transmis à votre bailleur.')
        }}
      />
    </>
  )
}
