import { useRouter } from "next/router";
import Link from "next/link";
export default function Cancel() {
  const router = useRouter();
  const { order_id } = router.query || {};
  return (
    <div style={{ padding: 24 }}>
      <h2>Payment Canceled</h2>
      <p>Order {order_id || ""} was canceled.</p>
      <p>
        <Link href="/listings">Back to Listings</Link>
      </p>
    </div>
  );
}
