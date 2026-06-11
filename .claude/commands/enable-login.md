Re-enable the parked Supabase magic-link login feature.

This feature was built and parked on 2026-06-11. Before re-enabling, confirm all other features are stable.

## What to restore in src/App.jsx

### 1. Replace the boot useEffect

```jsx
useEffect(() => {
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (session?.user) {
      setUser(session.user)
      db.getFamilies().then(f => { setFamilies(f); setScreen('home') })
    } else {
      setScreen('login')
    }
  })

  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session?.user) {
      setUser(session.user)
      db.getFamilies().then(f => { setFamilies(f); setScreen('home') })
    } else if (event === 'SIGNED_OUT') {
      setUser(null)
      setFamilies([])
      setFam(null)
      setScreen('login')
    }
  })

  return () => subscription.unsubscribe()
}, [])
```

### 2. Add `user` state

```jsx
const [user, setUser] = useState(null)
```

### 3. Add login screen render (before the home branch)

```jsx
if (screen === 'login') return <LoginScreen />
```

### 4. Pass `user` to HomeScreen

```jsx
<HomeScreen families={families} onCreate={createFamily} onSelect={openFamily} user={user} />
```

### 5. Add sign-out to HomeScreen subtitle area

```jsx
{user && (
  <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
    <span style={{ fontSize: 11, color: '#bbb' }}>{user.email}</span>
    <button className="btn btn-grey btn-sm" onClick={() => supabase.auth.signOut()}>Sign out</button>
  </div>
)}
```

### 6. Add sign-out to family screen header tabs

```jsx
<button className="header-tab" onClick={() => supabase.auth.signOut()} title="Sign out">↪</button>
```

### 7. Add LoginScreen component

```jsx
function LoginScreen() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async () => {
    if (!email.trim()) return
    setLoading(true)
    setError('')
    const { error: err } = await supabase.auth.signInWithOtp({ email: email.trim() })
    setLoading(false)
    if (err) { setError(err.message); return }
    setSent(true)
  }

  if (sent) {
    return (
      <div className="home">
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <div className="home-title">Kula Vruksham</div>
          <div className="home-sub">Your family, mapped.</div>
        </div>
        <div className="card" style={{ cursor: 'default', textAlign: 'center', padding: 32 }}>
          <div style={{ fontSize: 32, marginBottom: 16 }}>📧</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>Check your email</div>
          <div style={{ fontSize: 13, color: '#666', lineHeight: 1.6 }}>
            We sent a magic link to <strong>{email}</strong>.<br />
            Click it to sign in — no password needed.
          </div>
          <button className="btn btn-grey" style={{ marginTop: 20 }} onClick={() => setSent(false)}>Use a different email</button>
        </div>
      </div>
    )
  }

  return (
    <div className="home">
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div className="home-title">Kula Vruksham</div>
        <div className="home-sub">Your family, mapped.</div>
      </div>
      <div className="card" style={{ cursor: 'default', padding: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 600, marginBottom: 4 }}>Sign in to continue</div>
        <div style={{ fontSize: 12, color: '#999', marginBottom: 16 }}>We'll email you a magic link — no password needed</div>
        <input
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && handleLogin()}
          style={{ marginBottom: 10 }}
        />
        {error && <div style={{ fontSize: 12, color: '#C97B5D', marginBottom: 8 }}>{error}</div>}
        <button className="btn btn-dark" style={{ width: '100%' }} onClick={handleLogin} disabled={loading}>
          {loading ? 'Sending…' : 'Send magic link →'}
        </button>
      </div>
    </div>
  )
}
```

## Supabase side

- Auth → Providers → Email: enable
- Auth → URL Configuration → Site URL: set to production domain
- Auth → URL Configuration → Redirect URLs: add `http://localhost:5173` for local dev
