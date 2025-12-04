import { useRouter } from "next/router";
import Link from "next/link";
export default function Success() {
  const router = useRouter();
  const { order_id } = router.query || {};
  return (
    <div style={{ padding: 24 }}>
      <h2>Payment Successful</h2>
      <p>Order {order_id || ""} completed.</p>
      <p>
        <Link href="/tokens">View Tokens</Link>
      </p>
      <p>
        <Link href="/listings">Back to Listings</Link>
      </p>
    </div>
  );
}
