import { UdamClient } from '../sdk/js/index.js'
const base = process.env.BASE_URL || 'http://localhost:4000'
const buyer = new UdamClient(base)
const seller = new UdamClient(base)
const rb = await buyer.login('buyer@test.local')
const rs = await seller.login('seller@test.local')
const listing = await seller.createListing({ service_name: 'SDK Test API', api_key: 'APIKEY-SDK', price_per_unit: '1.00', unit_description: 'request', available_units: 100 })
const order = await buyer.createOrder({ listing_id: listing.id, units: 1 })
await buyer.acceptOrder(order.order_id)
await buyer.reviewOrder(order.order_id, { score: 5, comment: 'ok' })
const ratings = await buyer.getUserRatings(rs.user_id)
console.log(JSON.stringify({ buyer_id: rb.user_id, seller_id: rs.user_id, listing_id: listing.id, order_id: order.order_id, ratings }, null, 2))
