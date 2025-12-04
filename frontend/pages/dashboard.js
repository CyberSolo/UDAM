import { useEffect, useState } from "react";
export default function Dashboard({ sessionToken }) {
  const [summary, setSummary] = useState(null);
  const [me, setMe] = useState(null);
  const [recentOrders, setRecentOrders] = useState([]);
  const [days, setDays] = useState(30);
  const backend = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:4000";
  if (!sessionToken) {
    return (
      <div style={{ padding: 24 }}>
        <h2>Dashboard</h2>
        <div>请先登录查看Dashboard</div>
      </div>
    );
  }
  useEffect(() => {
    const h = sessionToken ? { Authorization: `Bearer ${sessionToken}` } : {};
    fetch(`${backend}/dashboard/summary?days=${days}`, { headers: h }).then((r) => r.json()).then(setSummary);
    fetch(`${backend}/dashboard/me`, { headers: h }).then((r) => r.json()).then(setMe);
    fetch(`${backend}/dashboard/orders/recent?days=${days}&limit=20`, { headers: h }).then((r) => r.json()).then(setRecentOrders);
  }, [sessionToken, days]);
  return (
    <div style={{ padding: 24 }}>
      <h2>Dashboard</h2>
      <div style={{ marginBottom: 12 }}>
        <label style={{ marginRight: 8 }}>时间窗口</label>
        <select value={days} onChange={(e) => setDays(parseInt(e.target.value))}>
          <option value={7}>近7天</option>
          <option value={30}>近30天</option>
          <option value={90}>近90天</option>
        </select>
      </div>
      {!summary ? (
        <div>Loading...</div>
      ) : (
        <div>
          <div style={{ marginBottom: 16 }}>
            <h3>总体</h3>
            <div>GMV ${Number(summary.gmv).toFixed(2)}</div>
            <div>用户 {summary.totals.users} 列表 {summary.totals.listings} 活跃 {summary.totals.active_listings}</div>
            <div>订单 总计 {summary.totals.orders} 已付 {summary.totals.paid_orders} 待处理 {summary.totals.pending_orders}</div>
            <div>争议 {summary.totals.disputes} 已释放 {summary.totals.released} 已退款 {summary.totals.refunded}</div>
            <div style={{ marginTop: 8 }}>窗口({summary.window.days}天) 订单 {summary.window.orders} 已付 {summary.window.paid_orders} GMV ${Number(summary.window.gmv).toFixed(2)}</div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <h3>Agent统计</h3>
            <div>事件 {summary.agent_stats.total} 匹配 {summary.agent_stats.matched} 未匹配 {summary.agent_stats.unmatched} 下单 {summary.agent_stats.ordered} 失败 {summary.agent_stats.failed}</div>
            <div style={{ marginTop: 8 }}>热门查询</div>
            <ul>
              {(summary.top_queries || []).map((q) => (
                <li key={q.query}>{q.query} 次数 {q.c}</li>
              ))}
            </ul>
          </div>
          <div style={{ display: "flex", gap: 24 }}>
            <div style={{ flex: 1 }}>
              <h3>销售额榜单</h3>
              <ul>
                {summary.top_sellers.map((s) => (
                  <li key={`s-${s.user_id}`}>{s.email} ${Number(s.sales_amount).toFixed(2)} 订单 {s.orders_count}</li>
                ))}
              </ul>
            </div>
            <div style={{ flex: 1 }}>
              <h3>支出榜单</h3>
              <ul>
                {summary.top_buyers.map((b) => (
                  <li key={`b-${b.user_id}`}>{b.email} ${Number(b.spend_amount).toFixed(2)} 订单 {b.orders_count}</li>
                ))}
              </ul>
            </div>
          </div>
          <div style={{ marginTop: 16 }}>
            <h3>最近订单</h3>
            <ul>
              {recentOrders.map((o) => (
                <li key={o.id}>
                  {o.created_at} {o.buyer_email} → {o.seller_email} {o.service_name} ${Number(o.payment_amount).toFixed(2)} {o.payment_status} {o.escrow_status || ""} {o.dispute_status || ""}
                </li>
              ))}
            </ul>
          </div>
          <div style={{ marginTop: 16 }}>
            <h3>Agent事件</h3>
            <ul>
              {summary.recent_agent_events.map((e) => (
                <li key={e.id}>
                  {e.created_at} {e.agent_email || e.agent_id} {e.type} {e.status} {e.query ? `q=${e.query}` : ""} {e.listing_id ? `listing=${e.listing_id}` : ""} {e.error || ""}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
      {!me ? (
        <div></div>
      ) : (
        <div style={{ marginTop: 24 }}>
          <h3>我的账单</h3>
          <div>买家 支出 ${Number(me.buyer.paid_amount).toFixed(2)} 已付 {me.buyer.paid_count} 待处理 {me.buyer.pending_count}</div>
          <div>
            卖家 销售 ${Number(me.seller.paid_amount).toFixed(2)} 已付 {me.seller.paid_count} 在托管 ${Number(me.seller.held_amount).toFixed(2)}({me.seller.held_count}) 已释放 ${Number(me.seller.released_amount).toFixed(2)}({me.seller.released_count}) 已退款 ${Number(me.seller.refunded_amount).toFixed(2)}({me.seller.refunded_count})
          </div>
        </div>
      )}
    </div>
  );
}
