# Performance scaffolds (k6)

| Script | Purpose |
|--------|---------|
| [smoke-login-list.js](./k6/smoke-login-list.js) | Login + travel/leave list smoke |

Install [k6](https://k6.io/docs/get-started/installation/), then:

```bash
k6 run perf/k6/smoke-login-list.js
```

Use against a **dev/staging** API with known credentials. Do not point at production with demo passwords.
