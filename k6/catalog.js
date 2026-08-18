// Read-heavy browsing load test: catalog lists, best sellers, offers, product detail.
// Run via the official k6 image (no local install needed):
//   docker run --rm -i -v "${PWD}/k6:/k6" grafana/k6 run /k6/catalog.js
// Override base URL (container -> host):
//   docker run --rm -i -v "${PWD}/k6:/k6" -e BASE_URL=http://host.docker.internal:5000 grafana/k6 run /k6/catalog.js
import http from 'k6/http';
import { check } from 'k6';

const BASE = __ENV.BASE_URL || 'http://host.docker.internal:5000';
const API = `${BASE}/api/v1`;

export const options = {
  scenarios: {
    browsing: {
      executor: 'constant-arrival-rate',
      rate: 20,
      timeUnit: '1s',
      duration: '60s',
      preAllocatedVUs: 10,
      maxVUs: 50,
    },
  },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    http_req_duration: ['p(95)<300', 'p(99)<1000'],
  },
  discardResponseBodies: true,
};

export function setup() {
  const res = http.get(`${API}/products?page=1&limit=50`);
  const items = res.json('data.items') || [];
  return items.map((p) => p.slug).slice(0, 24);
}

export default function (slugs) {
  const page = Math.floor(Math.random() * 4) + 1;
  const list = http.get(`${API}/products?page=${page}&limit=12`);
  check(list, { 'products list 200': (r) => r.status === 200 });

  http.get(`${API}/products/best-sellers`);
  http.get(`${API}/products/offers`);
  http.get(`${API}/offers/active`);
  http.get(`${API}/categories/tree`);
  http.get(`${API}/banners/active`);

  if (slugs.length > 0) {
    const slug = slugs[__ITER % slugs.length];
    check(http.get(`${API}/products/${slug}`), { 'product detail 200': (r) => r.status === 200 });
  }
}