import { useEffect, useState } from "react";
export default function Listings({ sessionToken }) {
  const [listings, setListings] = useState([]);
  const [units, setUnits] = useState(1);
  const [dedup, setDedup] = useState(true);
  const [sort, setSort] = useState("weight");
  const backend = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";
  useEffect(() => {
    fetch(`${backend}/listings?dedup=${dedup ? 1 : 0}&sort=${sort}`)
      .then((r) => r.json())
      .then(setListings);
  }, [dedup, sort]);
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
      <div style={{ marginBottom: 12 }}>
        <a href="/dashboard">Dashboard</a>
      </div>
      <div style={{ marginBottom: 12 }}>
        <label style={{ marginRight: 8 }}>去重</label>
        <input type="checkbox" checked={dedup} onChange={(e) => setDedup(e.target.checked)} />
        <label style={{ marginLeft: 16, marginRight: 8 }}>排序</label>
        <select value={sort} onChange={(e) => setSort(e.target.value)}>
          <option value="weight">权重</option>
          <option value="rating">评分</option>
          <option value="price">价格</option>
        </select>
      </div>
      <label>Units </label>
      <input type="number" min={1} value={units} onChange={(e) => setUnits(parseInt(e.target.value))} />
      <ul>
        {listings.map((l) => (
          <li key={l.id}>
            {l.service_name} ${l.price_per_unit} {l.unit_description} available {l.available_units} {Number(l.price_per_unit)===0 ? 'FREE' : ''} {l.avg_score ? `(score ${Number(l.avg_score).toFixed(2)})` : ''} {typeof l.weight !== 'undefined' ? `(w ${Number(l.weight).toFixed(2)})` : ''} {l.endpoint_url ? <a href={l.endpoint_url} target="_blank" rel="noreferrer">source</a> : ''}
            <button onClick={() => order(l.id)}>{Number(l.price_per_unit)===0 ? 'Get' : 'Buy'}</button>
          </li>
        ))}
      </ul>
    </div>
  );
}
