import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const API_URL = import.meta.env.VITE_API_URL ?? ""

type HistoryRecord = {
  D_Id: string
  Timestamp: number
  Level: number | null
  CO2: number | null
  ReceivedAt: string
}

type Drain = {
  D_Id: string
  publicName: string
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
}

const ALERT_THRESHOLD = 80

export default function DrainHistoryChart() {
  const [selectedId, setSelectedId] = useState<string | null>(null)

  const { data: drains = [] } = useQuery<Drain[]>({
    queryKey: ["drains"],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/drains`)
      if (!res.ok) throw new Error("Failed")
      return res.json()
    },
  })

  const activeDrainId = selectedId ?? drains[0]?.D_Id ?? null

  const { data: history = [], isLoading } = useQuery<HistoryRecord[]>({
    queryKey: ["history", activeDrainId],
    queryFn: async () => {
      if (!activeDrainId) return []
      const res = await fetch(`${API_URL}/history/${activeDrainId}`)
      if (!res.ok) throw new Error("Failed to fetch history")
      return res.json()
    },
    enabled: !!activeDrainId,
    refetchInterval: 60_000,
  })

  const chartData = history
    .slice()
    .sort((a, b) => a.Timestamp - b.Timestamp)
    .map(h => ({
      time: formatTime(h.Timestamp),
      level: h.Level,
      co2: h.CO2,
    }))

  const latestLevel = chartData.at(-1)?.level ?? null
  const isAlert = latestLevel != null && latestLevel >= ALERT_THRESHOLD

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <CardTitle className="text-base font-semibold">24h History</CardTitle>
            {isAlert && (
              <span className="text-xs font-semibold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">
                ⚠ High Level
              </span>
            )}
          </div>

          <select
            value={activeDrainId ?? ""}
            onChange={(e) => setSelectedId(e.target.value)}
            className="w-full sm:w-[240px] rounded-md border border-input bg-background px-3 py-1.5 text-sm text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-ring cursor-pointer"
          >
            {drains.map(d => (
              <option key={d.D_Id} value={d.D_Id}>
                {d.publicName}
              </option>
            ))}
          </select>
        </div>
      </CardHeader>

      <CardContent>
        {isLoading ? (
          <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">
            Loading history…
          </div>
        ) : chartData.length === 0 ? (
          <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">
            No history data for this drain yet.
          </div>
        ) : (
          <>
            <p className="text-xs text-muted-foreground mb-2 font-medium">Water Fill Level (%)</p>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="time"
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  interval="preserveStartEnd"
                />
                <YAxis
                  domain={[0, 100]}
                  tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                  tickLine={false}
                  axisLine={false}
                />
                <Tooltip
                  contentStyle={{
                    background: "var(--background)",
                    border: "1px solid var(--border)",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(val: unknown) => [`${val}%`, "Fill Level"]}
                />
                <ReferenceLine
                  y={ALERT_THRESHOLD}
                  stroke="#ef4444"
                  strokeDasharray="4 3"
                  label={{ value: "Alert", position: "right", fontSize: 10, fill: "#ef4444" }}
                />
                <Line
                  type="monotone"
                  dataKey="level"
                  stroke="#6366f1"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>

            {chartData.some(d => d.co2 != null) && (
              <div className="mt-4">
                <p className="text-xs text-muted-foreground mb-2 font-medium">CO₂ (ppm)</p>
                <ResponsiveContainer width="100%" height={140}>
                  <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                    <XAxis
                      dataKey="time"
                      tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                      tickLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        background: "var(--background)",
                        border: "1px solid var(--border)",
                        borderRadius: 8,
                        fontSize: 12,
                      }}
                      formatter={(val: unknown) => [`${val} ppm`, "CO₂"]}
                    />
                    <Line
                      type="monotone"
                      dataKey="co2"
                      stroke="#10b981"
                      strokeWidth={2}
                      dot={false}
                      activeDot={{ r: 4 }}
                      connectNulls
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  )
}