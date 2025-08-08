"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Slider } from "@/components/ui/slider"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Sliders, RotateCcw, Zap } from "lucide-react"
import { useState, useCallback, useEffect } from "react"

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
  onReset?: () => void
}

export function ParameterControls({ parameters, onChange, computing, onReset }: ParameterControlsProps) {
  const [localValues, setLocalValues] = useState<Record<string, any>>({})
  const [updatingParams, setUpdatingParams] = useState<Set<string>>(new Set())

  const handleParameterChange = useCallback((paramId: string, value: any) => {
    setLocalValues(prev => ({ ...prev, [paramId]: value }))
    
    // Mark parameter as updating
    setUpdatingParams(prev => new Set([...prev, paramId]))
    
    // Call onChange immediately for real-time updates
    onChange(paramId, value)
    
    // Clear updating status after a short delay
    setTimeout(() => {
      setUpdatingParams(prev => {
        const newSet = new Set(prev)
        newSet.delete(paramId)
        return newSet
      })
    }, 500)
  }, [onChange])

  const handleReset = useCallback(() => {
    setLocalValues({})
    setUpdatingParams(new Set())
    if (onReset) {
      onReset()
    }
  }, [onReset])

  // Update local values when parameters change externally
  useEffect(() => {
    const newLocalValues: Record<string, any> = {}
    parameters.forEach(param => {
      if (localValues[param.id] === undefined) {
        newLocalValues[param.id] = param.value
      } else {
        newLocalValues[param.id] = localValues[param.id]
      }
    })
    setLocalValues(newLocalValues)
  }, [parameters])

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
            <p className="text-xs text-slate-400 mt-1">This Grasshopper definition has no adjustable parameters</p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center">
            <Sliders className="w-5 h-5 mr-2" />
            Parameters ({parameters.length})
            {computing && (
              <span className="ml-2 text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded-full flex items-center">
                <Zap className="w-3 h-3 mr-1 animate-pulse" />
                Computing
              </span>
            )}
          </CardTitle>
          {onReset && (
            <button
              onClick={handleReset}
              disabled={computing}
              className="p-2 text-slate-500 hover:text-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Reset all parameters"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {parameters.map((param) => {
          const currentValue = localValues[param.id] !== undefined ? localValues[param.id] : param.value
          const hasChanged = currentValue !== param.value
          const isUpdating = updatingParams.has(param.id)

          return (
            <div key={param.id} className={`space-y-2 p-3 rounded-lg border transition-all duration-200 ${
              hasChanged ? 'bg-blue-50 border-blue-200' : 'bg-white border-slate-200'
            } ${isUpdating ? 'ring-2 ring-blue-300' : ''}`}>
              <Label htmlFor={param.id} className="text-sm font-medium flex items-center justify-between">
                <span>{param.name}</span>
                <div className="flex items-center space-x-2">
                  {isUpdating && (
                    <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded animate-pulse">
                      Updating...
                    </span>
                  )}
                  {hasChanged && !isUpdating && (
                    <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">
                      Modified
                    </span>
                  )}
                </div>
              </Label>

              {param.type === "number" && (
                <div className="space-y-2">
                  <Slider
                    id={param.id}
                    min={param.min || 0}
                    max={param.max || 100}
                    step={param.step || 1}
                    value={[currentValue]}
                    onValueChange={(value) => handleParameterChange(param.id, value[0])}
                    disabled={computing}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>{param.min || 0}</span>
                    <span className={`font-medium ${hasChanged ? 'text-blue-600' : ''}`}>
                      {currentValue}
                    </span>
                    <span>{param.max || 100}</span>
                  </div>
                </div>
              )}

              {param.type === "boolean" && (
                <div className="flex items-center space-x-2">
                  <Switch
                    id={param.id}
                    checked={currentValue}
                    onCheckedChange={(checked) => handleParameterChange(param.id, checked)}
                    disabled={computing}
                  />
                  <Label htmlFor={param.id} className={`text-sm ${hasChanged ? 'text-blue-600' : ''}`}>
                    {currentValue ? "On" : "Off"}
                  </Label>
                </div>
              )}

              {param.type === "color" && (
                <div className="flex items-center space-x-2">
                  <Input
                    id={param.id}
                    type="color"
                    value={currentValue}
                    onChange={(e) => handleParameterChange(param.id, e.target.value)}
                    disabled={computing}
                    className="w-16 h-10 p-1 border rounded"
                  />
                  <Input
                    value={currentValue}
                    onChange={(e) => handleParameterChange(param.id, e.target.value)}
                    disabled={computing}
                    className={`flex-1 ${hasChanged ? 'border-blue-300' : ''}`}
                    placeholder="#000000"
                  />
                </div>
              )}

              {param.type === "text" && (
                <Input
                  id={param.id}
                  value={currentValue}
                  onChange={(e) => handleParameterChange(param.id, e.target.value)}
                  disabled={computing}
                  className={hasChanged ? 'border-blue-300' : ''}
                  placeholder="Enter text..."
                />
              )}
            </div>
          )
        })}
      </CardContent>
    </Card>
  )
}
