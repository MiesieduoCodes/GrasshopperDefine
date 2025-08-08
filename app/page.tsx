"use client"

import type React from "react"

import { useState, useRef } from "react"
import { Button } from "@/components/ui/button"
import { Upload, FileText, Loader2 } from "lucide-react"
import { GrasshopperViewer } from "@/components/grasshopper-viewer"

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

export default function HomePage() {
  const [definition, setDefinition] = useState<Definition | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isDragActive, setIsDragActive] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleUpload = async (fileToUpload: File) => {
    setUploading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append("file", fileToUpload)

      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || "Upload failed")
      }

      const result = await response.json()
      setDefinition(result)
    } catch (error) {
      console.error("Upload error:", error)
      setError(error instanceof Error ? error.message : "Failed to process file. Please try again.")
    } finally {
      setUploading(false)
    }
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0]
    if (selectedFile && selectedFile.name.endsWith(".gh")) {
      handleUpload(selectedFile)
    } else if (selectedFile) {
      setError("Please select a .gh file")
    }
    // Reset the input
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const handleButtonClick = () => {
    fileInputRef.current?.click()
  }

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragActive(false)

    const files = Array.from(event.dataTransfer.files)
    const ghFile = files.find((file) => file.name.endsWith(".gh"))

    if (ghFile) {
      handleUpload(ghFile)
    } else {
      setError("Please drop a .gh file")
    }
  }

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragActive(true)
  }

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault()
    setIsDragActive(false)
  }

  const handleReset = () => {
    setDefinition(null)
    setError(null)
  }

  if (definition) {
    return <GrasshopperViewer definition={definition} onReset={handleReset} />
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Header */}
      <header className="border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center py-4">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg flex items-center justify-center">
                <FileText className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-semibold text-gray-900">Grasshopper Runner</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center">
          {/* Title */}
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            Visualize Grasshopper
            <br />
            Definitions
          </h1>

          <div className="flex items-center justify-center mb-8">
            <span className="text-xl text-gray-600 mr-3">100% Automatically and</span>
            <span className="bg-yellow-400 text-gray-900 px-3 py-1 rounded-full text-xl font-semibold">Free</span>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-600">{error}</p>
            </div>
          )}

          {/* Upload Area */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`relative border-2 border-dashed rounded-2xl p-16 transition-all duration-200 ${
              isDragActive ? "border-blue-500 bg-blue-50" : "border-gray-300 hover:border-gray-400"
            }`}
          >
            <input ref={fileInputRef} type="file" accept=".gh" onChange={handleFileSelect} className="hidden" />

            {uploading ? (
              <div className="flex flex-col items-center">
                <Loader2 className="w-12 h-12 text-blue-600 animate-spin mb-4" />
                <p className="text-lg text-gray-600">Processing your definition...</p>
              </div>
            ) : (
              <div className="flex flex-col items-center">
                <Button
                  size="lg"
                  className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-4 text-lg"
                  onClick={handleButtonClick}
                  disabled={uploading}
                >
                  <Upload className="w-5 h-5 mr-2" />
                  Upload Definition
                </Button>

                <p className="text-gray-500 mt-4">or drop a .gh file here</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}
