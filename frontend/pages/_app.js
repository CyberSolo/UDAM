import { useEffect, useState } from "react";
function App({ Component, pageProps }) {
  const [token, setToken] = useState(null);
  useEffect(() => {
    const t = window.localStorage.getItem("session_token");
    if (t) setToken(t);
  }, []);
  return <Component {...pageProps} sessionToken={token} setSessionToken={setToken} />;
}
export default App;
