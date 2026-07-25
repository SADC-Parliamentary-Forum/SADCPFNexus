/**
 * k6 smoke scaffold — login + list endpoints.
 *
 * Usage:
 *   k6 run perf/k6/smoke-login-list.js
 *
 * Env:
 *   BASE_URL   default http://localhost:8000/api/v1
 *   EMAIL      default staff@sadcpf.org (dev seed only)
 *   PASSWORD   default Staff@2024!
 *
 * Does not assert production SLAs — wire thresholds after a baseline run.
 */
import http from "k6/http";
import { check, sleep } from "k6";

export const options = {
  vus: 1,
  duration: "30s",
  thresholds: {
    http_req_failed: ["rate<0.05"],
    http_req_duration: ["p(95)<3000"],
  },
};

const BASE = __ENV.BASE_URL || "http://localhost:8000/api/v1";
const EMAIL = __ENV.EMAIL || "staff@sadcpf.org";
const PASSWORD = __ENV.PASSWORD || "Staff@2024!";

export default function () {
  const loginRes = http.post(
    `${BASE}/auth/login`,
    JSON.stringify({
      email: EMAIL,
      password: PASSWORD,
      device_name: "k6-smoke",
      client_type: "web",
    }),
    { headers: { "Content-Type": "application/json", Accept: "application/json" } },
  );

  check(loginRes, {
    "login status 200": (r) => r.status === 200,
    "login has token or mfa": (r) => {
      try {
        const body = r.json();
        return !!(body.token || body.mfa_required);
      } catch {
        return false;
      }
    },
  });

  let token = "";
  try {
    const body = loginRes.json();
    if (body.mfa_required) {
      // MFA accounts are out of scope for this smoke scaffold
      sleep(1);
      return;
    }
    token = body.token || "";
  } catch {
    sleep(1);
    return;
  }

  if (!token) {
    sleep(1);
    return;
  }

  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
  };

  const travel = http.get(`${BASE}/travel/requests`, { headers });
  check(travel, { "travel list 200": (r) => r.status === 200 });

  const leave = http.get(`${BASE}/leave/requests`, { headers });
  check(leave, { "leave list 200": (r) => r.status === 200 });

  sleep(1);
}
