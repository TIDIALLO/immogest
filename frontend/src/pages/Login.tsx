import { Building2 } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useAuth } from '@/hooks/useAuth'
import { ApiError } from '@/lib/api'
import { api } from '@/lib/api'

export default function Login() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [forgot, setForgot] = useState(false)
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)

  if (user) return <Navigate to={user.role === 'locataire' ? '/espace' : '/'} replace />

  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setError('')
    try {
      const me = await login(username.trim(), password)
      navigate(me.role === 'locataire' ? '/espace' : '/', { replace: true })
    } catch (err) {
      setError(
        err instanceof ApiError && err.status === 429
          ? 'Trop de tentatives. Réessayez dans une minute.'
          : err instanceof Error
            ? err.message
            : 'Connexion impossible.',
      )
    } finally {
      setBusy(false)
    }
  }

  const sendReset = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    try {
      await api.post('/auth/password/reset/', { email })
      setSent(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Envoi impossible.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-primary/10 via-background to-background p-4">
      <Card className="w-full max-w-md animate-fade-in p-8">
        <div className="mb-6 flex flex-col items-center gap-2 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <Building2 />
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">ImmoGest</h1>
          <p className="text-sm text-muted-foreground">
            {forgot ? 'Recevez un lien pour choisir un nouveau mot de passe.' : 'Connectez-vous à votre espace.'}
          </p>
        </div>

        {forgot ? (
          sent ? (
            <p className="rounded-md bg-success/10 p-3 text-sm text-success" role="status">
              Si un compte correspond à cette adresse, un email vient d&apos;être envoyé.
            </p>
          ) : (
            <form onSubmit={sendReset} className="grid gap-4">
              <Input type="email" required placeholder="Votre adresse email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <Button type="submit" loading={busy}>Envoyer le lien</Button>
            </form>
          )
        ) : (
          <form onSubmit={submit} className="grid gap-4">
            <div className="grid gap-1.5">
              <label htmlFor="username" className="text-sm font-medium">Identifiant</label>
              <Input id="username" autoComplete="username" autoFocus required value={username} onChange={(e) => setUsername(e.target.value)} />
            </div>
            <div className="grid gap-1.5">
              <label htmlFor="password" className="text-sm font-medium">Mot de passe</label>
              <Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {error && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</p>}
            <Button type="submit" loading={busy}>Se connecter</Button>
          </form>
        )}

        <div className="mt-6 flex items-center justify-between text-sm">
          <button className="text-primary hover:underline" onClick={() => { setForgot(!forgot); setError(''); setSent(false) }}>
            {forgot ? 'Retour à la connexion' : 'Mot de passe oublié ?'}
          </button>
          <a href="/" className="text-muted-foreground hover:underline">Voir le site</a>
        </div>
      </Card>
    </div>
  )
}
