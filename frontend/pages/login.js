import { useState } from "react";
export default function Login({ setSessionToken }) {
  const [email, setEmail] = useState("");
  const [provider, setProvider] = useState("email");
  const backend = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";
  const submit = async (e) => {
    e.preventDefault();
    const r = await fetch(`${backend}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, oauth_provider: provider }),
    });
    const j = await r.json();
    if (j.session_token) {
      window.localStorage.setItem("session_token", j.session_token);
      setSessionToken(j.session_token);
    }
  };
  return (
    <div style={{ padding: 24 }}>
      <h2>Login</h2>
      <form onSubmit={submit}>
        <input placeholder="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <select value={provider} onChange={(e) => setProvider(e.target.value)}>
          <option value="email">Email</option>
          <option value="google">Google</option>
          <option value="github">GitHub</option>
        </select>
        <button type="submit">Login</button>
      </form>
    </div>
  );
}
