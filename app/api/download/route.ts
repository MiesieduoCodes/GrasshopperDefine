import { type NextRequest, NextResponse } from "next/server"
import { RhinoComputeService } from "@/lib/rhino-compute"
import { getDefinitions } from "@/lib/shared-storage"

export async function POST(request: NextRequest) {
  try {
    console.log("Download request received")

    const { definitionId, parameters } = await request.json()

    if (!definitionId || !parameters) {
      console.log("Missing required parameters")
      return NextResponse.json({ error: "Missing required parameters" }, { status: 400 })
    }

    console.log(`Generating modified file for definition: ${definitionId}`)

    // Get the stored definition from shared storage
    const definitions = getDefinitions()
    const storedDefinition = definitions.get(definitionId)
    if (!storedDefinition) {
      console.log("Definition not found in storage")
      return NextResponse.json({ error: "Definition not found" }, { status: 404 })
    }

    // Generate modified file using the original buffer
    const modifiedFile = await RhinoComputeService.generateModifiedFile(storedDefinition.originalFileBuffer, parameters)
    console.log(`Generated modified file, size: ${modifiedFile.length} bytes`)

    // Create filename with timestamp and parameter info
    const timestamp = new Date().toISOString().replace(/[:.]/g, "-")
    const paramSummary = parameters
      .slice(0, 2)
      .map((p: any) => `${p.name}-${p.value}`)
      .join("_")
    const filename = `${storedDefinition.name}_${paramSummary}_${timestamp}.gh`

    return new NextResponse(modifiedFile, {
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": modifiedFile.length.toString(),
      },
    })
  } catch (error) {
    console.error("Download error:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to generate download. Please try again.",
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 },
    )
  }
}
