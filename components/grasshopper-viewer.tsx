"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ArrowLeft, Download, Settings, RotateCcw } from "lucide-react"
import { ThreeDViewer } from "@/components/three-d-viewer"
import { ParameterControls } from "@/components/parameter-controls"

interface Definition {
  id: string
  name: string
  description: string
  parameters: Parameter[]
  geometry: any
}

interface Parameter {
  id: string
  name: string
  type: "number" | "boolean" | "color" | "text"
  value: any
  min?: number
  max?: number
  step?: number
}

interface GrasshopperViewerProps {
  definition: Definition
  onReset: () => void
}

export function GrasshopperViewer({ definition, onReset }: GrasshopperViewerProps) {
  const [parameters, setParameters] = useState<Parameter[]>(definition.parameters)
  const [geometry, setGeometry] = useState(definition.geometry)
  const [computing, setComputing] = useState(false)

  const handleParameterChange = async (paramId: string, value: any) => {
    const updatedParams = parameters.map((param) => (param.id === paramId ? { ...param, value } : param))
    setParameters(updatedParams)
    await computeGeometry(updatedParams)
  }

  const computeGeometry = async (params: Parameter[]) => {
    setComputing(true)
    try {
      const response = await fetch("/api/compute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          definitionId: definition.id,
          parameters: params,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setGeometry(data.geometry)
      }
    } catch (error) {
      console.error("Error computing geometry:", error)
    } finally {
      setComputing(false)
    }
  }

  const handleDownload = async () => {
    try {
      const response = await fetch("/api/download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          definitionId: definition.id,
          parameters: parameters,
        }),
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement("a")
        a.href = url
        a.download = `${definition.name}_modified.gh`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (error) {
      console.error("Download error:", error)
    }
  }

  const resetParameters = () => {
    const resetParams = definition.parameters.map((param) => ({ ...param }))
    setParameters(resetParams)
    computeGeometry(resetParams)
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button variant="ghost" size="sm" onClick={onReset}>
                <ArrowLeft className="w-4 h-4 mr-2" />
                Back
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-slate-800">{definition.name}</h1>
                <p className="text-slate-600">{definition.description}</p>
              </div>
            </div>
            <div className="flex space-x-2">
              <Button variant="outline" size="sm" onClick={resetParameters}>
                <RotateCcw className="w-4 h-4 mr-2" />
                Reset
              </Button>
              <Button variant="outline" size="sm" onClick={handleDownload}>
                <Download className="w-4 h-4 mr-2" />
                Download
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-3 gap-8">
          {/* 3D Viewer */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Settings className="w-5 h-5 mr-2" />
                  3D Preview
                  {computing && <span className="ml-2 text-sm text-blue-600">Computing...</span>}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="aspect-video bg-slate-100 rounded-lg overflow-hidden">
                  <ThreeDViewer geometry={geometry} loading={computing} />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Parameter Controls */}
          <div>
            <ParameterControls parameters={parameters} onChange={handleParameterChange} computing={computing} />
          </div>
        </div>
      </div>
    </div>
  )
}
