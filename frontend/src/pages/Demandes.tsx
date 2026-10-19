import { CheckCircle2, Circle, Mail, Phone } from 'lucide-react'
import { useState } from 'react'

import { PageHeader } from '@/components/common'
import { ListShell } from '@/components/ListShell'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Select } from '@/components/ui/input'
import { useItemAction, useList } from '@/lib/queries'
import type { Demande } from '@/lib/types'
import { cn, formatDate } from '@/lib/utils'

export default function Demandes() {
  const [page, setPage] = useState(1)
  const [traite, setTraite] = useState('false')
  const query = useList<Demande>('/demandes', { page, traite })
  const action = useItemAction<Demande>('/demandes')

  return (
    <>
      <PageHeader title="Demandes clients" description="Messages reçus depuis le site public." />
      <ListShell
        query={query}
        page={page}
        onPage={setPage}
        emptyTitle={traite === 'false' ? 'Tout est traité 🎉' : 'Aucune demande'}
        toolbar={
          <Select className="w-44" value={traite} onChange={(e) => { setTraite(e.target.value); setPage(1) }} aria-label="Filtrer">
            <option value="false">À traiter</option>
            <option value="true">Traitées</option>
            <option value="">Toutes</option>
          </Select>
        }
      >
        {(rows) => (
          <div className="divide-y">
            {rows.map((d) => (
              <Card key={d.id} className={cn('flex flex-col gap-3 rounded-none border-0 p-4 shadow-none sm:flex-row sm:items-start', d.traite && 'opacity-60')}>
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{d.nom}</p>
                    {d.bien_nom ? <Badge tone="info">{d.bien_nom}</Badge> : <Badge tone="outline">Contact général</Badge>}
                    <span className="text-xs text-muted-foreground">{formatDate(d.created_at)}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{d.message}</p>
                  <div className="flex flex-wrap gap-4 pt-1 text-xs text-muted-foreground">
                    {d.telephone && <a className="flex items-center gap-1 hover:text-foreground" href={`tel:${d.telephone}`}><Phone className="h-3 w-3" />{d.telephone}</a>}
                    {d.email && <a className="flex items-center gap-1 hover:text-foreground" href={`mailto:${d.email}`}><Mail className="h-3 w-3" />{d.email}</a>}
                  </div>
                </div>
                <Button
                  variant={d.traite ? 'outline' : 'default'}
                  size="sm"
                  onClick={() => action.mutate({ id: d.id, action: 'basculer', optimistic: { traite: !d.traite } })}
                >
                  {d.traite ? <><Circle /> Rouvrir</> : <><CheckCircle2 /> Marquer traitée</>}
                </Button>
              </Card>
            ))}
          </div>
        )}
      </ListShell>
    </>
  )
}
