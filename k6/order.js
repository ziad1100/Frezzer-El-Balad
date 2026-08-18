// Checkout flow load test: register -> create order -> order history.
// Use with DISABLE_RATE_LIMIT=1 on the server, otherwise the auth limiter (20/15min)
// will 429 these requests.
// Run (image-only, no local k6 install):
//   docker run --rm -i -v "${PWD}/k6:/k6" grafana/k6 run /k6/order.js
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.BASE_URL || 'http://host.docker.internal:5000';
const API = `${BASE}/api/v1`;
const PASSWORD = __ENV.PASSWORD || 'Pizza123!';

export const options = {
  scenarios: {
    checkout: {
      executor: 'per-vu-iterations',
      vus: 5,
      iterations: 2,
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<1000', 'p(99)<2000'],
  },
};

export function setup() {
  const res = http.get(`${API}/products?page=1&limit=1`);
  const items = res.json('data.items') || [];
  return items[0] || null;
}

export default function (product) {
  if (!product) {
    console.log('no seeded products to order');
    return;
  }
  const email = `k6-${__VU}-${__ITER}-${Date.now()}@load.local`;
  // 11 digits starting with a valid Egyptian prefix (010/011/012/015).
  const prefix = ['0', '1', '2', '5'][Math.floor(Math.random() * 4)];
  const phone = `01${prefix}${String(Date.now()).slice(-8)}`;
  const qty = product.basePrice >= 100 ? 2 : Math.ceil(100 / (product.basePrice || 100));

  const reg = http.post(
    `${API}/auth/register`,
    JSON.stringify({ fullName: 'K6 Load', email, phone, password: PASSWORD }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  check(reg, { 'register 201': (r) => r.status === 201 });

  const token = reg.json('data.accessToken');
  const auth = { Authorization: `Bearer ${token}` };

  const order = http.post(
    `${API}/orders`,
    JSON.stringify({
      items: [{ product: product._id, qty }],
      address: { city: 'Cairo', street: 'Test St', building: '5' },
      phone,
      paymentMethod: 'cash',
    }),
    { headers: { ...auth, 'Content-Type': 'application/json' } },
  );
  check(order, { 'order 201': (r) => r.status === 201 });
  sleep(0.5);

  const history = http.get(`${API}/orders/history`, { headers: auth });
  check(history, { 'history 200': (r) => r.status === 200 });
}