import Link from "next/link";
export default function Home() {
  return (
    <div style={{ padding: 24 }}>
      <h1>Unified Data Marketplace</h1>
      <ul>
        <li><Link href="/login">Login</Link></li>
        <li><Link href="/listings">Browse Listings</Link></li>
        <li><Link href="/sell">Create Listing</Link></li>
        <li><Link href="/tokens">My Tokens</Link></li>
      </ul>
    </div>
  );
}
