# Welad Halal — Local Thermal Print Service

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
Thermal Receipt Printer (USB / LAN / Bluetooth / WiFi)
```

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

## Setup Steps

### Step 1: Install Node.js

1. Go to https://nodejs.org
2. Download the **LTS** version (18 or newer)
3. Run the installer and follow the prompts
4. Verify installation — open Command Prompt and run:
   ```
   node --version
   ```
   You should see something like `v18.17.0` or newer.

### Step 2: Download the Print Service

1. Create a folder on the shop computer, e.g. `C:\print-service`
2. Copy the `local-print-service` folder contents into it:
   - `index.js`
   - `package.json`
   - `.env.example`

### Step 3: Get an API Token

1. Open the admin dashboard at https://welad-halal.vercel.app
2. Log in with the admin account
3. Open browser Developer Tools (F12)
4. Go to the **Console** tab
5. Run:
   ```javascript
   localStorage.getItem('ph_token')
   ```
6. Copy the token string (without quotes)
7. **Important:** This token expires every 15 minutes. For long-term use, you'll need to generate a permanent service token. Contact the developer for this.

### Step 4: Configure the Service

1. Copy `.env.example` to `.env`
2. Open `.env` in Notepad and fill in:

```env
# Backend API URL (don't change)
API_URL=https://welad-halal.onrender.com

# Your admin token (from Step 3)
API_TOKEN=paste_your_token_here

# Printer connection type: lan | usb | bluetooth | wifi
PRINTER_CONNECTION=lan

# For LAN/WiFi printers — your printer's IP address
PRINTER_IP=192.168.1.100

# Port (usually 9100 for LAN printers)
PRINTER_PORT=9100

# Paper width: 58 or 80
PAPER_WIDTH=80

# How often to check for jobs (milliseconds)
POLL_INTERVAL=3000
```

### Step 5: Connect the Printer

#### USB Connection
1. Connect the printer to the computer via USB cable
2. Turn on the printer
3. Install the printer driver (usually comes with the printer CD or download from manufacturer website)
4. Set `PRINTER_CONNECTION=usb` in `.env`
5. **Windows:** You may need to install `npm install -g windows-build-tools` for USB support
6. **Note:** USB printing requires the `escpos-usb` package and proper drivers

#### LAN / Ethernet Connection
1. Connect the printer to the network switch/router via Ethernet cable
2. Find the printer's IP address (usually printed on a network config page from the printer)
   - On the printer, press Menu → Network → Print Configuration
   - Or check your router's connected devices list
3. Set `PRINTER_CONNECTION=lan` and `PRINTER_IP=<printer-ip>` in `.env`
4. **Test connectivity:** Open Command Prompt and run:
   ```
   ping 192.168.1.100
   ```
   You should see replies.

#### WiFi Connection
1. Connect the printer to WiFi (via printer's menu or WPS button)
2. Find the printer's IP address
3. Set `PRINTER_CONNECTION=wifi` and `PRINTER_IP=<printer-ip>` in `.env`

#### Bluetooth Connection
1. Pair the printer with the computer via Windows Bluetooth settings
2. Find the COM port assigned to the printer
3. Set `PRINTER_CONNECTION=bluetooth` in `.env`
4. **Note:** Bluetooth printing may require additional configuration

### Step 6: Install Dependencies

Open Command Prompt in the print service folder and run:
```
cd C:\print-service
npm install
```

Wait for it to finish (may take 1-2 minutes).

### Step 7: Start the Service

```
npm start
```

You should see:
```
═══════════════════════════════════════════════════
  Welad Halal — Thermal Print Service
═══════════════════════════════════════════════════
API:         https://welad-halal.onrender.com
Connection:  lan
Printer IP:  192.168.1.100:9100
Paper:       80mm
Poll:        every 3000ms
═══════════════════════════════════════════════════
[printer] Connecting to 192.168.1.100:9100...
[printer] Connected via network
[service] Polling started. Press Ctrl+C to stop.
```

### Step 8: Test Print

1. Go to Admin Dashboard → Printer Settings
2. Click **Test Print** (اختبار الطباعة)
3. The receipt should print on the thermal printer

### Step 9: Print an Invoice

1. Go to Admin Dashboard → Orders
2. Click the eye icon on any order
3. Click **Print Invoice** (طباعة الفاتورة)
4. The receipt should print

## Troubleshooting

### "Printer not connected"
- Check the printer is turned on
- Check the USB/Network cable is connected
- For LAN: verify the IP address is correct and the printer is on the same network
- Try pinging the printer: `ping 192.168.1.100`

### "Printer disconnected" during printing
- The connection may have dropped. The service will auto-reconnect on the next job.
- Check network stability for LAN/WiFi printers

### "Print failed"
- Check the printer has paper
- Check the printer is not in error state
- Try the Test Print from Printer Settings

### Service stops working
- Make sure the Command Prompt window stays open
- For permanent setup, use PM2:
  ```
  npm install -g pm2
  pm2 start index.js --name print-service
  pm2 save
  pm2 startup
  ```

## Running as a Windows Service (Advanced)

To start automatically when Windows boots:

```
npm install -g pm2-windows-startup
pm2-startup install
pm2 start index.js --name print-service
pm2 save
```

## Files

| File | Purpose |
|---|---|
| `index.js` | Main service — connects to printer and polls for jobs |
| `package.json` | Dependencies and scripts |
| `.env` | Your configuration (keep secret!) |
| `.env.example` | Template for configuration |

## Security

- The `.env` file contains your API token — **never share it**
- The service only connects to the backend API (outbound only)
- No ports are opened to the public internet
- The printer is not exposed externally
