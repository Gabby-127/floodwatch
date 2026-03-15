import { useEffect, useRef } from "react"
import { useQuery } from "@tanstack/react-query"
import maplibregl from "maplibre-gl"
import "maplibre-gl/dist/maplibre-gl.css"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

const API_URL = import.meta.env.VITE_API_URL ?? ""

type Drain = {
  D_Id: string
  publicName: string
  latitude: number
  longitude: number
  fillPercent: number | null
  drainStatus: "normal" | "elevated" | "critical"
  online: boolean
  sentimentScore: number | null
}

// Returns a colour for a sentiment score 0-10
// 0 = very bad (red), 5 = neutral (yellow), 10 = very good (blue)
function sentimentColor(score: number | null): string {
  if (score == null) return "#94a3b8"
  if (score >= 8) return "#1d4ed8"
  if (score >= 6) return "#60a5fa"
  if (score >= 4) return "#fbbf24"
  if (score >= 2) return "#f97316"
  return "#dc2626"
}

export default function DrainHeatMap() {
  const mapRef = useRef<HTMLDivElement>(null)
  const mapInstance = useRef<maplibregl.Map | null>(null)
  const markersRef = useRef<maplibregl.Marker[]>([])

  const { data: drains = [], isLoading } = useQuery<Drain[]>({
    queryKey: ["drains"],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/drains`)
      if (!res.ok) throw new Error("Failed to fetch drains")
      return res.json()
    },
    refetchInterval: 30_000,
  })

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return
    mapInstance.current = new maplibregl.Map({
      container: mapRef.current,
      style: "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json",
      center: [-77.3, 18.15],
      zoom: 8.6,
    })
    mapInstance.current.addControl(new maplibregl.NavigationControl(), "top-right")
    return () => {
      mapInstance.current?.remove()
      mapInstance.current = null
    }
  }, [])

  useEffect(() => {
    const map = mapInstance.current
    if (!map || drains.length === 0) return

    const addMarkers = () => {
      // Clear old markers
      markersRef.current.forEach(m => m.remove())
      markersRef.current = []

      // Remove old heatmap layers/source if they exist from a previous render
      if (map.getLayer("drain-heat")) map.removeLayer("drain-heat")
      if (map.getSource("heat-src")) map.removeSource("heat-src")

      // Add sentiment heatmap source — weight is based directly on inverted sentiment
      // score 0 (bad) → weight 1.0 (hot/red), score 10 (good) → weight 0.0 (cool/blue)
      const geojson: GeoJSON.FeatureCollection = {
        type: "FeatureCollection",
        features: drains.map(d => ({
          type: "Feature",
          properties: {
            sentimentWeight: d.sentimentScore != null
              ? (10 - d.sentimentScore) / 10   // invert: bad=high weight, good=low weight
              : 0.5,
          },
          geometry: {
            type: "Point",
            coordinates: [d.longitude, d.latitude],
          },
        })),
      }

      map.addSource("heat-src", { type: "geojson", data: geojson })

      map.addLayer({
        id: "drain-heat",
        type: "heatmap",
        source: "heat-src",
        paint: {
          // Each point's contribution is its sentiment weight directly
          "heatmap-weight": ["get", "sentimentWeight"],
          "heatmap-intensity": [
            "interpolate", ["linear"], ["zoom"],
            5, 1, 9, 2, 12, 3,
          ],
          "heatmap-radius": [
            "interpolate", ["linear"], ["zoom"],
            5, 30, 8, 50, 11, 70,
          ],
          "heatmap-opacity": 0.8,
          // Blue = good sentiment (low weight), Red = bad sentiment (high weight)
          "heatmap-color": [
            "interpolate",
            ["linear"],
            ["heatmap-density"],
            0,    "rgba(0,0,0,0)",
            0.1,  "#1d4ed8",   // blue  — very positive
            0.3,  "#60a5fa",   // light blue — positive
            0.5,  "#fbbf24",   // yellow — neutral
            0.7,  "#f97316",   // orange — negative
            0.85, "#dc2626",   // red — very negative
            1,    "#7f1d1d",   // dark red — extremely negative
          ],
        },
      })

      // Add clickable dot markers on top
      drains.forEach(drain => {
        const color = sentimentColor(drain.sentimentScore)
        const score = drain.sentimentScore

        const el = document.createElement("div")
        el.style.cssText = `
          width: 12px; height: 12px;
          border-radius: 50%;
          background: ${color};
          border: 2px solid white;
          box-shadow: 0 1px 4px rgba(0,0,0,0.4);
          cursor: pointer;
          z-index: 10;
        `

        const popup = new maplibregl.Popup({ offset: 12, closeButton: false })
          .setHTML(`
            <div style="font-family: DM Sans, sans-serif; padding: 8px 12px; min-width: 170px;">
              <div style="font-weight: 700; font-size: 13px; margin-bottom: 6px; color: #111;">
                ${drain.publicName}
              </div>
              <div style="font-size: 12px; color: #555; margin-bottom: 3px;">
                Sentiment Score:
                <b style="color:${color}; font-size: 13px;">
                  ${score != null ? `${score}/10` : "No reports yet"}
                </b>
              </div>
              <div style="font-size: 12px; color: #555;">
                Fill Level: <b>${drain.fillPercent != null ? `${drain.fillPercent}%` : "—"}</b>
              </div>
              <div style="font-size: 11px; color: #999; margin-top: 5px;">
                ${drain.online ? "🟢 Online" : "🔴 Offline"}
              </div>
            </div>
          `)

        const marker = new maplibregl.Marker({ element: el })
          .setLngLat([drain.longitude, drain.latitude])
          .setPopup(popup)
          .addTo(map)

        markersRef.current.push(marker)
      })
    }

    if (map.loaded()) {
      addMarkers()
    } else {
      map.once("load", addMarkers)
    }
  }, [drains])

  return (
    <Card className="w-full">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div>
            <CardTitle className="text-base font-semibold">Public Sentiment Heatmap</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Based on public drain reports — click a marker to see the score
            </p>
          </div>
          <div className="flex gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-blue-600" />
              Positive
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-yellow-400" />
              Neutral
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block w-2 h-2 rounded-full bg-red-600" />
              Negative
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-xs text-muted-foreground">Good (10)</span>
          <div
            className="flex-1 h-2 rounded-full"
            style={{
              background: "linear-gradient(to right, #1d4ed8, #60a5fa, #fbbf24, #f97316, #dc2626)",
            }}
          />
          <span className="text-xs text-muted-foreground">Bad (0)</span>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading && (
          <div className="h-[420px] flex items-center justify-center text-sm text-muted-foreground">
            Loading drain data…
          </div>
        )}
        <div
          ref={mapRef}
          className="w-full rounded-b-xl overflow-hidden"
          style={{ height: 420, display: isLoading ? "none" : "block" }}
        />
      </CardContent>
    </Card>
  )
}