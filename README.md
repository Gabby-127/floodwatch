# FloodWatch by Team Just Met
### Real-time drain monitoring for flood prevention in Jamaica
> **Know before it flows.**

---

## The Problem

Storm drain blockages are one of the leading causes of urban flooding in Jamaica — costing lives, displacing families, and causing billions in infrastructure damage every year. Yet there is no early warning system. The government only finds out a drain is failing when a neighbourhood is already underwater.

**FloodWatch changes that.**

---

## What We Built

A real-time drain monitoring platform that connects IoT sensors, cloud infrastructure, and community participation to give operators an early warning **before** flooding occurs.

| Feature | Description |
|---|---|
| **IoT Sensor Pipeline** | Raspberry Pi Zero sensors publish water level readings via AWS IoT Core to Lambda functions |
| **Automated Alerting** | If a drain stays above 80% capacity for 10+ minutes, the operator is automatically emailed via SES |
| **Public Sentiment Evaluation** | Citizens submit drain reports — AI sentiment analysis (Amazon Comprehend) scores each drain 0–10 |
| **History Charts** | 24h time series charts per drain showing water fill level and CO₂ readings |
| **Sentiment Heatmap** | Live heatmap overlay — blue for positive community sentiment, red for negative |
| **Operator Management** | Admin portal to create, update, and delete operators via AWS Cognito |
| **Volunteer Portal** | Citizens can offer to help maintain a drain — emails the responsible operator |

---

## Live Demo

### Web App
```
http://localhost:5173
```
*(Run locally — see setup instructions below)*

### API Base URL
```
https://l67e23vrd4.execute-api.us-east-1.amazonaws.com
```

---

## API Endpoints

### Public (Drains & Reports)

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/drains` | List all drains with status, fill level, sentiment score |
| `GET` | `/drains/{id}` | Get a single drain by ID |
| `POST` | `/reports` | Submit a public drain report (AI sentiment analysed) |
| `POST` | `/volunteers` | Submit a volunteer offer — emails operator via SES |

### IoT Device Endpoints

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/heartbeat` | Device heartbeat — updates lastSeen timestamp |
| `POST` | `/sensor-data` | Water level reading — updates fill %, triggers alert if sustained |
| `POST` | `/history` | Save a 24h history record (auto-expires via TTL) |
| `GET` | `/history/{drainId}` | Fetch 24h history for a specific drain |

### Admin (Operator Management)

| Method | Endpoint | Description |
|---|---|---|
| `POST` | `/admin/operators` | Create a new operator in Cognito |
| `GET` | `/admin/operators` | List all operators |
| `GET` | `/admin/operators/{email}` | Get a specific operator |
| `PUT` | `/admin/operators/{email}` | Update operator attributes |
| `DELETE` | `/admin/operators/{email}` | Remove an operator |

### Example Requests

**Submit a drain report:**
```bash
curl -X POST https://l67e23vrd4.execute-api.us-east-1.amazonaws.com/reports \
  -H "Content-Type: application/json" \
  -d '{"D_Id":"<drain-id>","description":"The drain is completely blocked and overflowing","name":"Jane"}'
```

**Send a sensor reading:**
```bash
curl -X POST https://l67e23vrd4.execute-api.us-east-1.amazonaws.com/sensor-data \
  -H "Content-Type: application/json" \
  -d '{"drainId":"<drain-id>","waterLevelCm":95}'
```

**Create an operator:**
```bash
curl -X POST https://l67e23vrd4.execute-api.us-east-1.amazonaws.com/admin/operators \
  -H "Content-Type: application/json" \
  -d '{"email":"operator@example.com","firstName":"John","lastName":"Brown"}'
```

---

## Running Locally

### Prerequisites
- Node.js 20+
- AWS CLI configured with valid credentials
- An AWS account

### 1. Clone the repo
```bash
git clone https://github.com/BrionyFrater/drain-monitoring.git
cd drain-monitoring
```

### 2. Install dependencies
```bash
npm install
cd web && npm install && cd ..
```

### 3. Set environment variables
Create a `.env` file in the root:
```env
ADMIN_EMAIL=admin@example.com
ADMIN_TEMP_PASSWORD=Admin@2026
ADMIN_FIRST_NAME=Admin
ADMIN_LAST_NAME=User
```

Create `web/.env`:
```env
VITE_API_URL=https://l67e23vrd4.execute-api.us-east-1.amazonaws.com
```

### 4. Set the SES secret
```bash
npx sst secret set SesFromEmail noreply@yourdomain.com
```

### 5. Deploy the backend
```bash
npx sst dev
```
Wait for `✓ Complete` — this deploys all Lambda functions, DynamoDB tables, Cognito, and API Gateway.

### 6. Seed drain data
In a second terminal while `sst dev` is running:
```bash
npx sst shell -- npx tsx packages/scripts/src/seed-drains.ts
```

### 7. Run the frontend
```bash
cd web
npm run dev
```

Open **http://localhost:5173** in your browser.

---

## Architecture

```
Raspberry Pi Zero
      │
      ▼
AWS IoT Core
  ├── IoT Topic: History     → History Lambda     → HistoryMetrics DynamoDB (24h TTL)
  ├── IoT Topic: Heartbeat   → Heartbeat Lambda   → Drains DynamoDB (lastSeen)
  └── IoT Topic: Sensor Data → SensorData Lambda  → Drains DynamoDB + SES Alert
                                                          │
REST API Gateway ──────────────────────────────────────────┤
  ├── GET/POST /drains                                     │
  ├── POST /reports          → Amazon Comprehend ──────────┤
  ├── POST /volunteers       → Amazon SES                  │
  ├── GET/POST /history                                    ▼
  └── CRUD /admin/operators  → Amazon Cognito       Amazon DynamoDB
                                                    ├── Drains
                                                    ├── DrainMessages
                                                    ├── SensorData
                                                    └── HistoryMetrics

React + Vite Frontend
  ├── Drain Map (MapLibre GL)
  ├── Sentiment Heatmap
  ├── 24h History Chart
  ├── Report + Volunteer forms
  └── Admin Operator Portal
```

---

## Tech Stack

**Backend**
- AWS Lambda (Node.js 20) — serverless functions
- AWS IoT Core — device message broker
- Amazon DynamoDB — 4 tables
- Amazon Cognito — authentication & RBAC
- Amazon SES — automated email alerts
- Amazon Comprehend — AI sentiment analysis
- API Gateway (HTTP API)
- SST v3 — infrastructure as code (Pulumi under the hood)

**Frontend**
- React + Vite + TypeScript
- MapLibre GL — interactive maps
- TanStack Query — data fetching & caching
- Recharts — time series charts
- shadcn/ui + Tailwind CSS

---


## Impact & Scalability

- **Today** — Monitoring 14 storm drains across Kingston, Portmore, Spanish Town, and Montego Bay
- **6 months** — Island-wide deployment with NWA and municipal council partnerships
- **2 years** — Caribbean-wide platform, adaptable to any urban drainage system globally

Low hardware cost — Raspberry Pi Zero sensors are under **$20 USD** each. Fully serverless — scales to thousands of drains with no infrastructure changes.

---

*FloodWatch · Hackathon 2026 · Know before it flows. *
