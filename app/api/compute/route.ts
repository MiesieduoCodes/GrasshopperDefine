import { type NextRequest, NextResponse } from "next/server"
import { RhinoComputeService } from "@/lib/rhino-compute"
import { getDefinitions } from "@/lib/shared-storage"

export async function POST(request: NextRequest) {
  try {
    console.log("Compute request received")

    const { definitionId, parameters } = await request.json()

    if (!definitionId || !parameters) {
      console.log("Missing required parameters")
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 })
    }

    console.log(`Computing geometry for definition: ${definitionId}`)
    console.log(
      `Parameters:`,
      parameters.map((p: any) => `${p.name}: ${p.value}`),
    )

    // Get the stored definition from shared memory
    const definitions = getDefinitions()
    const storedDefinition = definitions.get(definitionId)
    if (!storedDefinition) {
      console.log("Definition not found in storage")
      return NextResponse.json({ error: "Definition not found" }, { status: 404 })
    }

    // Compute geometry using Rhino.Compute
    const computeResult = await RhinoComputeService.computeGeometry(storedDefinition.originalFileBuffer, parameters)

    console.log(`Generated geometry with ${computeResult.vertices.length / 3} vertices`)

    return NextResponse.json({
      geometry: computeResult,
      mesh: computeResult,
      curves: [],
      points: [],
      metadata: {
        computeTime: Date.now(),
        version: "7.0",
      },
      cached: false,
    })
  } catch (error) {
    console.error("Compute error:", error)
    return NextResponse.json({ error: "Failed to compute geometry. Please try again." }, { status: 500 })
  }
}
