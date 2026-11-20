"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";

export default function LoginPage() {
  const router = useRouter();
  const [mode,setMode] = useState<"signin"|"signup">("signin");
  const [name,setName] = useState("");
  const [email,setEmail] = useState("");
  const [password,setPassword] = useState("");
  const [busy,setBusy] = useState(false);
  const [error,setError] = useState("");
  const [message,setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      const result = mode === "signup"
        ? await authClient.signUp.email({ name:name.trim(), email:email.trim(), password })
        : await authClient.signIn.email({ email:email.trim(), password });
      if (result.error) throw new Error(result.error.message || "Unable to authenticate.");
      if (mode === "signup") setMessage("Account created. Check your email if verification is required, then sign in.");
      else { router.replace("/"); router.refresh(); }
    } catch (e) { setError(e instanceof Error ? e.message : "Authentication failed."); }
    finally { setBusy(false); }
  }

  return <main className="auth-screen"><section className="auth-panel">
    <a className="brand" href="/">◈ StorePilot</a>
    <div className="eyebrow">STORE OPERATIONS, SIMPLIFIED</div>
    <h1>{mode === "signin" ? "Welcome back" : "Create your workspace"}</h1>
    <p>Manage stock, sales and daily operations from one clear workspace.</p>
    <form onSubmit={submit}>
      <div className="auth-switch"><button type="button" className={mode==="signin"?"active":""} onClick={()=>setMode("signin")}>Sign in</button><button type="button" className={mode==="signup"?"active":""} onClick={()=>setMode("signup")}>Create account</button></div>
      {mode==="signup" && <label>Full name<input required minLength={2} maxLength={80} value={name} onChange={e=>setName(e.target.value)} autoComplete="name" placeholder="Your name"/></label>}
      <label>Email<input type="email" required value={email} onChange={e=>setEmail(e.target.value)} autoComplete="email" placeholder="you@company.com"/></label>
      <label>Password<input type="password" required minLength={8} value={password} onChange={e=>setPassword(e.target.value)} autoComplete={mode==="signup"?"new-password":"current-password"} placeholder="At least 8 characters"/></label>
      <button className="primary full" disabled={busy}>{busy?"Please wait…":mode==="signup"?"Create account":"Sign in"}</button>
      {error && <p className="error" role="alert">{error}</p>}{message && <p className="success" role="status">{message}</p>}
    </form>
    <small>Secure account access powered by Neon Auth.</small>
  </section></main>;
}
