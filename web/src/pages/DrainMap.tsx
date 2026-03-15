import { useState } from "react"
import { useQuery } from "@tanstack/react-query"
import { Map, MapControls, useMap } from "@/components/ui/map"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { DrainDialog } from "@/components/DrainDialog"
import { DrainMarker } from "@/components/DrainMarker"
import { Moon, Sun, Loader2, Flag } from "lucide-react"
import { fetchDrains } from "@/lib/api"
import DrainHeatMap from "@/components/DrainHeatMap"
import DrainHistoryChart from "@/components/DrainHistoryChart"

const JAMAICA = { center: [-77.3, 18.15] as [number, number], zoom: 8.6 }

function CenterJamaica() {
  const { map } = useMap()
  return (
    <button
      onClick={() => map?.flyTo({ center: JAMAICA.center, zoom: JAMAICA.zoom, duration: 1000 })}
      aria-label="Center on Jamaica"
      className="absolute top-2 left-2 z-10 flex items-center justify-center size-8 rounded-md border border-white/20 bg-[#1a1a1a] text-white shadow-sm hover:bg-accent hover:text-text hover:border-transparent transition-colors"
    >
      <Flag className="size-4" />
    </button>
  )
}

function MapLoader() {
  const { isLoaded } = useMap()
  if (isLoaded) return null
  return (
    <div className="absolute inset-0 flex items-center justify-center bg-background/50 z-10">
      <Loader2 className="size-6 animate-spin text-text/60" />
    </div>
  )
}

type SelectedDrain = { name: string; id: string; online: boolean }

function DrainMap() {
  const [theme, setTheme] = useState<"light" | "dark">("dark")
  const [selectedDrain, setSelectedDrain] = useState<SelectedDrain | null>(null)

  const { data: drains = [] } = useQuery({
    queryKey: ["drains"],
    queryFn: fetchDrains,
  })

  return (
    <div className="w-full p-7">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-5xl font-bold tracking-tighter">Drain Map</h1>
          <p className="text-text/60 mt-1">Click a marker to view the drain's details, add an update on its status, or volunteer to help maintain it.</p>
        </div>
        <Button
          size="icon"
          variant="outline"
          className="rounded-full hover:cursor-pointer"
          onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
          aria-label="Toggle map theme"
        >
          {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
        </Button>
      </div>
      <Card className="w-full h-[600px] p-0 overflow-hidden">
        <Map theme={theme} center={[-77.3, 18.15]} zoom={8.6}>
          <MapLoader />
          <CenterJamaica />
          {drains.map((drain) => (
            <DrainMarker
              key={drain.D_Id}
              id={drain.D_Id}
              name={drain.publicName}
              latitude={drain.latitude}
              longitude={drain.longitude}
              online={drain.online}
              onClick={(d) => setSelectedDrain({ ...d, online: drain.online })}
            />
          ))}
          <MapControls showCompass />
        </Map>
      </Card>
      {/* Charts */}
      <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-2">
        <DrainHeatMap />
        <DrainHistoryChart />
      </div>
      <DrainDialog
        open={!!selectedDrain}
        onClose={() => setSelectedDrain(null)}
        drainName={selectedDrain?.name ?? ""}
        drainId={selectedDrain?.id}
        online={selectedDrain?.online ?? false}
      />
    </div>
  )
}

export default DrainMap
