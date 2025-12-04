import { useState } from "react";
export default function Sell({ sessionToken }) {
  const [service_name, setServiceName] = useState("");
  const [api_key, setApiKey] = useState("");
  const [price_per_unit, setPrice] = useState("");
  const [unit_description, setUnit] = useState("");
  const [available_units, setAvail] = useState("");
  const [endpoint_url, setEndpointUrl] = useState("");
  const backend = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";
  const submit = async (e) => {
    e.preventDefault();
    const r = await fetch(`${backend}/listings`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
      body: JSON.stringify({ service_name, api_key, price_per_unit, unit_description, available_units, endpoint_url })
    });
    await r.json();
  };
  return (
    <div style={{ padding: 24 }}>
      <h2>Create Listing</h2>
      <form onSubmit={submit}>
        <input placeholder="service name" value={service_name} onChange={(e) => setServiceName(e.target.value)} />
        <input placeholder="api key" value={api_key} onChange={(e) => setApiKey(e.target.value)} />
        <input placeholder="endpoint url (optional)" value={endpoint_url} onChange={(e) => setEndpointUrl(e.target.value)} />
        <input placeholder="price per unit" value={price_per_unit} onChange={(e) => setPrice(e.target.value)} />
        <input placeholder="unit description" value={unit_description} onChange={(e) => setUnit(e.target.value)} />
        <input placeholder="available units" value={available_units} onChange={(e) => setAvail(e.target.value)} />
        <button type="submit">Create</button>
      </form>
    </div>
  );
}
