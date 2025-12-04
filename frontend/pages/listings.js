import { useEffect, useState } from "react";
export default function Listings({ sessionToken }) {
  const [listings, setListings] = useState([]);
  const [units, setUnits] = useState(1);
  const backend = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";
  useEffect(() => {
    fetch(`${backend}/listings`).then((r) => r.json()).then(setListings);
  }, []);
  const order = async (id) => {
    const r = await fetch(`${backend}/orders`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionToken}` },
      body: JSON.stringify({ listing_id: id, units_requested: units }),
    });
    const j = await r.json();
    if (j.payment_requires_confirmation && j.payment_url) {
      window.open(j.payment_url, "_blank");
    } else {
      window.location.assign("/tokens");
    }
  };
  return (
    <div style={{ padding: 24 }}>
      <h2>Listings</h2>
      <label>Units </label>
      <input type="number" min={1} value={units} onChange={(e) => setUnits(parseInt(e.target.value))} />
      <ul>
        {listings.map((l) => (
          <li key={l.id}>
            {l.service_name} ${l.price_per_unit} {l.unit_description} available {l.available_units}
            <button onClick={() => order(l.id)}>Buy</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
