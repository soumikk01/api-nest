# Apio Agent Files
# ===================
# These are the standalone monitor files dropped into user projects
# by install.sh / install.ps1
#
# Files:
#   ApiMonitorFilter.java  — Spring Boot @Component filter
#   apio_monitor.py     — ASGI/WSGI middleware (FastAPI, Flask, Django)
#   apio_monitor.go     — net/http middleware (chi, gorilla/mux, gin)
#
# How the install scripts use them:
#   curl https://apio.one/agents/ApiMonitorFilter.java > src/main/java/.../ApiMonitorFilter.java
#   curl https://apio.one/agents/apio_monitor.py   > apio_monitor.py
#   curl https://apio.one/agents/apio_monitor.go   > apio_monitor.go
#
# Each file:
#   - Has zero external dependencies
#   - Reads APIO_SDK_TOKEN from environment
#   - Reads APIO_BACKEND_URL from environment (default: http://localhost:4000)
#   - Batches events every 500ms → POST /api/v1/ingest
#   - Queues up to 1000 events in memory, drops oldest on overflow
#   - Re-queues failed batches for retry
