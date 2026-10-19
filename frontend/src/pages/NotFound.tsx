import { Link } from 'react-router-dom'

import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="text-6xl font-bold text-primary">404</p>
      <p className="text-muted-foreground">Cette page n&apos;existe pas.</p>
      <Button asChild>
        <Link to="/">Retour à l&apos;accueil</Link>
      </Button>
    </div>
  )
}
