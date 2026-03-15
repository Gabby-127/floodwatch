import { DynamoDBClient } from "@aws-sdk/client-dynamodb"
import { DynamoDBDocumentClient, PutCommand, ScanCommand } from "@aws-sdk/lib-dynamodb"
import { Resource } from "sst"

const docClient = DynamoDBDocumentClient.from(new DynamoDBClient({ region: "us-east-1" }))

// Get all drain IDs from the Drains table
async function getDrainIds(): Promise<string[]> {
  const result = await docClient.send(new ScanCommand({ TableName: Resource.Drains.name }))
  return (result.Items || []).map(d => d.D_Id)
}

// Generate realistic water level over 24 hours
// Simulates: low at night, rises during rain events, spikes, then recedes
function generateLevel(hourIndex: number, drainIndex: number): number {
  const hour = (hourIndex / 4) % 24 // readings every 15 min
  
  // Base level varies by drain
  const base = 15 + (drainIndex % 4) * 5

  // Rain event simulation — peaks around hour 14-16
  const rainPeak = Math.max(0, 40 * Math.exp(-0.08 * Math.pow(hour - 15, 2)))

  // Morning trickle
  const morning = hour >= 6 && hour <= 9 ? 10 * Math.sin((hour - 6) * Math.PI / 3) : 0

  // One drain goes critical
  const criticalSpike = drainIndex === 2 && hour >= 13 && hour <= 17
    ? 45 + Math.random() * 15
    : 0

  const noise = (Math.random() - 0.5) * 6
  return Math.min(100, Math.max(0, Math.round(base + rainPeak + morning + criticalSpike + noise)))
}

function generateCO2(hourIndex: number): number {
  const hour = (hourIndex / 4) % 24
  // Higher CO2 during stagnant overnight hours, lower when water is flowing
  const base = 400
  const overnight = hour < 6 || hour > 22 ? 80 : 0
  const noise = (Math.random() - 0.5) * 40
  return Math.round(base + overnight + noise)
}

async function seedHistory() {
  const drainIds = await getDrainIds()
  
  if (drainIds.length === 0) {
    console.log("No drains found — run seed-drains first!")
    return
  }

  console.log(`Seeding history for ${drainIds.length} drains...`)

  const now = Date.now()
  const TTL_SECONDS = 24 * 60 * 60
  const INTERVAL_MS = 15 * 60 * 1000 // 15 minute intervals
  const READINGS = 96 // 24 hours worth

  let totalRecords = 0

  for (let i = 0; i < drainIds.length; i++) {
    const drainId = drainIds[i]
    
    for (let r = 0; r < READINGS; r++) {
      const timestamp = now - (READINGS - r) * INTERVAL_MS
      const expiresAt = Math.floor(timestamp / 1000) + TTL_SECONDS

      const item = {
        D_Id: drainId,
        Timestamp: timestamp,
        ExpiresAt: expiresAt,
        Level: generateLevel(r, i),
        CO2: generateCO2(r),
        Location: "Jamaica",
        ReceivedAt: new Date(timestamp).toISOString(),
      }

      await docClient.send(new PutCommand({
        TableName: Resource.HistoryMetrics.name,
        Item: item,
      }))

      totalRecords++
    }

    console.log(`✓ Drain ${i + 1}/${drainIds.length} — ${drainId}`)
  }

  console.log(`Done! Seeded ${totalRecords} history records.`)
}

seedHistory().catch(console.error)

