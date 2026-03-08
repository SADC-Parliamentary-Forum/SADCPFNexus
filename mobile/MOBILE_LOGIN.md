# Mobile app – login credentials

Use these **demo accounts** to sign in to the SADC PF Nexus mobile app when the API is seeded with demo data.

---

## Login via Chrome (Flutter web)

To run the app in Chrome and sign in:

1. **Start the API** (in one terminal):
   ```bash
   cd api
   php artisan serve
   ```
   Leave it running at `http://127.0.0.1:8000`.

2. **Seed demo users** (once, if not already done):
   ```bash
   cd api && php artisan db:seed --class=DemoTenantSeeder
   ```

3. **Run the app in Chrome** (in another terminal):
   ```bash
   cd mobile
   flutter run -d chrome
   ```

4. **Sign in** in the browser with **admin@sadcpf.org** / **Admin@2024!**.

The app uses `http://localhost:8000/api/v1` on web. CORS is configured to allow any `http://localhost:PORT` or `http://127.0.0.1:PORT`, so no `.env` change is needed for Flutter web.

---

## Requirements

- API must be running (e.g. `php artisan serve` from the `api` directory).
- Demo users must exist. From the repo root:
  ```bash
  cd api && php artisan db:seed --class=DemoTenantSeeder
  ```
  Or run all seeders if your setup uses a single seeder that calls this.

## API base URL (mobile)

- **Android emulator:** default is `http://10.0.2.2:8000/api/v1` (host machine).
- **Physical device / iOS simulator:** set the host IP, e.g.:
  ```bash
  flutter run --dart-define=API_BASE_URL=http://192.168.1.100:8000/api/v1
  ```

---

## Demo login credentials

| Role / User        | Email               | Password     |
|--------------------|---------------------|--------------|
| System Admin       | `admin@sadcpf.org`  | `Admin@2024!` |
| Demo Staff         | `staff@sadcpf.org`  | `Staff@2024!` |
| HR Manager         | `hr@sadcpf.org`     | `HR@2024!`   |
| Finance Controller | `finance@sadcpf.org`| `Finance@2024!` |
| Maria Dlamini     | `maria@sadcpf.org`  | `Maria@2024!` |
| John Mutamba      | `john@sadcpf.org`   | `John@2024!`  |
| Thabo Nkosi       | `thabo@sadcpf.org`  | `Thabo@2024!` |

**Quick test:** use **admin@sadcpf.org** / **Admin@2024!** for full access.

---

## Troubleshooting: “Cannot reach server” / connection error

If you see a connection or network error when signing in:

1. **API must be running**  
   From the `api` folder: `php artisan serve` (serves at `http://127.0.0.1:8000`).

2. **Flutter web (Chrome)**  
   The API CORS allows `http://localhost:PORT` and `http://127.0.0.1:PORT` (e.g. port 49956 is explicitly allowed). Ensure the API is running on port 8000 (`php artisan serve`). No `FRONTEND_URL` needed. If you still see a CORS error, run `php artisan config:clear` and restart the API so the CORS config (and any port pattern) is reloaded.

3. **Android emulator**  
   Default URL is `http://10.0.2.2:8000/api/v1`. No change needed if the API is on your host machine.

4. **Physical device or iOS simulator**  
   Use your computer’s IP and pass it at run time:
   ```bash
   flutter run --dart-define=API_BASE_URL=http://YOUR_IP:8000/api/v1
   ```
   Example: `http://192.168.1.100:8000/api/v1`. Ensure the device and computer are on the same network.

5. **Request timed out**  
   If you see “The request timed out”, the API took too long to respond. Ensure the API is running (`php artisan serve`) and that it responds (e.g. open `http://localhost:8000` in a browser or run `curl http://localhost:8000/api/v1/up` if a health route exists). Cold starts or a slow machine can cause the first request to exceed the timeout.

---

## Biometric login

After signing in once with email/password, you can use **Use biometric login** on the login screen. Biometric is only available on supported devices/simulators with biometric hardware or emulation.

---

*These credentials are for local/demo use only. Do not use in production.*
