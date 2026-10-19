import { useQuery } from '@tanstack/react-query'
import { Download, Home, Wallet } from 'lucide-react'
import { Link } from 'react-router-dom'

import { EmptyState, ErrorState, PageHeader, StatCard, StatusBadge } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { api, downloadFile } from '@/lib/api'
import { PRIORITE, STATUT_INTERVENTION, STATUT_PAIEMENT } from '@/lib/labels'
import { notifyError } from '@/lib/queries'
import type { EspaceAccueil as Data } from '@/lib/types'
import { formatDate, formatFCFA, formatMois, toNumber } from '@/lib/utils'

export default function EspaceAccueil() {
  const { data, isPending, isError, refetch } = useQuery({ queryKey: ['/espace'], queryFn: () => api.get<Data>('/espace/') })
  if (isError) return <ErrorState message="Chargement impossible." onRetry={() => void refetch()} />
  if (isPending) return <Skeleton className="h-96" />
  const { locataire, contrat, bien, montant_du, paiements_recents, interventions } = data

  return (
    <>
      <PageHeader title={`Bonjour ${locataire.prenom}`} description="Votre contrat, vos loyers et vos demandes." />
      {!contrat ? (
        <Card><EmptyState title="Aucun contrat actif" description="Contactez votre bailleur si vous pensez qu'il s'agit d'une erreur." /></Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard label="Loyer mensuel" value={formatFCFA(contrat.loyer_total)} hint={`À payer le ${contrat.jour_paiement} de chaque mois`} icon={<Wallet className="h-5 w-5" />} />
            <StatCard label="Reste à payer" value={formatFCFA(montant_du)} tone={toNumber(montant_du) > 0 ? 'danger' : 'success'} icon={<Wallet className="h-5 w-5" />} />
            <StatCard label="Logement" value={bien?.nom ?? contrat.bien_nom} hint={bien ? `${bien.adresse}, ${bien.ville}` : undefined} icon={<Home className="h-5 w-5" />} />
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader><CardTitle>Derniers loyers</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {paiements_recents.map((p) => (
                  <div key={p.id} className="flex items-center justify-between gap-2 text-sm">
                    <span className="capitalize">{formatMois(p.mois)}</span>
                    <span className="tabular-nums">{formatFCFA(p.montant_paye)} / {formatFCFA(p.montant_du)}</span>
                    <StatusBadge map={STATUT_PAIEMENT} value={p.statut} />
                    {p.statut === 'paye' && (
                      <Button variant="ghost" size="icon" aria-label="Télécharger la quittance" onClick={() => downloadFile(`/espace/paiements/${p.id}/quittance/`, undefined, 'quittance.pdf').catch(notifyError)}><Download /></Button>
                    )}
                  </div>
                ))}
                <Button variant="link" asChild className="px-0"><Link to="/espace/paiements">Tout l&apos;historique</Link></Button>
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle>Mes signalements</CardTitle></CardHeader>
              <CardContent className="space-y-3">
                {interventions.length === 0 && <p className="text-sm text-muted-foreground">Aucun signalement.</p>}
                {interventions.map((i) => (
                  <div key={i.id} className="flex items-center justify-between gap-2 text-sm">
                    <div className="min-w-0"><p className="truncate font-medium">{i.titre}</p><p className="text-xs text-muted-foreground">{formatDate(i.date_signalement)}</p></div>
                    <StatusBadge map={PRIORITE} value={i.priorite} />
                    <StatusBadge map={STATUT_INTERVENTION} value={i.statut} />
                  </div>
                ))}
                <Button variant="link" asChild className="px-0"><Link to="/espace/signalements">Signaler un problème</Link></Button>
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </>
  )
}
