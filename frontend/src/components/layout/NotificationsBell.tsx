import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Bell } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { api } from '@/lib/api'
import { useList } from '@/lib/queries'
import type { AppNotification } from '@/lib/types'

const POLL_MS = 30_000

/** Cloche de notifications : interrogation toutes les 30 s (et au retour sur l'onglet) pour un rendu quasi temps réel. */
export function NotificationsBell() {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { data } = useList<AppNotification>('/notifications', { page_size: 8 }, POLL_MS)
  const items = data?.results ?? []
  const unread = items.filter((n) => !n.lue).length

  const readAll = useMutation({
    mutationFn: () => api.post('/notifications/tout-lire/'),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['/notifications'] }),
  })
  const readOne = useMutation({
    mutationFn: (id: number) => api.post(`/notifications/${id}/lue/`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['/notifications'] }),
  })

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" aria-label={`Notifications (${unread} non lues)`}>
          <Bell />
          {unread > 0 && (
            <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold text-destructive-foreground">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="flex items-center justify-between pr-2">
          <DropdownMenuLabel>Notifications</DropdownMenuLabel>
          {unread > 0 && (
            <button className="text-xs text-primary hover:underline" onClick={() => readAll.mutate()}>
              Tout marquer comme lu
            </button>
          )}
        </div>
        <DropdownMenuSeparator />
        {items.length === 0 && <p className="px-3 py-6 text-center text-sm text-muted-foreground">Rien de nouveau.</p>}
        {items.map((n) => (
          <DropdownMenuItem
            key={n.id}
            className="flex-col items-start gap-0.5"
            onSelect={() => {
              if (!n.lue) readOne.mutate(n.id)
              if (n.lien) navigate(n.lien)
            }}
          >
            <span className={n.lue ? 'text-sm' : 'text-sm font-semibold'}>{n.titre}</span>
            {n.message && <span className="line-clamp-2 text-xs text-muted-foreground">{n.message}</span>}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
