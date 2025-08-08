import { type NextRequest, NextResponse } from "next/server"
import { GrasshopperParser } from "@/lib/grasshopper-parser"
import { RhinoComputeService } from "@/lib/rhino-compute"
import { setDefinition, getAllDefinitions } from "@/lib/shared-storage"

export async function POST(request: NextRequest) {
  try {
    console.log("Upload request received")

    const formData = await request.formData()
    const file = formData.get("file") as File

    if (!file) {
      console.log("No file provided")
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    console.log(`File received: ${file.name}, size: ${file.size} bytes`)

    // Validate file type and size
    if (!file.name.endsWith(".gh")) {
      console.log("Invalid file type")
      return NextResponse.json({ error: "Invalid file type. Only .gh files are supported." }, { status: 400 })
    }

    if (file.size > 50 * 1024 * 1024) {
      console.log("File too large")
      return NextResponse.json({ error: "File too large. Maximum size is 50MB." }, { status: 400 })
    }

    if (file.size === 0) {
      console.log("File is empty")
      return NextResponse.json({ error: "File is empty." }, { status: 400 })
    }

    // Convert file to buffer for processing
    console.log("Converting file to buffer...")
    const fileBuffer = Buffer.from(await file.arrayBuffer())
    console.log(`Buffer created, size: ${fileBuffer.length} bytes`)

    // Validate Grasshopper file format
    console.log("Validating Grasshopper file format...")
    if (!GrasshopperParser.validateGrasshopperFile(fileBuffer)) {
      console.log("Invalid Grasshopper file format")
      return NextResponse.json({ error: "Invalid Grasshopper file format." }, { status: 400 })
    }

    // Parse the Grasshopper definition
    console.log("Parsing Grasshopper definition...")
    const parsedDefinition = await GrasshopperParser.parseDefinition(fileBuffer, file.name)
    console.log(`Parsed definition: ${parsedDefinition.name}`)
    console.log(
      `Found ${parsedDefinition.parameters.length} parameters:`,
      parsedDefinition.parameters.map((p) => `${p.name} (${p.type})`),
    )

    // Generate initial geometry using Rhino.Compute
    console.log("Generating initial geometry with Rhino.Compute...")
    
    // Convert parameters to the format expected by RhinoComputeService
    const parametersForCompute = parsedDefinition.parameters.map(param => ({
      id: param.id,
      name: param.name,
      type: param.type,
      value: param.value
    }))
    
    const initialGeometry = await RhinoComputeService.computeGeometry(fileBuffer, parametersForCompute)
    console.log(`Generated geometry with ${initialGeometry.vertices.length / 3} vertices`)

    // Store in memory with original file buffer
    const definitionId = `def_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    const definition = {
      ...parsedDefinition,
      id: definitionId,
      geometry: initialGeometry,
      originalFileBuffer: fileBuffer,
      uploadedAt: new Date().toISOString(),
    }

    setDefinition(definitionId, definition)
    console.log(`Definition stored with ID: ${definitionId}`)

    return NextResponse.json({
      id: definitionId,
      name: definition.name,
      description: definition.description,
      parameters: definition.parameters,
      geometry: definition.geometry,
      metadata: definition.metadata,
    })
  } catch (error) {
    console.error("Upload error:", error)
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to process definition. Please try again.",
        details: error instanceof Error ? error.stack : undefined,
      },
      { status: 500 },
    )
  }
}

// Add a GET endpoint to retrieve stored definitions
export async function GET() {
  try {
    const definitionList = getAllDefinitions().map((def) => ({
      id: def.id,
      name: def.name,
      description: def.description,
      parametersCount: def.parameters.length,
      uploadedAt: def.uploadedAt,
      metadata: def.metadata,
    }))

    return NextResponse.json(definitionList)
  } catch (error) {
    console.error("Get definitions error:", error)
    return NextResponse.json({ error: "Failed to retrieve definitions" }, { status: 500 })
  }
}
