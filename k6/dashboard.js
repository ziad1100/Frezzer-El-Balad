// Admin dashboard load test: login then read dashboard, orders and user stats.
// The server must run with DISABLE_RATE_LIMIT=1 (login still counts against authLimiter otherwise).
// Run (image-only):
//   docker run --rm -i -v "${PWD}/k6:/k6" -e BASE_URL=http://host.docker.internal:5000 grafana/k6 run /k6/dashboard.js
import http from 'k6/http';
import { check, sleep } from 'k6';

const BASE = __ENV.BASE_URL || 'http://host.docker.internal:5000';
const API = `${BASE}/api/v1`;
const ADMIN_EMAIL = __ENV.ADMIN_EMAIL || 'admin@pizzahouse.dev';
const ADMIN_PASSWORD = __ENV.ADMIN_PASSWORD || 'Pizza123!';

export const options = {
  scenarios: {
    dashboard: {
      executor: 'per-vu-iterations',
      vus: 3,
      iterations: 3,
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<500', 'p(99)<1000'],
  },
};

export default function () {
  const login = http.post(
    `${API}/auth/login`,
    JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  check(login, { 'login 200': (r) => r.status === 200 });

  const token = login.json('data.accessToken');
  const auth = { Authorization: `Bearer ${token}` };

  check(http.get(`${API}/analytics/dashboard`, { headers: auth }), { 'dashboard 200': (r) => r.status === 200 });
  check(http.get(`${API}/orders/stats`, { headers: auth }), { 'orders stats 200': (r) => r.status === 200 });
  check(http.get(`${API}/products/admin?page=1&limit=12`, { headers: auth }), {
    'products admin 200': (r) => r.status === 200,
  });
  check(http.get(`${API}/admin/users?page=1&limit=12`, { headers: auth }), { 'users list 200': (r) => r.status === 200 });
  sleep(1);
}