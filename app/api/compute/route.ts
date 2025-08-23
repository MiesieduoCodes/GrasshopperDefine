import { type NextRequest, NextResponse } from "next/server"
import { RhinoComputeService } from "@/lib/rhino-compute"
import { getDefinitions } from "@/lib/shared-storage"

export async function POST(request: NextRequest) {
  try {
    console.log("🔄 Compute request received")

    // Parse request with enhanced error handling
    let requestData
    try {
      requestData = await request.json()
    } catch (jsonError) {
      console.error("❌ Invalid JSON in request:", jsonError)
      return NextResponse.json({ 
        error: "Invalid JSON in request body", 
        details: jsonError instanceof Error ? jsonError.message : "JSON parsing error"
      }, { status: 400 })
    }

    const { definitionId, parameters } = requestData

    if (!definitionId || !parameters) {
      console.log("❌ Missing required parameters")
      return NextResponse.json({ 
        error: "Missing required parameters", 
        details: "Both definitionId and parameters are required"
      }, { status: 400 })
    }

    // Validate parameters array
    if (!Array.isArray(parameters)) {
      console.log("❌ Parameters must be an array")
      return NextResponse.json({ 
        error: "Invalid parameters format", 
        details: "Parameters must be an array"
      }, { status: 400 })
    }

    console.log(`🔍 Computing geometry for definition: ${definitionId}`)
    console.log(
      `📊 Parameters:`,
      parameters.map((p: any) => `${p.name}: ${p.value}`),
    )

    // Get the stored definition from shared memory with error handling
    let storedDefinition
    try {
      const definitions = getDefinitions()
      storedDefinition = definitions.get(definitionId)
      if (!storedDefinition) {
        console.log("❌ Definition not found in storage")
        return NextResponse.json({ 
          error: "Definition not found", 
          details: `No definition found with ID: ${definitionId}`
        }, { status: 404 })
      }
    } catch (storageError) {
      console.error("❌ Error accessing storage:", storageError)
      return NextResponse.json({ 
        error: "Storage access failed", 
        details: storageError instanceof Error ? storageError.message : "Storage error"
      }, { status: 500 })
    }

    // Compute geometry using Rhino.Compute with fallback
    let computeResult
    let usingFallback = false
    try {
      console.log("🔄 Attempting Rhino.Compute geometry generation...")
      computeResult = await RhinoComputeService.computeGeometry(storedDefinition.originalFileBuffer, parameters)
      console.log(`✅ Generated geometry with ${computeResult.vertices.length / 3} vertices`)
    } catch (computeError) {
      console.warn("⚠️ Rhino.Compute failed, using fallback geometry:", computeError)
      usingFallback = true
      
      // Fallback to basic parametric geometry
      computeResult = {
        vertices: [
          -1, -1, 0,  1, -1, 0,  1, 1, 0,  -1, 1, 0,  // Base square
          -1, -1, 1,  1, -1, 1,  1, 1, 1,  -1, 1, 1   // Top square
        ],
        faces: [
          0, 1, 2,  0, 2, 3,  // Bottom face
          4, 7, 6,  4, 6, 5,  // Top face
          0, 4, 5,  0, 5, 1,  // Front face
          2, 6, 7,  2, 7, 3,  // Back face
          0, 3, 7,  0, 7, 4,  // Left face
          1, 5, 6,  1, 6, 2   // Right face
        ],
        normals: []
      }
      
      console.log("📦 Using fallback cube geometry")
    }

    // Create response with comprehensive error information
    try {
      return NextResponse.json({
        geometry: computeResult,
        mesh: computeResult,
        curves: [],
        points: [],
        metadata: {
          computeTime: Date.now(),
          version: "7.0",
          usingFallback: usingFallback,
          fallbackReason: usingFallback ? "Rhino.Compute service unavailable" : null
        },
        cached: false,
        status: "success",
        message: usingFallback ? "Using fallback geometry - Rhino.Compute may be unavailable" : "Geometry computed successfully"
      })
    } catch (responseError) {
      console.error("❌ Failed to create response:", responseError)
      return NextResponse.json({ 
        error: "Failed to create response", 
        details: responseError instanceof Error ? responseError.message : "Response error"
      }, { status: 500 })
    }
  } catch (error) {
    console.error("❌ Unexpected compute error:", error)
    return NextResponse.json({ 
      error: "Failed to compute geometry", 
      details: error instanceof Error ? error.message : "Unexpected error occurred",
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 })
  }
}
