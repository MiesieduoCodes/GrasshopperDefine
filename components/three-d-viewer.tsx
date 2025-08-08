"use client"

import { Canvas } from "@react-three/fiber"
import { OrbitControls, Environment, Grid } from "@react-three/drei"
import { Suspense, useState } from "react"

interface GeometryMesh {
  vertices: number[]
  faces: number[]
  normals?: number[]
  colors?: number[]
}

interface ThreeDViewerProps {
  geometry: GeometryMesh | null
  loading?: boolean
}

function GeometryRenderer({ geometry }: { geometry: GeometryMesh }) {
  const [hasError, setHasError] = useState(false)

  if (!geometry || !geometry.vertices || !geometry.faces) {
    return <DefaultGeometry />
  }

  // Validate geometry data
  if (geometry.vertices.length === 0 || geometry.faces.length === 0) {
    return <DefaultGeometry />
  }

  // Check if vertices array length is divisible by 3
  if (geometry.vertices.length % 3 !== 0) {
    console.error("Invalid vertices array length:", geometry.vertices.length)
    return <DefaultGeometry />
  }

  try {
    return (
      <mesh>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={geometry.vertices.length / 3}
            array={new Float32Array(geometry.vertices)}
            itemSize={3}
          />
          {geometry.normals && geometry.normals.length > 0 && (
            <bufferAttribute
              attach="attributes-normal"
              count={geometry.normals.length / 3}
              array={new Float32Array(geometry.normals)}
              itemSize={3}
            />
          )}
          <bufferAttribute attach="index" array={new Uint32Array(geometry.faces)} count={geometry.faces.length} />
        </bufferGeometry>
        <meshStandardMaterial color="#4ade80" wireframe={false} transparent opacity={0.9} />
      </mesh>
    )
  } catch (error) {
    console.error("Error rendering geometry:", error)
    if (!hasError) {
      setHasError(true)
    }
    return <DefaultGeometry />
  }
}

function DefaultGeometry() {
  return (
    <mesh>
      <boxGeometry args={[2, 2, 2]} />
      <meshStandardMaterial color="#94a3b8" wireframe />
    </mesh>
  )
}

function LoadingFallback() {
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-2"></div>
        <p className="text-sm text-slate-600">Loading 3D viewer...</p>
      </div>
    </div>
  )
}

export function ThreeDViewer({ geometry, loading }: ThreeDViewerProps) {
  return (
    <div className="w-full h-full relative">
      {loading && (
        <div className="absolute inset-0 bg-white/80 flex items-center justify-center z-10">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-600 mx-auto mb-2"></div>
            <p className="text-sm text-slate-600">Computing geometry...</p>
          </div>
        </div>
      )}

      <Suspense fallback={<LoadingFallback />}>
        <Canvas camera={{ position: [5, 5, 5], fov: 50 }}>
          <ambientLight intensity={0.4} />
          <directionalLight position={[10, 10, 5]} intensity={1} />

          {geometry ? <GeometryRenderer geometry={geometry} /> : <DefaultGeometry />}

          <Grid
            args={[20, 20]}
            position={[0, -2, 0]}
            cellSize={1}
            cellThickness={0.5}
            cellColor="#e2e8f0"
            sectionSize={5}
            sectionThickness={1}
            sectionColor="#cbd5e1"
            fadeDistance={25}
            fadeStrength={1}
          />

          <Environment preset="studio" />
          <OrbitControls enablePan={true} enableZoom={true} enableRotate={true} />
        </Canvas>
      </Suspense>
    </div>
  )
}
