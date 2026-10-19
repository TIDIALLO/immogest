import { KeyRound } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { ApiError, api } from '@/lib/api'

export default function SetPassword({ mode }: { mode: 'activation' | 'reinitialisation' }) {
  const { uid = '', token = '' } = useParams()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (password !== confirm) {
      setError('Les deux mots de passe ne correspondent pas.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await api.post('/auth/password/confirm/', { uid, token, password })
      setDone(true)
    } catch (err) {
      if (err instanceof ApiError) setError(Object.values(err.fieldErrors()).join(' ') || err.message)
      else setError('Une erreur est survenue.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/10 via-background to-background p-4">
      <Card className="w-full max-w-md animate-fade-in p-8">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <KeyRound />
          </div>
          <h1 className="text-xl font-semibold">
            {mode === 'activation' ? 'Activez votre espace locataire' : 'Nouveau mot de passe'}
          </h1>
          <p className="text-sm text-muted-foreground">Choisissez un mot de passe d&apos;au moins 8 caractères.</p>
        </div>
        {done ? (
          <div className="grid gap-4 text-center">
            <p role="status" className="rounded-md bg-success/10 p-3 text-sm text-success">Mot de passe enregistré.</p>
            <Button asChild><Link to="/connexion">Se connecter</Link></Button>
          </div>
        ) : (
          <form onSubmit={submit} className="grid gap-4">
            <Input type="password" autoComplete="new-password" required placeholder="Nouveau mot de passe" value={password} onChange={(e) => setPassword(e.target.value)} />
            <Input type="password" autoComplete="new-password" required placeholder="Confirmer le mot de passe" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            {error && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
            <Button type="submit" loading={busy}>Enregistrer</Button>
          </form>
        )}
      </Card>
    </div>
  )
}
