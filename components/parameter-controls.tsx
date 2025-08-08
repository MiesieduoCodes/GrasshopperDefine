"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Sliders } from "lucide-react"

interface Parameter {
  id: string
  name: string
  type: "number" | "boolean" | "color" | "text"
  value: any
  min?: number
  max?: number
  step?: number
}

interface ParameterControlsProps {
  parameters: Parameter[]
  onChange: (paramId: string, value: any) => void
  computing?: boolean
}

export function ParameterControls({ parameters, onChange, computing }: ParameterControlsProps) {
  if (parameters.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Sliders className="w-5 h-5 mr-2" />
            Parameters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <Sliders className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-slate-500">No parameters available</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center">
          <Sliders className="w-5 h-5 mr-2" />
          Parameters ({parameters.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {parameters.map((param) => (
          <div key={param.id} className="space-y-2">
            <Label htmlFor={param.id} className="text-sm font-medium">
              {param.name}
            </Label>

            {param.type === "number" && (
              <div className="space-y-2">
                <Slider
                  id={param.id}
                  min={param.min || 0}
                  max={param.max || 100}
                  step={param.step || 1}
                  value={[param.value]}
                  onValueChange={(value) => onChange(param.id, value[0])}
                  disabled={computing}
                  className="w-full"
                />
                <div className="flex justify-between text-xs text-slate-500">
                  <span>{param.min || 0}</span>
                  <span className="font-medium">{param.value}</span>
                  <span>{param.max || 100}</span>
                </div>
              </div>
            )}

            {param.type === "boolean" && (
              <div className="flex items-center space-x-2">
                <Switch
                  id={param.id}
                  checked={param.value}
                  onCheckedChange={(checked) => onChange(param.id, checked)}
                  disabled={computing}
                />
                <Label htmlFor={param.id} className="text-sm">
                  {param.value ? "On" : "Off"}
                </Label>
              </div>
            )}

            {param.type === "color" && (
              <div className="flex items-center space-x-2">
                <Input
                  id={param.id}
                  type="color"
                  value={param.value}
                  onChange={(e) => onChange(param.id, e.target.value)}
                  disabled={computing}
                  className="w-16 h-10 p-1 border rounded"
                />
                <Input
                  value={param.value}
                  onChange={(e) => onChange(param.id, e.target.value)}
                  disabled={computing}
                  className="flex-1"
                  placeholder="#000000"
                />
              </div>
            )}

            {param.type === "text" && (
              <Input
                id={param.id}
                value={param.value}
                onChange={(e) => onChange(param.id, e.target.value)}
                disabled={computing}
                placeholder="Enter text..."
              />
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  )
}
