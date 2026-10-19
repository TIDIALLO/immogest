import { useState, type FormEvent } from 'react'
import { toast } from 'sonner'

import { PageHeader } from '@/components/common'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ApiError, api } from '@/lib/api'

export default function EspaceSecurite() {
  const [ancien, setAncien] = useState('')
  const [nouveau, setNouveau] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setErrors({})
    try {
      await api.post('/auth/password/change/', { ancien, nouveau })
      toast.success('Mot de passe mis à jour.')
      setAncien('')
      setNouveau('')
    } catch (err) {
      if (err instanceof ApiError) setErrors(err.fieldErrors())
      else toast.error('Une erreur est survenue.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <PageHeader title="Mot de passe" description="Changez votre mot de passe de connexion." />
      <Card className="max-w-md p-6">
        <form onSubmit={submit} className="grid gap-4">
          <div className="grid gap-1.5">
            <label htmlFor="ancien" className="text-sm font-medium">Mot de passe actuel</label>
            <Input id="ancien" type="password" autoComplete="current-password" required value={ancien} onChange={(e) => setAncien(e.target.value)} aria-invalid={!!errors.ancien} />
            {errors.ancien && <p role="alert" className="text-xs text-destructive">{errors.ancien}</p>}
          </div>
          <div className="grid gap-1.5">
            <label htmlFor="nouveau" className="text-sm font-medium">Nouveau mot de passe</label>
            <Input id="nouveau" type="password" autoComplete="new-password" required value={nouveau} onChange={(e) => setNouveau(e.target.value)} aria-invalid={!!errors.nouveau} />
            {errors.nouveau && <p role="alert" className="text-xs text-destructive">{errors.nouveau}</p>}
          </div>
          <Button type="submit" loading={busy}>Mettre à jour</Button>
        </form>
      </Card>
    </>
  )
}
