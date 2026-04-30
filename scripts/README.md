# Apio — Install Scripts

Two scripts. Works for **Java, Node.js, Python** — no Node.js required on the user's machine.

---

## Linux / macOS

```bash
APIO_TOKEN=your_token_here bash -c "$(curl -fsSL https://apio.one/install.sh)"
```

## Windows (PowerShell)

```powershell
$env:APIO_TOKEN="your_token_here"; iwr https://apio.one/install.ps1 | iex
```

---

## What it auto-does

| Language | Action |
|---|---|
| **Java** (Spring Boot) | Copies `ApiMonitorFilter.java` into your package, adds token to `application.properties` |
| **Node.js** (Express/NestJS) | Creates `apio-monitor.js`, adds token to `.env` |
| **Python** (FastAPI/Flask/Django) | Creates `apio_monitor.py`, adds token to `.env` |

After running → start your app normally → APIs appear in dashboard.

---

## Force a specific language

```bash
LANG=java APIO_TOKEN=xxx bash -c "$(curl -fsSL https://apio.one/install.sh)"
```

```powershell
.\install.ps1 -Lang java -Token xxx
```
