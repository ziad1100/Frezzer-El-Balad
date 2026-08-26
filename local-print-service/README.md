# Welad Halal — Local Thermal Print Service (Enhanced)

A lightweight printing agent that runs on the shop computer and sends print jobs to a thermal receipt printer.

## Architecture

```
Internet
  ↓
Vercel Frontend (Admin Dashboard)
  ↓
Render Backend (API)
  ↓
Print Jobs Queue (database)
  ↓
Local Print Service (this app — runs on shop computer)
  ↓
Printer Adapter Layer
  ├── USB Printer Adapter
  ├── Network (LAN/WiFi) Printer Adapter
  ├── Bluetooth Printer Adapter
  └── Simulated Printer Adapter (testing)
  ↓
Thermal Receipt Printer (USB / LAN / Bluetooth)
```

## Features

- **Multi-connection support**: USB, LAN, WiFi, Bluetooth, Windows
- **Adapter pattern**: Clean abstraction for printer communication
- **Structured error codes**: Meaningful Arabic/English error messages
- **Exponential backoff retry**: Transient failures retry with increasing delays
- **Health check endpoint**: Monitor printer status via HTTP
- **Structured logging**: JSON-formatted logs for debugging
- **Duplicate print protection**: Prevents accidental double printing
- **Arabic image fallback**: Renders Arabic text as image for printers without native support
- **58mm and 80mm paper support**
- **Test print with verification**
- **Service token authentication**

## Requirements

- **Node.js 18+** — Download from https://nodejs.org
- **Windows 10/11** or **macOS** or **Linux**
- A thermal receipt printer (ESC/POS compatible)
- Internet connection (to receive print jobs from the API)

## Supported Printers

Any ESC/POS-compatible thermal receipt printer works:

| Brand | Models |
|---|---|
| Xprinter | XP-80C, XP-370B, XP-N160II |
| Epson | TM-T88, TM-T20, TM-T81 |
| Star | TSP143, TSP654 |
| Bixolon | SRP-350, SRP-380 |
| HPRT | TP805, N41 |
| Generic | Most 58mm / 80mm USB/LAN printers |

## Quick Setup

### Step 1: Install Node.js

1. Go to https://nodejs.org
2. Download the **LTS** version (18 or newer)
3. Run the installer
4. Verify: `node --version`

### Step 2: Download and Configure

1. Copy `local-print-service` to your shop computer (e.g. `C:\print-service`)
2. Copy `.env.example` to `.env`
3. Edit `.env` with your settings:

```env
API_URL=https://welad-halal.onrender.com
API_TOKEN=your_service_token_here
PRINTER_CONNECTION=lan
PRINTER_IP=192.168.1.100
PRINTER_PORT=9100
PAPER_WIDTH=80
HEALTH_PORT=9200
MAX_RETRIES=3
```

### Step 3: Install and Start

```bash
npm install
npm start
```

Or use the Windows batch file:
- Double-click `start.bat` — auto-installs dependencies on first run
- Double-click `test-print.bat` — prints a test receipt

## Connection Types

### USB
1. Connect printer via USB cable
2. Install printer driver
3. Set `PRINTER_CONNECTION=usb`

### LAN / Ethernet
1. Connect printer to network switch/router
2. Find printer IP (check printer menu or router device list)
3. Set `PRINTER_CONNECTION=lan` and `PRINTER_IP=<printer-ip>`
4. Test: `ping <printer-ip>`

### WiFi
1. Connect printer to WiFi
2. Find printer IP
3. Set `PRINTER_CONNECTION=wifi` and `PRINTER_IP=<printer-ip>`

### Bluetooth
1. Pair printer via Windows Bluetooth settings
2. Note the COM port assigned
3. Set `PRINTER_CONNECTION=bluetooth` and `BLUETOOTH_COM_PORT=COM3`
4. **Note**: Bluetooth requires physical pairing first

## Health Check & Monitoring

The service runs a health check HTTP server on port 9200:

```bash
# Check printer health
curl http://localhost:9200/health

# Get detailed status
curl http://localhost:9200/status

# Send test print
curl -X POST http://localhost:9200/test
```

### Health Response Example
```json
{
  "status": "healthy",
  "connectionType": "lan",
  "printer": {
    "connected": true,
    "status": "online",
    "details": { "connectionType": "lan", "ip": "192.168.1.100", "port": 9100 }
  },
  "uptime": 3600,
  "timestamp": "2025-01-01T12:00:00.000Z"
}
```

## Error Codes

| Code | Arabic | English |
|---|---|---|
| PRINTER_NOT_FOUND | لم يتم العثور على الطابعة | Printer not found |
| USB_DEVICE_NOT_FOUND | جهاز USB غير موجود | USB device not found |
| LAN_PRINTER_UNREACHABLE | الطابعة على الشبكة غير قابلة للوصول | LAN printer unreachable |
| BLUETOOTH_UNAVAILABLE | البلوتوث غير متاح | Bluetooth unavailable |
| PRINTER_BUSY | الطابعة مشغولة | Printer busy |
| PRINT_TIMEOUT | انتهت مهلة الطباعة | Print timeout |
| PRINTER_OFFLINE | الطابعة غير متصلة | Printer is offline |
| PRINT_JOB_FAILED | فشلت عملية الطباعة | Print job failed |

## Retry Policy

Transient errors (printer busy, timeout, unreachable) are retried with exponential backoff:
- Attempt 1: 1 second delay
- Attempt 2: 2 seconds delay
- Attempt 3: 4 seconds delay
- After max retries: job marked as failed

## Running as Windows Service

```bash
npm install -g pm2
pm2 start index.js --name print-service
pm2 save
pm2 startup
```

## Security

- The `.env` file contains your API token — **never share it**
- The service only connects to the backend API (outbound only)
- No ports are exposed to the public internet (health check is local only)
- The printer is not exposed externally
- Service tokens are scoped to print operations only

## Files

| File | Purpose |
|---|---|
| `index.js` | Main service — adapters, printer connection, job processing |
| `package.json` | Dependencies and scripts |
| `.env` | Your configuration (keep secret!) |
| `.env.example` | Template for configuration |
| `start.bat` | Windows auto-setup and start |
| `test-print.bat` | Windows test print shortcut |
