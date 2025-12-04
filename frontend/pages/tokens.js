import { useEffect, useState } from "react";
export default function Tokens({ sessionToken }) {
  const [tokens, setTokens] = useState([]);
  const backend = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";
  useEffect(() => {
    if (!sessionToken) return;
    fetch(`${backend}/tokens`, { headers: { Authorization: `Bearer ${sessionToken}` } })
      .then((r) => r.json())
      .then(setTokens);
  }, [sessionToken]);
  return (
    <div style={{ padding: 24 }}>
      <h2>My Tokens</h2>
      <ul>
        {tokens.map((t) => (
          <li key={t.token_id}>{t.service_name} {t.api_key} expires {new Date(t.expires_at).toLocaleString()}</li>
        ))}
      </ul>
    </div>
  );
}
