# TaskFlow development and deployment lab

## Automated project-local setup

From PowerShell at the project root:

```powershell
Set-ExecutionPolicy -Scope Process Bypass
.\scripts\Setup-Dev.ps1
.\scripts\Start-Dev.ps1
.\scripts\Test-Health.ps1
```

The API is available at `http://127.0.0.1:8000`, with interactive docs at `/docs`.

Create a SQLite backup and remove old logs with:

```powershell
.\scripts\Backup-Sqlite.ps1
.\scripts\Cleanup-Logs.ps1 -KeepDays 14
```

## Docker Desktop

After installing and starting Docker Desktop manually:

```powershell
docker compose up --build -d
docker compose logs -f api
docker compose down
```

The compose file stores SQLite data in a named Docker volume.

## Manual Windows tasks

These require local administrator decisions and are intentionally not automated:

- Create Windows users and assign permissions using Computer Management or `net user`.
- Install Docker Desktop, WSL2, Ubuntu, IIS, URL Rewrite, and Application Request Routing.
- Create a Windows Defender Firewall inbound rule only for the required port.
- Install `mkcert` and trust its local root certificate, or use OpenSSL manually.
- Configure IIS reverse proxy to forward to `127.0.0.1:8000`.
- Register Uvicorn as a Windows Service after choosing a service account and log location.
- Create a scheduled task for `Backup-Sqlite.ps1` after choosing its schedule and account.

## WSL2 and Ubuntu exercise

Inside Ubuntu, install Nginx, Python, and system tools with `apt`. Create a Linux virtual environment, install `requirements.txt`, and run Uvicorn or Gunicorn behind Nginx. Keep WSL2 and Windows environment variables separate, and use a LAN address when testing from a physical phone.

## TLS and cloud deployment

Use `mkcert` only for local development. For a public hostname, use a trusted certificate such as Certbot/Let's Encrypt and terminate TLS at IIS or Nginx. Never commit `.env`, service-role keys, private keys, or certificate files.

## Security note

Set a strong random `SECRET_KEY` in `.env` before using the API outside local development. Keep `.env`, database files, private keys, and certificates out of source control.

## Automated Docker deployment

After installing and starting Docker Desktop manually, run from the project root:

```powershell
.\scripts\Deploy-Docker.ps1 -Build
```

The script starts Compose, waits for `/health`, and prints recent logs if startup fails. Use `-FollowLogs` to watch the API:

```powershell
.\scripts\Deploy-Docker.ps1 -FollowLogs
```

The image runs as a non-root user and has a Docker healthcheck. Check status or stop it with:

```powershell
docker compose ps
docker compose logs --tail 100 api
docker compose down
```

SQLite is stored in the named `todo-data` volume. Back it up before upgrades:

```powershell
.\scripts\Backup-Sqlite.ps1
.\scripts\Backup-DockerSqlite.ps1
```

Use `Backup-DockerSqlite.ps1` when the API is running in Docker; it uses SQLite's online backup API against the active named volume.

## IIS reverse proxy procedure

1. Install IIS, URL Rewrite, and Application Request Routing (ARR) as Administrator.
2. Start the API with `Start-Dev.ps1`, or run Docker on port 8000.
3. In IIS Manager, enable ARR proxy under the server node.
4. Create a site bound to your hostname and port 80.
5. Add a URL Rewrite reverse-proxy rule forwarding all traffic to `http://127.0.0.1:8000/`.
6. Browse to `/health` through IIS and confirm HTTP 200.
7. Add an HTTPS binding after installing a certificate for the exact hostname.
8. Open only ports 80 and 443 in Windows Firewall. Keep port 8000 local when IIS is the public entry point.

Do not expose Uvicorn directly to the internet. IIS should terminate TLS and proxy to the local API.

## WSL2, Nginx, and Gunicorn procedure

Inside Ubuntu, install the tools and create a Linux-specific environment:

```bash
sudo apt update
sudo apt install -y python3-venv nginx
cd /mnt/c/Users/<your-user>/OneDrive/Desktop/fastapi_project
python3 -m venv .venv-linux
source .venv-linux/bin/activate
pip install -r requirements.txt
```

Run behind Gunicorn with Uvicorn workers:

```bash
gunicorn main:app --bind 127.0.0.1:8000 --workers 2 --worker-class uvicorn.workers.UvicornWorker
```

Create an Nginx site proxying to `http://127.0.0.1:8000`, enable it, and test:

```bash
sudo nginx -t
sudo systemctl reload nginx
curl http://127.0.0.1/health
```

For persistence, create a systemd service for Gunicorn. Keep `.env` readable only by its service account and do not reuse the Windows virtual environment inside WSL2.

## TLS and GitHub Actions

For local names, install `mkcert`, run `mkcert -install`, and create a certificate for the exact hostname. For a public DNS name, point DNS to the server and use Certbot/Let's Encrypt. Test renewal before expiry. Never commit private keys, certificates, `.env`, or service-role keys.

The workflow in `.github/workflows/ci.yml` automatically compiles Python, imports the app, builds the Docker image, starts it, and checks `/health`. Push a branch or open a pull request to run it. A real release still requires you to add registry/server credentials and a deployment job; keep those in GitHub Environments with required reviewers.

## Monitoring and troubleshooting

```powershell
.\scripts\Test-Health.ps1
docker compose ps
docker compose logs -f api
```

Use Uvicorn `--log-level debug` only while diagnosing locally. For a public deployment, add uptime monitoring against `/health` and collect logs centrally. Use `wss://` for WebSockets behind HTTPS.
