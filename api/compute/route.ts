import { type NextRequest, NextResponse } from "next/server"
import { RhinoComputeService } from "@/lib/rhino-compute"

// Import the shared definitions map from upload API
// Since we can't directly import from another route, we'll use a shared module
import { getDefinitions } from "@/lib/shared-storage"

export async function POST(request: NextRequest) {
  try {
    const { definitionId, parameters } = await request.json()

    if (!definitionId || !parameters) {
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 })
    }

    // Get the stored definition from shared memory
    const definitions = getDefinitions()
    const storedDefinition = definitions.get(definitionId)
    if (!storedDefinition) {
      return NextResponse.json({ error: "Definition not found" }, { status: 404 })
    }

    // Convert parameters array to object
    const parameterValues = parameters.reduce((acc: Record<string, any>, param: any) => {
      acc[param.name.toLowerCase().replace(/\s+/g, "_")] = param.value
      return acc
    }, {})

    // Compute geometry using Rhino.Compute
    const computeResult = await RhinoComputeService.computeGeometry("", parameterValues)

    return NextResponse.json({
      geometry: computeResult.geometry[0],
      mesh: computeResult.geometry[0],
      curves: computeResult.curves,
      points: computeResult.points,
      metadata: computeResult.metadata,
      cached: false,
    })
  } catch (error) {
    console.error("Compute error:", error)
    return NextResponse.json({ error: "Failed to compute geometry. Please try again." }, { status: 500 })
  }
}
