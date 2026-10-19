import type { UseQueryResult } from '@tanstack/react-query'
import type { ReactNode } from 'react'

import { EmptyState, ErrorState, Pagination, TableSkeleton } from '@/components/common'
import { Card } from '@/components/ui/card'
import type { Paginated } from '@/lib/types'
import { cn } from '@/lib/utils'

export const PAGE_SIZE = 20

interface ListShellProps<T> {
  query: UseQueryResult<Paginated<T>>
  page: number
  onPage: (page: number) => void
  emptyTitle: string
  emptyDescription?: string
  emptyAction?: ReactNode
  toolbar?: ReactNode
  cols?: number
  children: (rows: T[]) => ReactNode
}

/** Carte de liste : barre d'outils, états chargement/erreur/vide, tableau et pagination. */
export function ListShell<T>({
  query,
  page,
  onPage,
  emptyTitle,
  emptyDescription,
  emptyAction,
  toolbar,
  cols = 5,
  children,
}: ListShellProps<T>) {
  const { data, isPending, isError, error, refetch, isPlaceholderData } = query
  return (
    <Card className="overflow-hidden">
      {toolbar && <div className="flex flex-wrap items-center gap-2 border-b p-3">{toolbar}</div>}
      {isPending ? (
        <TableSkeleton cols={cols} />
      ) : isError ? (
        <ErrorState message={error instanceof Error ? error.message : 'Chargement impossible.'} onRetry={() => void refetch()} />
      ) : data.results.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />
      ) : (
        <div className={cn('transition-opacity', isPlaceholderData && 'opacity-60')}>
          {children(data.results)}
          <Pagination page={page} count={data.count} pageSize={PAGE_SIZE} onChange={onPage} />
        </div>
      )}
    </Card>
  )
}
