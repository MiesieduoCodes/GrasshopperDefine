"use client"

import { Suspense, useState, useEffect, useRef } from "react"

// Dynamic import to prevent SSR issues
let THREE: any = null

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

function ThreeDScene({ geometry }: { geometry: GeometryMesh }) {
  const [scene, setScene] = useState<any>(null)
  const [camera, setCamera] = useState<any>(null)
  const [renderer, setRenderer] = useState<any>(null)
  const [mesh, setMesh] = useState<any>(null)
  const [container, setContainer] = useState<HTMLDivElement | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const [hasError, setHasError] = useState(false)
  const animationRef = useRef<number>()

  useEffect(() => {
    // Dynamically import Three.js to prevent SSR issues
    const loadThreeJS = async () => {
      try {
        if (!THREE) {
          THREE = await import("three")
        }
      } catch (error) {
        console.error("Failed to load Three.js:", error)
        setHasError(true)
        return
      }
    }

    const initScene = async () => {
      if (!container || !geometry || !THREE) return

      try {
        // Initialize Three.js scene
        const newScene = new THREE.Scene()
        newScene.background = new THREE.Color(0xf8fafc) // slate-50

        // Camera setup
        const newCamera = new THREE.PerspectiveCamera(
          75,
          container.clientWidth / container.clientHeight,
          0.1,
          1000
        )
        newCamera.position.set(5, 5, 5)
        newCamera.lookAt(0, 0, 0)

        // Renderer setup
        const newRenderer = new THREE.WebGLRenderer({ antialias: true })
        newRenderer.setSize(container.clientWidth, container.clientHeight)
        newRenderer.shadowMap.enabled = true
        newRenderer.shadowMap.type = THREE.PCFSoftShadowMap

        // Clear previous content
        container.innerHTML = ""
        container.appendChild(newRenderer.domElement)

        // Lighting
        const ambientLight = new THREE.AmbientLight(0x404040, 0.4)
        newScene.add(ambientLight)

        const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
        directionalLight.position.set(10, 10, 5)
        directionalLight.castShadow = true
        newScene.add(directionalLight)

        // Create geometry from vertices and faces
        let newMesh: any = null
        if (geometry.vertices.length > 0 && geometry.faces.length > 0) {
          const geometryBuffer = new THREE.BufferGeometry()
          
          // Set vertices
          const vertices = new Float32Array(geometry.vertices)
          geometryBuffer.setAttribute('position', new THREE.BufferAttribute(vertices, 3))
          
          // Set faces (indices)
          const indices = new Uint32Array(geometry.faces)
          geometryBuffer.setIndex(new THREE.BufferAttribute(indices, 1))
          
          // Set normals if available, otherwise compute them
          if (geometry.normals && geometry.normals.length > 0) {
            const normals = new Float32Array(geometry.normals)
            geometryBuffer.setAttribute('normal', new THREE.BufferAttribute(normals, 3))
          } else {
            geometryBuffer.computeVertexNormals()
          }
          
          // Create material with better visual properties
          const material = new THREE.MeshStandardMaterial({
            color: 0x4ade80, // green-500
            transparent: true,
            opacity: 0.9,
            side: THREE.DoubleSide,
            metalness: 0.1,
            roughness: 0.3
          })
          
          // Create mesh
          newMesh = new THREE.Mesh(geometryBuffer, material)
          newMesh.castShadow = true
          newMesh.receiveShadow = true
          newScene.add(newMesh)
          setMesh(newMesh)
        }

        // Add grid helper
        const gridHelper = new THREE.GridHelper(20, 20, 0xe2e8f0, 0xcbd5e1)
        gridHelper.position.y = -2
        newScene.add(gridHelper)

        // Mouse controls
        const handleMouseDown = (event: MouseEvent) => {
          setIsDragging(true)
          setMousePosition({ x: event.clientX, y: event.clientY })
        }

        const handleMouseMove = (event: MouseEvent) => {
          if (isDragging && newMesh) {
            const deltaX = event.clientX - mousePosition.x
            const deltaY = event.clientY - mousePosition.y
            
            newMesh.rotation.y += deltaX * 0.01
            newMesh.rotation.x += deltaY * 0.01
            
            setMousePosition({ x: event.clientX, y: event.clientY })
          }
        }

        const handleMouseUp = () => {
          setIsDragging(false)
        }

        const handleWheel = (event: WheelEvent) => {
          if (newCamera) {
            const zoomSpeed = 0.1
            const zoom = event.deltaY > 0 ? 1 + zoomSpeed : 1 - zoomSpeed
            newCamera.position.multiplyScalar(zoom)
          }
        }

        // Add event listeners
        container.addEventListener('mousedown', handleMouseDown)
        container.addEventListener('mousemove', handleMouseMove)
        container.addEventListener('mouseup', handleMouseUp)
        container.addEventListener('wheel', handleWheel)

        // Animation loop
        const animate = () => {
          animationRef.current = requestAnimationFrame(animate)
          
          // Gentle rotation when not dragging
          if (newMesh && !isDragging) {
            newMesh.rotation.y += 0.005
          }
          
          newRenderer.render(newScene, newCamera)
        }
        animate()

        // Handle window resize
        const handleResize = () => {
          if (container) {
            const width = container.clientWidth
            const height = container.clientHeight
            
            newCamera.aspect = width / height
            newCamera.updateProjectionMatrix()
            newRenderer.setSize(width, height)
          }
        }
        window.addEventListener('resize', handleResize)

        // Store references
        setScene(newScene)
        setCamera(newCamera)
        setRenderer(newRenderer)

        // Cleanup
        return () => {
          window.removeEventListener('resize', handleResize)
          container.removeEventListener('mousedown', handleMouseDown)
          container.removeEventListener('mousemove', handleMouseMove)
          container.removeEventListener('mouseup', handleMouseUp)
          container.removeEventListener('wheel', handleWheel)
          
          if (animationRef.current) {
            cancelAnimationFrame(animationRef.current)
          }
          
          if (newRenderer) {
            newRenderer.dispose()
          }
          if (container) {
            container.innerHTML = ""
          }
        }
      } catch (error) {
        console.error("Error initializing Three.js scene:", error)
        setHasError(true)
      }
    }

    loadThreeJS().then(() => {
      if (!hasError) {
        initScene()
      }
    })
  }, [container, geometry, isDragging, mousePosition, hasError])

  if (hasError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-slate-100 rounded-lg">
        <div className="text-center">
          <div className="w-16 h-16 bg-red-500 rounded-full mx-auto mb-4 flex items-center justify-center">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
          </div>
          <p className="text-sm text-red-600">3D Viewer Error</p>
          <p className="text-xs text-red-400 mt-1">Failed to load 3D viewer</p>
        </div>
      </div>
    )
  }

  return (
    <div 
      ref={setContainer} 
      className="w-full h-full rounded-lg overflow-hidden cursor-grab active:cursor-grabbing"
      style={{ minHeight: '400px' }}
    />
  )
}

function GeometryRenderer({ geometry }: { geometry: GeometryMesh | null }) {
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
    return <ThreeDScene geometry={geometry} />
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
    <div className="w-full h-full flex items-center justify-center bg-slate-100 rounded-lg">
      <div className="text-center">
        <div className="w-16 h-16 bg-slate-300 rounded-full mx-auto mb-4 flex items-center justify-center">
          <svg className="w-8 h-8 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
          </svg>
        </div>
        <p className="text-sm text-slate-500">No Geometry Available</p>
        <p className="text-xs text-slate-400 mt-1">Upload a .gh file to see 3D preview</p>
      </div>
    </div>
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

      <div className="w-full h-full">
      <Suspense fallback={<LoadingFallback />}>
          <GeometryRenderer geometry={geometry} />
      </Suspense>
      </div>
    </div>
  )
}
