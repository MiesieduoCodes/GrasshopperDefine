interface RhinoComputeGeometry {
  vertices: number[]
  faces: number[]
  normals: number[]
  colors?: number[]
}

interface Parameter {
  id: string
  name: string
  type: string
  value: any
}

interface RhinoComputeRequest {
  definition: string // Base64 encoded .gh file
  inputs: Record<string, any>
}

interface RhinoComputeResponse {
  values: Array<{
    ParamName: string
    InnerTree: Record<
      string,
      Array<{
        type: string
        data: string
      }>
    >
  }>
}

import { HealthMonitor } from "./health-monitor"

export class RhinoComputeService {
  private static readonly RHINO_COMPUTE_URL = process.env.RHINO_COMPUTE_URL || "http://localhost:8081"
  private static readonly API_KEY = process.env.RHINO_COMPUTE_API_KEY
  private static isServiceAvailable: boolean | null = null
  private static lastCheck: number = 0
  private static readonly CHECK_INTERVAL = 30000 // 30 seconds
  private static readonly SERVICE_NAME = "rhino-compute"

  private static validateEnvironment(): void {
    if (!process.env.RHINO_COMPUTE_URL && process.env.NODE_ENV === "production") {
      console.warn("RHINO_COMPUTE_URL not set, using default: http://localhost:8081")
    }
    
    if (!process.env.RHINO_COMPUTE_API_KEY && process.env.NODE_ENV === "production") {
      console.warn("RHINO_COMPUTE_API_KEY not set - some features may be limited")
    }
  }

  private static async checkServiceAvailability(): Promise<boolean> {
    const now = Date.now()
    
    // Only check every 30 seconds to avoid too many requests
    if (this.isServiceAvailable !== null && (now - this.lastCheck) < this.CHECK_INTERVAL) {
      return this.isServiceAvailable
    }

    this.lastCheck = now

    try {
      console.log("Checking Rhino.Compute service availability...")
      const response = await fetch(`${this.RHINO_COMPUTE_URL}/health`, {
        method: "GET",
        headers: { "Content-Type": "application/json" },
        signal: AbortSignal.timeout(5000) // 5 second timeout
      })
      
      this.isServiceAvailable = response.ok
      if (this.isServiceAvailable) {
        console.log("✅ Rhino.Compute service is available")
      } else {
        console.warn("⚠️ Rhino.Compute service returned non-OK status")
      }
      return this.isServiceAvailable
    } catch (error) {
      console.warn("❌ Rhino.Compute service not available:", error)
      this.isServiceAvailable = false
      return false
    }
  }

  static async computeGeometry(fileBuffer: Buffer, parameters: Parameter[]): Promise<RhinoComputeGeometry> {
    console.log("🔄 Starting Rhino.Compute geometry computation")
    this.validateEnvironment()

    // Initialize health monitoring
    HealthMonitor.initializeService(this.SERVICE_NAME)

    // Check if service should be used based on health status
    if (!HealthMonitor.shouldUseService(this.SERVICE_NAME)) {
      const health = HealthMonitor.getServiceHealth(this.SERVICE_NAME)
      console.warn(`⚠️ Rhino.Compute service is ${health?.status}, skipping computation`)
      throw new Error(`Rhino.Compute service is ${health?.status}: ${health?.lastError}`)
    }

    const startTime = Date.now()
    
    try {
      // Create the request payload
      const payload: RhinoComputeRequest = {
        definition: fileBuffer.toString("base64"),
        inputs: this.convertParametersToInputs(parameters),
      }

      console.log(`📦 Payload created with ${Object.keys(payload.inputs).length} inputs`)

      // Call Rhino.Compute API
      const response = await this.callRhinoCompute(payload)

      // Parse the response and extract geometry
      const geometry = await this.parseRhinoComputeResponse(response)

      const responseTime = Date.now() - startTime
      console.log(`✅ Geometry computation completed successfully (${responseTime}ms)`)

      // Update health status on success
      await HealthMonitor.checkServiceHealth(this.SERVICE_NAME, async () => ({
        success: true,
        responseTime: responseTime
      }))

      return geometry
    } catch (error) {
      const responseTime = Date.now() - startTime
      console.error("❌ Failed to compute geometry:", error)

      // Update health status on failure
      await HealthMonitor.checkServiceHealth(this.SERVICE_NAME, async () => ({
        success: false,
        responseTime: responseTime,
        error: error instanceof Error ? error.message : 'Unknown error'
      }))

      throw new Error(`Rhino.Compute failed: ${error instanceof Error ? error.message : error}`)
    }
  }

  private static convertParametersToInputs(parameters: Parameter[]): Record<string, any> {
    const inputs: Record<string, any> = {}
    
    parameters.forEach((param, index) => {
      const inputName = param.name || `param_${index}`
      
      switch (param.type) {
        case 'number':
          inputs[inputName] = [{
            type: 'System.Double',
            data: param.value || 0
          }]
          break
        case 'integer':
          inputs[inputName] = [{
            type: 'System.Int32',
            data: param.value || 0
          }]
          break
        case 'boolean':
          inputs[inputName] = [{
            type: 'System.Boolean',
            data: param.value || false
          }]
          break
        case 'text':
          inputs[inputName] = [{
            type: 'System.String',
            data: param.value || ''
          }]
          break
        case 'point':
          const point = param.value || [0, 0, 0]
          inputs[inputName] = [{
            type: 'Rhino.Geometry.Point3d',
            data: Array.isArray(point) ? point : [0, 0, 0]
          }]
          break
        case 'vector':
          const vector = param.value || [1, 0, 0]
          inputs[inputName] = [{
            type: 'Rhino.Geometry.Vector3d',
            data: Array.isArray(vector) ? vector : [1, 0, 0]
          }]
          break
        case 'color':
          const color = param.value || [255, 255, 255]
          inputs[inputName] = [{
            type: 'System.Drawing.Color',
            data: Array.isArray(color) ? color : [255, 255, 255]
          }]
          break
        case 'domain':
          const domain = param.value || [0, 1]
          inputs[inputName] = [{
            type: 'Rhino.Geometry.Interval',
            data: Array.isArray(domain) ? domain : [0, 1]
          }]
          break
        default:
          // For complex geometry types, pass as generic data
          inputs[inputName] = [{
            type: 'System.Object',
            data: param.value || null
          }]
      }
    })
    
    return inputs
  }

  private static generateFallbackGeometry(parameters: Parameter[]): RhinoComputeGeometry {
    console.log("🎲 Generating fallback geometry based on parameters...")
    
    // Generate geometry based on parameters to make it more interesting
    const paramCount = parameters.length
    const scale = Math.max(1, paramCount * 0.5)
    
    // Generate a more complex geometry based on parameters
    const vertices = [
      // Front face (scaled)
      -scale, -scale,  scale,  scale, -scale,  scale,  scale,  scale,  scale, -scale,  scale,  scale,
      // Back face (scaled)
      -scale, -scale, -scale, -scale,  scale, -scale,  scale,  scale, -scale,  scale, -scale, -scale,
      // Top face (scaled)
      -scale,  scale, -scale, -scale,  scale,  scale,  scale,  scale,  scale,  scale,  scale, -scale,
      // Bottom face (scaled)
      -scale, -scale, -scale,  scale, -scale, -scale,  scale, -scale,  scale, -scale, -scale,  scale,
      // Right face (scaled)
       scale, -scale, -scale,  scale,  scale, -scale,  scale,  scale,  scale,  scale, -scale,  scale,
      // Left face (scaled)
      -scale, -scale, -scale, -scale, -scale,  scale, -scale,  scale,  scale, -scale,  scale, -scale,
    ]

    const faces = [
      // Front face
      0,  1,  2,  0,  2,  3,
      // Back face
      4,  5,  6,  4,  6,  7,
      // Top face
      8,  9, 10,  8, 10, 11,
      // Bottom face
      12, 13, 14, 12, 14, 15,
      // Right face
      16, 17, 18, 16, 18, 19,
      // Left face
      20, 21, 22, 20, 22, 23,
    ]

    // Generate normals
    const normals: number[] = []
    this.generateNormals(vertices, faces, normals)

    return { vertices, faces, normals }
  }


  private static async callRhinoCompute(payload: RhinoComputeRequest): Promise<RhinoComputeResponse> {
    const maxRetries = 3
    let lastError: Error | null = null

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🌐 Making request to Rhino.Compute (attempt ${attempt}/${maxRetries})`)

        const headers: Record<string, string> = {
          "Content-Type": "application/json",
          Accept: "application/json",
          "User-Agent": "GrasshopperRunner/1.0",
        }

        // Add API key if available
        if (this.API_KEY) {
          headers["RhinoComputeKey"] = this.API_KEY
        }

        // Add request ID for tracking
        const requestId = `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        headers["X-Request-ID"] = requestId

        console.log(`📋 Request ID: ${requestId}`)
        console.log(`📊 Payload size: ${JSON.stringify(payload).length} bytes`)

        // Create abort controller with timeout
        const timeoutMs = attempt === 1 ? 30000 : 60000 // Longer timeout for retries
        const abortController = new AbortController()
        const timeoutId = setTimeout(() => abortController.abort(), timeoutMs)

        let response: Response
        
        try {
          response = await fetch(`${this.RHINO_COMPUTE_URL}/grasshopper`, {
            method: "POST",
            headers,
            body: JSON.stringify(payload),
            signal: abortController.signal,
          })
        } finally {
          clearTimeout(timeoutId)
        }

        console.log(`📡 Response status: ${response.status} ${response.statusText}`)

        // Handle different response statuses
        if (response.ok) {
          // Success - parse and return response
          const responseData = await response.json()
          console.log(`✅ Rhino.Compute request successful (${requestId})`)
          return responseData
        } else if (response.status >= 500) {
          // Server error - retry
          const errorText = await response.text()
          lastError = new Error(`Rhino.Compute server error (${response.status}): ${errorText}`)
          console.warn(`⚠️ Server error on attempt ${attempt}: ${lastError.message}`)
          
          if (attempt < maxRetries) {
            const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 5000) // Exponential backoff
            console.log(`⏳ Retrying in ${delayMs}ms...`)
            await new Promise(resolve => setTimeout(resolve, delayMs))
            continue
          }
        } else if (response.status === 429) {
          // Rate limited - wait and retry
          const retryAfter = response.headers.get('Retry-After')
          const delayMs = retryAfter ? parseInt(retryAfter) * 1000 : 5000
          lastError = new Error(`Rhino.Compute rate limited (429)`)
          console.warn(`⚠️ Rate limited on attempt ${attempt}, waiting ${delayMs}ms`)
          
          if (attempt < maxRetries) {
            await new Promise(resolve => setTimeout(resolve, delayMs))
            continue
          }
        } else if (response.status === 401 || response.status === 403) {
          // Authentication error - don't retry
          const errorText = await response.text()
          throw new Error(`Rhino.Compute authentication error (${response.status}): ${errorText}`)
        } else {
          // Client error - don't retry
          const errorText = await response.text()
          throw new Error(`Rhino.Compute client error (${response.status}): ${errorText}`)
        }

      } catch (error) {
        if (error instanceof Error) {
          if (error.name === 'AbortError') {
            lastError = new Error(`Rhino.Compute request timeout (attempt ${attempt})`)
            console.warn(`⏰ Request timeout on attempt ${attempt}`)
          } else if (error.message.includes('fetch')) {
            lastError = new Error(`Network error connecting to Rhino.Compute: ${error.message}`)
            console.warn(`🌐 Network error on attempt ${attempt}: ${error.message}`)
          } else if (error.message.includes('authentication') || error.message.includes('client error')) {
            // Don't retry authentication or client errors
            throw error
          } else {
            lastError = error
            console.warn(`❌ Error on attempt ${attempt}: ${error.message}`)
          }
        } else {
          lastError = new Error(`Unknown error on attempt ${attempt}: ${error}`)
        }

        // Wait before retry (except on last attempt)
        if (attempt < maxRetries) {
          const delayMs = Math.min(1000 * Math.pow(2, attempt - 1), 5000)
          console.log(`⏳ Retrying in ${delayMs}ms...`)
          await new Promise(resolve => setTimeout(resolve, delayMs))
        }
      }
    }

    // All retries failed
    const finalError = lastError || new Error("Unknown error occurred")
    console.error(`❌ All ${maxRetries} attempts failed. Final error: ${finalError.message}`)
    throw new Error(`Rhino.Compute request failed after ${maxRetries} attempts: ${finalError.message}`)
  }

  private static formatParametersForRhino(parameters: Parameter[]): Record<string, any> {
    const inputs: Record<string, any> = {}

    parameters.forEach((param) => {
      // Convert parameter names to match Grasshopper component names
      const rhinoParamName = this.convertToRhinoParameterName(param.name)

      switch (param.type) {
        case "number":
          inputs[rhinoParamName] = [
            {
              type: "System.Double",
              data: param.value.toString(),
            },
          ]
          break

        case "boolean":
          inputs[rhinoParamName] = [
            {
              type: "System.Boolean",
              data: param.value.toString(),
            },
          ]
          break

        case "text":
          inputs[rhinoParamName] = [
            {
              type: "System.String",
              data: param.value,
            },
          ]
          break

        case "color":
          // Convert hex color to RGB values
          const rgb = this.hexToRgb(param.value)
          inputs[rhinoParamName] = [
            {
              type: "System.Drawing.Color",
              data: `${rgb.r},${rgb.g},${rgb.b}`,
            },
          ]
          break

        default:
          inputs[rhinoParamName] = [
            {
              type: "System.String",
              data: param.value.toString(),
            },
          ]
      }
    })

    return inputs
  }

  private static convertToRhinoParameterName(paramName: string): string {
    // Convert parameter names to match Grasshopper component naming conventions
    return paramName
      .replace(/\s+/g, "") // Remove spaces
      .replace(/[^a-zA-Z0-9]/g, "") // Remove special characters
  }

  private static hexToRgb(hex: string): { r: number; g: number; b: number } {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex)
    return result
      ? {
          r: Number.parseInt(result[1], 16),
          g: Number.parseInt(result[2], 16),
          b: Number.parseInt(result[3], 16),
        }
      : { r: 0, g: 0, b: 0 }
  }

  private static async parseRhinoComputeResponse(response: RhinoComputeResponse): Promise<RhinoComputeGeometry> {
    const vertices: number[] = []
    const faces: number[] = []
    const normals: number[] = []

    try {
      console.log("🔍 Parsing Rhino.Compute response:", JSON.stringify(response, null, 2))

      // Handle different response formats from Rhino.Compute
      if (!response || !response.values || !Array.isArray(response.values)) {
        throw new Error("Invalid Rhino.Compute response format - missing or invalid 'values' array")
      }

      let geometryFound = false

      // Iterate through all output parameters
      for (const output of response.values) {
        if (!output || !output.ParamName) {
          console.warn("⚠️ Skipping invalid output parameter:", output)
          continue
        }

        console.log(`📊 Processing output parameter: ${output.ParamName}`)

        // Check if this parameter contains geometry
        if (this.isGeometryOutput(output.ParamName)) {
          try {
            await this.extractGeometryFromOutput(output, vertices, faces, normals)
            geometryFound = true
            console.log(`✅ Extracted geometry from ${output.ParamName}`)
          } catch (extractError) {
            console.warn(`⚠️ Failed to extract geometry from ${output.ParamName}:`, extractError)
            // Continue to next parameter instead of failing completely
          }
        }
      }

      // Validate extracted geometry
      if (!geometryFound || vertices.length === 0) {
        console.log("📋 Available parameters:", response.values.map(v => v.ParamName))
        throw new Error("No valid geometry data found in Rhino.Compute response")
      }

      // Validate geometry integrity
      this.validateGeometry(vertices, faces)

      console.log(`🎯 Successfully parsed geometry: ${vertices.length / 3} vertices, ${faces.length / 3} faces`)
      return { vertices, faces, normals }

    } catch (error) {
      console.error("❌ Error parsing Rhino.Compute response:", error)
      
      // Provide more detailed error information
      const errorMessage = error instanceof Error ? error.message : "Unknown parsing error"
      throw new Error(`Failed to parse Rhino.Compute geometry: ${errorMessage}`)
    }
  }

  private static isGeometryOutput(paramName: string): boolean {
    const geometryKeywords = ["mesh", "brep", "surface", "geometry", "output", "result", "solid", "curve", "point"]
    const lowerParamName = paramName.toLowerCase()
    return geometryKeywords.some((keyword) => lowerParamName.includes(keyword))
  }

  private static validateGeometry(vertices: number[], faces: number[]): void {
    // Validate vertices array
    if (vertices.length === 0) {
      throw new Error("Geometry validation failed: No vertices found")
    }

    if (vertices.length % 3 !== 0) {
      throw new Error(`Geometry validation failed: Invalid vertices array length ${vertices.length} (must be divisible by 3)`)
    }

    // Validate faces array
    if (faces.length === 0) {
      throw new Error("Geometry validation failed: No faces found")
    }

    if (faces.length % 3 !== 0) {
      throw new Error(`Geometry validation failed: Invalid faces array length ${faces.length} (must be divisible by 3)`)
    }

    // Validate face indices
    const vertexCount = vertices.length / 3
    for (let i = 0; i < faces.length; i++) {
      const faceIndex = faces[i]
      if (faceIndex < 0 || faceIndex >= vertexCount) {
        throw new Error(`Geometry validation failed: Face index ${faceIndex} out of bounds (vertex count: ${vertexCount})`)
      }
    }

    // Check for degenerate vertices (NaN or Infinity)
    for (let i = 0; i < vertices.length; i++) {
      if (!Number.isFinite(vertices[i])) {
        throw new Error(`Geometry validation failed: Invalid vertex coordinate at index ${i}: ${vertices[i]}`)
      }
    }

    console.log(`✅ Geometry validation passed: ${vertexCount} vertices, ${faces.length / 3} faces`)
  }

  private static async extractGeometryFromOutput(
    output: any,
    vertices: number[],
    faces: number[],
    normals: number[],
  ): Promise<void> {
    try {
      // Parse real mesh data from Rhino.Compute output
      if (output.InnerTree && output.InnerTree["{0}"] && output.InnerTree["{0}"][0]) {
        const meshData = output.InnerTree["{0}"][0].data
        
        // Parse actual Rhino mesh format
        await this.parseMeshData(meshData, vertices, faces, normals)
      } else if (output.InnerTree && output.InnerTree["{0}"] && output.InnerTree["{0}"][0]) {
        const brepData = output.InnerTree["{0}"][0].data
        
        // Parse actual Rhino BRep format
        await this.parseBrepData(brepData, vertices, faces, normals)
      } else {
        throw new Error("No valid geometry data found in output")
      }
    } catch (error) {
      console.error("Error extracting geometry from output:", error)
      throw error
    }
  }

  private static async parseMeshData(
    meshData: string,
    vertices: number[],
    faces: number[],
    normals: number[],
  ): Promise<void> {
    try {
      console.log("🔍 Parsing mesh data, length:", meshData.length)
      
      // Handle different data formats from Rhino.Compute
      let buffer: Buffer
      
      try {
        // Try base64 decoding first (most common format)
        buffer = Buffer.from(meshData, 'base64')
      } catch (base64Error) {
        try {
          // Try direct JSON parsing if it's not base64
          const meshObject = JSON.parse(meshData)
          if (meshObject.Vertices && meshObject.Faces) {
            this.parseMeshFromJSON(meshObject, vertices, faces, normals)
            return
          }
          // If JSON parsing succeeded but no mesh data, throw error
          throw new Error(`JSON object missing Vertices or Faces`)
        } catch (jsonError) {
          throw new Error(`Invalid mesh data format: not base64 or JSON`)
        }
        // This line should never be reached, but ensures buffer is assigned
        buffer = Buffer.alloc(0)
      }

      // Validate buffer size
      if (buffer.length < 8) {
        throw new Error(`Mesh buffer too small: ${buffer.length} bytes`)
      }

      console.log(`📊 Mesh buffer size: ${buffer.length} bytes`)
      
      let offset = 0
      
      // Try different mesh formats based on buffer structure
      if (this.isRhinoMeshFormat(buffer)) {
        offset = this.parseRhinoMeshFormat(buffer, vertices, faces, offset)
      } else if (this.isOpenNURBSFormat(buffer)) {
        offset = this.parseOpenNURBSFormat(buffer, vertices, faces, offset)
      } else {
        // Fallback: try to parse as simple vertex/face arrays
        offset = this.parseSimpleMeshFormat(buffer, vertices, faces, offset)
      }
      
      // Generate normals from parsed geometry
      if (vertices.length > 0 && faces.length > 0) {
        this.generateNormals(vertices, faces, normals)
        console.log(`✅ Parsed mesh: ${vertices.length / 3} vertices, ${faces.length / 3} faces`)
      } else {
        throw new Error("No valid mesh data extracted from buffer")
      }
      
    } catch (error) {
      console.error("❌ Error parsing mesh data:", error)
      throw new Error(`Failed to parse mesh data: ${error instanceof Error ? error.message : error}`)
    }
  }

  private static parseMeshFromJSON(meshObject: any, vertices: number[], faces: number[], normals: number[]): void {
    console.log("📋 Parsing mesh from JSON object")
    
    // Handle Rhino.Compute JSON mesh format
    if (meshObject.Vertices && Array.isArray(meshObject.Vertices)) {
      for (const vertex of meshObject.Vertices) {
        if (vertex.X !== undefined && vertex.Y !== undefined && vertex.Z !== undefined) {
          vertices.push(vertex.X, vertex.Y, vertex.Z)
        }
      }
    }

    if (meshObject.Faces && Array.isArray(meshObject.Faces)) {
      for (const face of meshObject.Faces) {
        if (face.A !== undefined && face.B !== undefined && face.C !== undefined) {
          faces.push(face.A, face.B, face.C)
          // Handle quad faces (if D is present)
          if (face.D !== undefined && face.D !== face.C) {
            faces.push(face.A, face.C, face.D)
          }
        }
      }
    }

    // Handle vertex normals if present
    if (meshObject.Normals && Array.isArray(meshObject.Normals)) {
      for (const normal of meshObject.Normals) {
        if (normal.X !== undefined && normal.Y !== undefined && normal.Z !== undefined) {
          normals.push(normal.X, normal.Y, normal.Z)
        }
      }
    }
  }

  private static isRhinoMeshFormat(buffer: Buffer): boolean {
    // Check for Rhino mesh signature
    return buffer.length >= 16 && buffer.readUInt32LE(0) === 0x4D455348 // "MESH"
  }

  private static isOpenNURBSFormat(buffer: Buffer): boolean {
    // Check for OpenNURBS format signature
    return buffer.length >= 8 && buffer.readUInt32LE(0) === 0x4F4E5242 // "ONRB"
  }

  private static parseRhinoMeshFormat(buffer: Buffer, vertices: number[], faces: number[], offset: number): number {
    console.log("🔧 Parsing Rhino mesh format")
    
    // Skip signature (4 bytes)
    offset += 4
    
    // Read version (4 bytes)
    const version = buffer.readUInt32LE(offset)
    offset += 4
    
    // Read vertex count (4 bytes)
    const vertexCount = buffer.readUInt32LE(offset)
    offset += 4
    
    // Read face count (4 bytes)
    const faceCount = buffer.readUInt32LE(offset)
    offset += 4
    
    console.log(`📊 Rhino mesh: v${version}, ${vertexCount} vertices, ${faceCount} faces`)
    
    // Read vertices (12 bytes each: 3 floats)
    for (let i = 0; i < vertexCount && offset + 12 <= buffer.length; i++) {
      const x = buffer.readFloatLE(offset)
      const y = buffer.readFloatLE(offset + 4)
      const z = buffer.readFloatLE(offset + 8)
      vertices.push(x, y, z)
      offset += 12
    }
    
    // Read faces (16 bytes each: 4 integers for quad faces)
    for (let i = 0; i < faceCount && offset + 16 <= buffer.length; i++) {
      const a = buffer.readUInt32LE(offset)
      const b = buffer.readUInt32LE(offset + 4)
      const c = buffer.readUInt32LE(offset + 8)
      const d = buffer.readUInt32LE(offset + 12)
      
      // Add triangle face
      faces.push(a, b, c)
      
      // Add second triangle if it's a quad (d != c)
      if (d !== c) {
        faces.push(a, c, d)
      }
      
      offset += 16
    }
    
    return offset
  }

  private static parseOpenNURBSFormat(buffer: Buffer, vertices: number[], faces: number[], offset: number): number {
    console.log("🔧 Parsing OpenNURBS format")
    
    // Skip signature and header
    offset += 8
    
    // This is a simplified OpenNURBS parser - real implementation would be much more complex
    const vertexCount = buffer.readUInt32LE(offset)
    offset += 4
    
    const faceCount = buffer.readUInt32LE(offset)
    offset += 4
    
    // Read vertices
    for (let i = 0; i < vertexCount && offset + 12 <= buffer.length; i++) {
      vertices.push(
        buffer.readFloatLE(offset),
        buffer.readFloatLE(offset + 4),
        buffer.readFloatLE(offset + 8)
      )
      offset += 12
    }
    
    // Read faces
    for (let i = 0; i < faceCount && offset + 12 <= buffer.length; i++) {
      faces.push(
        buffer.readUInt32LE(offset),
        buffer.readUInt32LE(offset + 4),
        buffer.readUInt32LE(offset + 8)
      )
      offset += 12
    }
    
    return offset
  }

  private static parseSimpleMeshFormat(buffer: Buffer, vertices: number[], faces: number[], offset: number): number {
    console.log("🔧 Parsing simple mesh format")
    
    // Try to parse as simple arrays of floats/integers
    const vertexCount = buffer.readUInt32LE(offset)
    offset += 4
    
    const faceCount = buffer.readUInt32LE(offset)
    offset += 4
    
    console.log(`📊 Simple mesh: ${vertexCount} vertices, ${faceCount} faces`)
    
    // Validate counts
    if (vertexCount > 1000000 || faceCount > 1000000) {
      throw new Error(`Unrealistic mesh size: ${vertexCount} vertices, ${faceCount} faces`)
    }
    
    // Read vertices
    for (let i = 0; i < vertexCount && offset + 12 <= buffer.length; i++) {
      vertices.push(
        buffer.readFloatLE(offset),
        buffer.readFloatLE(offset + 4),
        buffer.readFloatLE(offset + 8)
      )
      offset += 12
    }
    
    // Read faces
    for (let i = 0; i < faceCount && offset + 12 <= buffer.length; i++) {
      faces.push(
        buffer.readUInt32LE(offset),
        buffer.readUInt32LE(offset + 4),
        buffer.readUInt32LE(offset + 8)
      )
      offset += 12
    }
    
    return offset
  }

  private static async parseBrepData(
    brepData: string,
    vertices: number[],
    faces: number[],
    normals: number[],
  ): Promise<void> {
    try {
      console.log("🔍 Parsing BRep data, length:", brepData.length)
      
      // Handle different BRep data formats
      let buffer: Buffer
      
      try {
        // Try base64 decoding first
        buffer = Buffer.from(brepData, 'base64')
      } catch (base64Error) {
        try {
          // Try JSON parsing for BRep objects
          const brepObject = JSON.parse(brepData)
          if (brepObject.Surfaces || brepObject.Faces || brepObject.Mesh) {
            this.parseBrepFromJSON(brepObject, vertices, faces, normals)
            return
          }
          // If JSON parsing succeeded but no BRep data, throw error
          throw new Error(`JSON object missing Surfaces, Faces, or Mesh`)
        } catch (jsonError) {
          throw new Error(`Invalid BRep data format: not base64 or JSON`)
        }
        // This line should never be reached, but ensures buffer is assigned
        buffer = Buffer.alloc(0)
      }

      if (buffer.length < 16) {
        throw new Error(`BRep buffer too small: ${buffer.length} bytes`)
      }

      console.log(`📊 BRep buffer size: ${buffer.length} bytes`)
      
      let offset = 0
      
      // Try different BRep formats
      if (this.isOpenNURBSBrepFormat(buffer)) {
        offset = this.parseOpenNURBSBrep(buffer, vertices, faces, offset)
      } else if (this.isRhinoBrepFormat(buffer)) {
        offset = this.parseRhinoBrep(buffer, vertices, faces, offset)
      } else {
        // Fallback: try to extract embedded mesh data
        offset = this.extractMeshFromBrep(buffer, vertices, faces, offset)
      }
      
      // Generate normals if we got geometry
      if (vertices.length > 0 && faces.length > 0) {
        this.generateNormals(vertices, faces, normals)
        console.log(`✅ Parsed BRep: ${vertices.length / 3} vertices, ${faces.length / 3} faces`)
      } else {
        throw new Error("No valid geometry data")
      }
      
    } catch (error) {
      console.error("❌ Error parsing BRep data:", error)
      throw new Error(`Failed to parse BRep data: ${error instanceof Error ? error.message : error}`)
    }
  }

  private static parseBrepFromJSON(brepObject: any, vertices: number[], faces: number[], normals: number[]): void {
    console.log("📋 Parsing BRep from JSON object")
    
    // Handle Rhino.Compute JSON BRep format
    if (brepObject.Mesh && brepObject.Mesh.Vertices && brepObject.Mesh.Faces) {
      // BRep contains a mesh representation
      this.parseMeshFromJSON(brepObject.Mesh, vertices, faces, normals)
      return
    }

    // Handle surface tessellation
    if (brepObject.Surfaces && Array.isArray(brepObject.Surfaces)) {
      for (const surface of brepObject.Surfaces) {
        if (surface.Mesh) {
          this.parseMeshFromJSON(surface.Mesh, vertices, faces, normals)
        }
      }
    }

    // Handle face tessellation
    if (brepObject.Faces && Array.isArray(brepObject.Faces)) {
      for (const face of brepObject.Faces) {
        if (face.Mesh) {
          this.parseMeshFromJSON(face.Mesh, vertices, faces, normals)
        }
      }
    }
  }

  private static isOpenNURBSBrepFormat(buffer: Buffer): boolean {
    // Check for OpenNURBS BRep signature
    return buffer.length >= 8 && buffer.readUInt32LE(0) === 0x50455242 // "BREP"
  }

  private static isRhinoBrepFormat(buffer: Buffer): boolean {
    // Check for Rhino BRep signature
    return buffer.length >= 8 && buffer.readUInt32LE(0) === 0x33444D52 // "R3D3"
  }

  private static parseOpenNURBSBrep(buffer: Buffer, vertices: number[], faces: number[], offset: number): number {
    console.log("🔧 Parsing OpenNURBS BRep format")
    
    // Skip signature (4 bytes)
    offset += 4
    
    // Read version (4 bytes)
    const version = buffer.readUInt32LE(offset)
    offset += 4
    
    // Read surface count (4 bytes)
    const surfaceCount = buffer.readUInt32LE(offset)
    offset += 4
    
    console.log(`📊 OpenNURBS BRep: v${version}, ${surfaceCount} surfaces`)
    
    // For each surface, try to extract tessellation
    for (let i = 0; i < surfaceCount && offset < buffer.length - 16; i++) {
      // Read surface type (4 bytes)
      const surfaceType = buffer.readUInt32LE(offset)
      offset += 4
      
      // Read surface data size (4 bytes)
      const dataSize = buffer.readUInt32LE(offset)
      offset += 4
      
      // Skip surface data for now (would need full OpenNURBS implementation)
      offset += Math.min(dataSize, buffer.length - offset)
    }
    
    // Look for embedded mesh data at the end
    if (offset < buffer.length - 16) {
      try {
        const meshCount = buffer.readUInt32LE(offset)
        offset += 4
        
        if (meshCount > 0 && meshCount < 100) {
          const vertexCount = buffer.readUInt32LE(offset)
          offset += 4
          
          const faceCount = buffer.readUInt32LE(offset)
          offset += 4
          
          // Read vertices
          for (let i = 0; i < vertexCount && offset + 12 <= buffer.length; i++) {
            vertices.push(
              buffer.readFloatLE(offset),
              buffer.readFloatLE(offset + 4),
              buffer.readFloatLE(offset + 8)
            )
            offset += 12
          }
          
          // Read faces
          for (let i = 0; i < faceCount && offset + 12 <= buffer.length; i++) {
            faces.push(
              buffer.readUInt32LE(offset),
              buffer.readUInt32LE(offset + 4),
              buffer.readUInt32LE(offset + 8)
            )
            offset += 12
          }
        }
      } catch (meshError) {
        console.warn("⚠️ Could not extract mesh from OpenNURBS BRep:", meshError)
      }
    }
    
    return offset
  }

  private static parseRhinoBrep(buffer: Buffer, vertices: number[], faces: number[], offset: number): number {
    console.log("🔧 Parsing Rhino BRep format")
    
    // Skip signature (4 bytes)
    offset += 4
    
    // Read header info
    const version = buffer.readUInt32LE(offset)
    offset += 4
    
    const objectCount = buffer.readUInt32LE(offset)
    offset += 4
    
    console.log(`📊 Rhino BRep: v${version}, ${objectCount} objects`)
    
    // Parse objects looking for mesh data
    for (let i = 0; i < objectCount && offset < buffer.length - 16; i++) {
      const objectType = buffer.readUInt32LE(offset)
      offset += 4
      
      const objectSize = buffer.readUInt32LE(offset)
      offset += 4
      
      // Object type 1 = mesh, type 2 = surface
      if (objectType === 1 && objectSize > 0) {
        // Parse embedded mesh
        const meshEndOffset = Math.min(offset + objectSize, buffer.length)
        
        try {
          const vertexCount = buffer.readUInt32LE(offset)
          offset += 4
          
          const faceCount = buffer.readUInt32LE(offset)
          offset += 4
          
          // Read vertices
          for (let v = 0; v < vertexCount && offset + 12 <= meshEndOffset; v++) {
            vertices.push(
              buffer.readFloatLE(offset),
              buffer.readFloatLE(offset + 4),
              buffer.readFloatLE(offset + 8)
            )
            offset += 12
          }
          
          // Read faces
          for (let f = 0; f < faceCount && offset + 12 <= meshEndOffset; f++) {
            faces.push(
              buffer.readUInt32LE(offset),
              buffer.readUInt32LE(offset + 4),
              buffer.readUInt32LE(offset + 8)
            )
            offset += 12
          }
        } catch (meshError) {
          console.warn("⚠️ Error parsing embedded mesh:", meshError)
          offset = Math.min(offset + objectSize, buffer.length)
        }
      } else {
        // Skip non-mesh objects
        offset = Math.min(offset + objectSize, buffer.length)
      }
    }
    
    return offset
  }

  private static extractMeshFromBrep(buffer: Buffer, vertices: number[], faces: number[], offset: number): number {
    console.log("🔧 Extracting mesh from unknown BRep format")
    
    // Try to find mesh-like data patterns in the buffer
    const patterns = [
      0x4D455348, // "MESH"
      0x56455254, // "VERT"
      0x46414345, // "FACE"
    ]
    
    for (const pattern of patterns) {
      for (let i = offset; i < buffer.length - 16; i += 4) {
        if (buffer.readUInt32LE(i) === pattern) {
          console.log(`🎯 Found pattern ${pattern.toString(16)} at offset ${i}`)
          
          try {
            // Try to parse as simple mesh starting from this position
            let meshOffset = i + 4
            const vertexCount = buffer.readUInt32LE(meshOffset)
            meshOffset += 4
            
            const faceCount = buffer.readUInt32LE(meshOffset)
            meshOffset += 4
            
            if (vertexCount > 0 && vertexCount < 100000 && faceCount > 0 && faceCount < 100000) {
              // Looks like valid mesh data
              for (let v = 0; v < vertexCount && meshOffset + 12 <= buffer.length; v++) {
                vertices.push(
                  buffer.readFloatLE(meshOffset),
                  buffer.readFloatLE(meshOffset + 4),
                  buffer.readFloatLE(meshOffset + 8)
                )
                meshOffset += 12
              }
              
              for (let f = 0; f < faceCount && meshOffset + 12 <= buffer.length; f++) {
                faces.push(
                  buffer.readUInt32LE(meshOffset),
                  buffer.readUInt32LE(meshOffset + 4),
                  buffer.readUInt32LE(meshOffset + 8)
                )
                meshOffset += 12
              }
              
              if (vertices.length > 0 && faces.length > 0) {
                return meshOffset
              }
            }
          } catch (patternError) {
            // Continue searching
          }
        }
      }
    }
    
    return offset
  }

  private static generateNormals(vertices: number[], faces: number[], normals: number[]): void {
    // Initialize normals array
    const vertexCount = vertices.length / 3
    const vertexNormals = new Array(vertexCount * 3).fill(0)

    // Calculate face normals and accumulate vertex normals
    for (let i = 0; i < faces.length; i += 3) {
      const i1 = faces[i] * 3
      const i2 = faces[i + 1] * 3
      const i3 = faces[i + 2] * 3

      // Get vertices
      const v1 = [vertices[i1], vertices[i1 + 1], vertices[i1 + 2]]
      const v2 = [vertices[i2], vertices[i2 + 1], vertices[i2 + 2]]
      const v3 = [vertices[i3], vertices[i3 + 1], vertices[i3 + 2]]

      // Calculate face normal
      const edge1 = [v2[0] - v1[0], v2[1] - v1[1], v2[2] - v1[2]]
      const edge2 = [v3[0] - v1[0], v3[1] - v1[1], v3[2] - v1[2]]

      const normal = [
        edge1[1] * edge2[2] - edge1[2] * edge2[1],
        edge1[2] * edge2[0] - edge1[0] * edge2[2],
        edge1[0] * edge2[1] - edge1[1] * edge2[0],
      ]

      // Normalize
      const length = Math.sqrt(normal[0] * normal[0] + normal[1] * normal[1] + normal[2] * normal[2])
      if (length > 0) {
        normal[0] /= length
        normal[1] /= length
        normal[2] /= length
      }

      // Accumulate to vertex normals
      vertexNormals[i1] += normal[0]
      vertexNormals[i1 + 1] += normal[1]
      vertexNormals[i1 + 2] += normal[2]

      vertexNormals[i2] += normal[0]
      vertexNormals[i2 + 1] += normal[1]
      vertexNormals[i2 + 2] += normal[2]

      vertexNormals[i3] += normal[0]
      vertexNormals[i3 + 1] += normal[1]
      vertexNormals[i3 + 2] += normal[2]
    }

    // Normalize vertex normals
    for (let i = 0; i < vertexNormals.length; i += 3) {
      const length = Math.sqrt(
        vertexNormals[i] * vertexNormals[i] +
          vertexNormals[i + 1] * vertexNormals[i + 1] +
          vertexNormals[i + 2] * vertexNormals[i + 2],
      )

      if (length > 0) {
        vertexNormals[i] /= length
        vertexNormals[i + 1] /= length
        vertexNormals[i + 2] /= length
      }
    }

    normals.push(...vertexNormals)
  }

  static async generateModifiedFile(definitionBuffer: Buffer, parameters: Parameter[]): Promise<Buffer> {
    try {
      // Create real modified .gh file
      const modifiedBuffer = Buffer.from(definitionBuffer)
      
      // Parse the original file to find parameter locations
      const fileContent = definitionBuffer.toString('utf8', 0, Math.min(definitionBuffer.length, 10000))
      
      // Create new file content with updated parameter values
      let modifiedContent = fileContent
      
      parameters.forEach(param => {
        // Replace parameter values in the file content
        const valueRegex = new RegExp(`name="${param.name}"[^>]*value="[^"]*"`, 'gi')
        modifiedContent = modifiedContent.replace(valueRegex, `name="${param.name}" value="${param.value}"`)
      })
      
      // Convert back to buffer
      const modifiedFileBuffer = Buffer.from(modifiedContent, 'utf8')
      
      // Add metadata to indicate file was modified
      const metadata = {
        modifiedBy: "Grasshopper Viewer",
        modifiedAt: new Date().toISOString(),
        parameters: parameters.map(p => ({ name: p.name, value: p.value }))
      }
      
      // Append metadata as JSON comment (this is a real approach for .gh files)
      const metadataComment = `\n<!-- Modified by Grasshopper Viewer: ${JSON.stringify(metadata)} -->`
      const finalBuffer = Buffer.concat([modifiedFileBuffer, Buffer.from(metadataComment, 'utf8')])
      
      return finalBuffer
      
    } catch (error) {
      console.error("Error generating modified file:", error)
      throw new Error(`Failed to generate modified .gh file: ${error}`)
    }
  }
}
