# Hackathon QR Food & Refreshment Tracking System

A small Flask application for issuing one QR code per hackathon participant and recording breakfast, tea, lunch, snacks, dinner, or any other service. The QR code contains only the participant ID. A database uniqueness constraint prevents the same participant from receiving the same service twice on the same event date.

## Requirements

- Python 3.10+
- MySQL 8+ for production (SQLite is used automatically when `DATABASE_URL` is omitted, which is convenient for local smoke tests)
- A browser with camera permission for scanning
- `cryptography` for generating a local HTTPS certificate

## Install

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

## MySQL setup

Run `database/schema.sql` as a MySQL administrator, then set `DATABASE_URL` in `.env`:

```text
DATABASE_URL=mysql+pymysql://hackathon_user:your-password@localhost/hackathon_tracker
```

The application creates its tables and default services on first start. Set a strong `SECRET_KEY`, `ADMIN_USERNAME`, and `ADMIN_PASSWORD` in `.env`; the password is stored as a hash.

## Run

```powershell
python app.py
```

Open `http://127.0.0.1:5000`. The initial login is the `ADMIN_USERNAME` and `ADMIN_PASSWORD` from `.env` (defaults are `admin` and `admin123` only when no `.env` is configured).

## HTTPS scanner mode for a phone

Phone browsers only expose `navigator.mediaDevices.getUserMedia()` to secure contexts. Use the included certificate generator for a local development/demo HTTPS server:

```powershell
python -m pip install -r requirements.txt
python scripts\generate_dev_cert.py
$env:FLASK_PORT="5443"
python app.py --https
```

The server binds to `0.0.0.0` by default. Run `ipconfig`, find the laptop's Wi-Fi IPv4 address, and open this URL on the phone, replacing the address if yours differs:

```text
https://192.168.31.198:5443/scanner
```

The generated certificate is self-signed and valid for 30 days. The phone will show a certificate warning; this is expected for local development. Proceed only on your own laptop and Wi-Fi, then allow camera access when the browser asks. Run the generator again if the laptop's LAN IP changes. Windows Firewall must allow Python on Private networks.

The scanner uses the QR library's supported camera API, which internally requests `navigator.mediaDevices.getUserMedia()` only once per page. It displays a clear message for insecure HTTP, denied permission, unsupported browsers, or unavailable camera hardware. The existing `Use phone camera` image fallback remains available, but HTTPS live scanning is the recommended counter workflow.

For a real hackathon, the most reliable final deployment is a real HTTPS host or an HTTPS reverse proxy with a trusted certificate and a stable domain. Local HTTPS is suitable for a same-Wi-Fi demo or a small event network; a hosted HTTPS deployment avoids self-signed certificate warnings, changing LAN IPs, and laptop sleep/network issues.

## Use from a phone on the same Wi-Fi

The server listens on the local network by default. On Windows, run `ipconfig` and find the computer's IPv4 address, for example `192.168.1.25`. On the phone connected to the same Wi-Fi, open `http://192.168.1.25:5000`. If Windows Firewall asks, allow Python on Private networks. Camera access may require HTTPS in some mobile browsers; for reliable event-day scanning, put the app behind an HTTPS reverse proxy or use a trusted local HTTPS tunnel.

## Organizer workflow

1. Sign in and open Participants.
2. Add a name, phone number, and team. The app creates `HACK-0001` style IDs and QR codes.
3. Open the participant record to download or print one QR, or use Print QR Codes from the participant list workflow.
4. Add or deactivate services under Services.
5. At the counter, open Scanner over HTTPS, select the service, start the camera, and scan the ID card.
6. A first scan shows SERVICE GIVEN. A repeated scan shows ALREADY TAKEN and creates no second row.
7. Reports provides taken/not-taken filters and search. Export Excel downloads Participants, Service Records, and Summary sheets.

## Notes

- Service records are scoped by the server's current date. The unique key is `(participant_id, service_id, event_date)`.
- For a future event, update `EVENT_NAME` and extend the event-date model if multiple historical events must coexist.
- On a production deployment, serve Flask behind a production WSGI server and HTTPS so mobile browsers can access the camera.

## Render deployment

This repository is ready for a Render Web Service, but Render's filesystem is not the database. Use an external MySQL database with a persistent plan from a MySQL provider that allows connections from Render. Do not use the local SQLite fallback in production; participant and service records must live in MySQL.

### 1. Prepare GitHub

From the project folder:

```powershell
git init
git add app.py requirements.txt .env.example .gitignore README.md database scripts static templates
git commit -m "Prepare hackathon tracker for Render"
git branch -M main
git remote add origin https://github.com/YOUR-USERNAME/YOUR-REPOSITORY.git
git push -u origin main
```

Never commit `.env`, database passwords, `certs/*.pem`, `instance/`, or `__pycache__/`. The included `.gitignore` excludes them.

### 2. Create the MySQL database

Create a reachable MySQL 8 database with a persistent plan. Collect its host, port, database name, username, and password. The database must accept connections from Render and must not be an ephemeral local database. The app creates its tables and default services on first boot; `database/schema.sql` can be used if your provider requires the database/user to be created manually.

### 3. Create the Render Web Service

In Render, choose **New +**, **Web Service**, and connect the GitHub repository.

Use these settings:

```text
Environment: Python 3
Build Command: pip install -r requirements.txt
Start Command: gunicorn --bind 0.0.0.0:$PORT app:app
Health Check Path: /health
```

The start command is `app:app` because the Flask entry point is `app.py` and the exported Flask object at the bottom of that module is named `app`. Gunicorn uses Render's `$PORT`; do not bind production to `127.0.0.1`.

### 4. Add Render environment variables

In the Render service's Environment tab, add:

```text
APP_ENV=production
SECRET_KEY=<long-random-secret>
DB_HOST=<managed-mysql-host>
DB_PORT=3306
DB_USER=<managed-mysql-user>
DB_PASSWORD=<managed-mysql-password>
DB_NAME=<managed-mysql-database>
ADMIN_USERNAME=admin
ADMIN_PASSWORD=<strong-admin-password>
EVENT_NAME=Hackathon 2026
```

You may use one `DATABASE_URL=mysql+pymysql://...` variable instead of the five `DB_*` variables, but do not leave both configurations ambiguous. Do not set `FLASK_HTTPS=1` on Render; Render terminates public HTTPS before forwarding traffic to Gunicorn. Do not set `SSL_CERT_FILE` or `SSL_KEY_FILE` in Render.

### 5. Deploy and test

Deploy the service and wait for Render to report it as live. Test these URLs using the public Render URL:

```text
https://YOUR-SERVICE.onrender.com/health
https://YOUR-SERVICE.onrender.com/login
https://YOUR-SERVICE.onrender.com/scanner
```

`/health` should return HTTP 200 with `{"status":"ok","database":"ok"}`. If it returns HTTP 503, the web service is running but the MySQL connection variables or provider network access are incorrect. Log in, add a participant, download a QR, add/select a service, and test one first scan plus a duplicate scan. Test `/export.xlsx` after creating a record.

### 6. Test the phone camera

1. Connect the phone to the internet; it does not need to be on the laptop's Wi-Fi.
2. Open `https://YOUR-SERVICE.onrender.com/login` in Chrome or Safari.
3. Sign in and open Scanner.
4. Select Breakfast, Lunch, or another active service.
5. Tap **Start live camera** and allow camera permission.
6. Scan a participant QR. Confirm `SERVICE GIVEN`, then scan it again and confirm `ALREADY TAKEN`.

The scanner uses the `html5-qrcode` camera API, which requests `navigator.mediaDevices.getUserMedia()` only after the operator presses the start button. Public Render HTTPS is a secure context, so no self-signed certificate is needed. If permission was denied earlier, enable Camera for the site in the phone browser's site settings and reload the scanner page.

### Render troubleshooting

- **Build fails:** confirm `requirements.txt` is committed and the Build Command is exactly `pip install -r requirements.txt`.
- **Application fails to boot:** confirm the Start Command is exactly `gunicorn --bind 0.0.0.0:$PORT app:app` and inspect Render logs.
- **`/health` returns 503:** verify `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, and `DB_NAME`; check that the MySQL provider accepts Render connections.
- **Login fails:** verify `ADMIN_USERNAME` and `ADMIN_PASSWORD`, then redeploy so the initial admin row can be created.
- **Camera does not open:** use the public `https://` URL, not an `http://` URL or the laptop IP; allow camera permission and avoid private/incognito browser restrictions.
- **Data disappears:** verify the app is using MySQL, not SQLite. Render local files are not a persistent database.
