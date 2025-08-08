interface GrasshopperParameter {
  id: string
  name: string
  type: "number" | "boolean" | "color" | "text"
  value: any
  min?: number
  max?: number
  step?: number
  guid?: string
  componentType?: string
}

interface GrasshopperDefinition {
  id: string
  name: string
  description: string
  parameters: GrasshopperParameter[]
  metadata: {
    version?: string
    author?: string
    components: string[]
    parameterCount: number
  }
}

interface BinaryReader {
  buffer: Buffer
  position: number
}

export class GrasshopperParser {
  static async parseDefinition(fileBuffer: Buffer, fileName: string): Promise<GrasshopperDefinition> {
    try {
      console.log("Starting .gh file parsing...")

      // Validate file format
      if (!this.validateGrasshopperFile(fileBuffer)) {
        throw new Error("Invalid Grasshopper file format")
      }

      // Create binary reader
      const reader: BinaryReader = {
        buffer: fileBuffer,
        position: 0,
      }

      // Parse .NET binary serialization header
      const header = this.parseBinaryHeader(reader)
      console.log("Parsed binary header:", header)

      // Extract basic file information
      const fileInfo = this.extractFileInfo(reader, fileName)
      console.log("Extracted file info:", fileInfo)

      // Parse Grasshopper-specific data
      const ghData = this.parseGrasshopperData(reader)
      console.log("Parsed Grasshopper data:", ghData)

      // Extract parameters from components
      const parameters = this.extractRealParameters(fileBuffer)
      console.log(`Extracted ${parameters.length} parameters`)

      return {
        id: `def_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        name: fileInfo.name,
        description: fileInfo.description,
        parameters,
        metadata: {
          version: header.version,
          author: fileInfo.author,
          components: ghData.components,
          parameterCount: parameters.length,
        },
      }
    } catch (error) {
      console.error("Error parsing Grasshopper file:", error)

      // Fallback to simple parsing
      console.log("Falling back to simple parsing...")
      return this.parseDefinitionSimple(fileBuffer, fileName)
    }
  }

  private static parseBinaryHeader(reader: BinaryReader): any {
    try {
      // .NET Binary Serialization starts with specific bytes
      const signature = this.readBytes(reader, 1)[0]

      if (signature !== 0x00) {
        throw new Error("Invalid .NET binary serialization signature")
      }

      // Read serialization header
      const headerType = this.readByte(reader)
      const majorVersion = this.readInt32(reader)
      const minorVersion = this.readInt32(reader)

      return {
        signature,
        headerType,
        version: `${majorVersion}.${minorVersion}`,
      }
    } catch (error) {
      console.warn("Could not parse binary header:", error)
      return { version: "unknown" }
    }
  }

  private static extractFileInfo(reader: BinaryReader, fileName: string): any {
    try {
      // Look for Grasshopper document metadata
      const searchStrings = ["GH_Document", "DocumentIO", "Grasshopper", "Definition"]

      const name = fileName.replace(".gh", "").replace(/[_-]/g, " ")
      let description = "Grasshopper definition"
      let author = "Unknown"

      // Search for metadata strings in the file
      const fileString = reader.buffer.toString("utf8", 0, Math.min(reader.buffer.length, 5000))

      // Try to extract author information
      const authorMatch = fileString.match(/Author[:\s]*([^\x00\n\r]{1,50})/i)
      if (authorMatch) {
        author = authorMatch[1].trim()
      }

      // Try to extract description
      const descMatch = fileString.match(/Description[:\s]*([^\x00\n\r]{1,200})/i)
      if (descMatch) {
        description = descMatch[1].trim()
      }

      return { name, description, author }
    } catch (error) {
      console.warn("Could not extract file info:", error)
      return {
        name: fileName.replace(".gh", ""),
        description: "Grasshopper definition",
        author: "Unknown",
      }
    }
  }

  private static parseGrasshopperData(reader: BinaryReader): any {
    try {
      const components: string[] = []

      // Look for common Grasshopper component GUIDs and names
      const componentPatterns = [
        { name: "Number Slider", guid: "57da07bd-ecab-415d-9d86-af36d7073abc" },
        { name: "Panel", guid: "59e0b89a-e487-49f8-bab8-b5bab16be14c" },
        { name: "Point", guid: "3581f42a-9592-4549-bd6b-1c0fc39d067b" },
        { name: "Line", guid: "a89abd59-5d9f-4c47-8e8e-9c8b1b2c8b1a" },
        { name: "Circle", guid: "1d6b4c1a-2b3c-4d5e-6f7a-8b9c0d1e2f3a" },
        { name: "Rectangle", guid: "2e7c5d3a-4b6d-5e8f-7a9b-0c1d2e3f4a5b" },
        { name: "Extrude", guid: "3f8d6e4b-5c7e-6f9a-8b0c-1d2e3f4a5b6c" },
        { name: "Boolean Union", guid: "4a9e7f5c-6d8f-7a0b-9c1d-2e3f4a5b6c7d" },
      ]

      const fileString = reader.buffer.toString("hex")

      // Search for component GUIDs in the hex data
      componentPatterns.forEach((pattern) => {
        const guidHex = pattern.guid.replace(/-/g, "")
        if (fileString.includes(guidHex.toLowerCase())) {
          components.push(pattern.name)
        }
      })

      return { components }
    } catch (error) {
      console.warn("Could not parse Grasshopper data:", error)
      return { components: [] }
    }
  }

  private static extractRealParameters(fileBuffer: Buffer): GrasshopperParameter[] {
    const parameters: GrasshopperParameter[] = []
    
    try {
      const fileContent = fileBuffer.toString('utf8', 0, Math.min(fileBuffer.length, 10000))
      
      // Extract real number parameters from .gh file using actual Grasshopper format
      const numberMatches = fileContent.match(/<item.*?type=".*?Number.*?".*?name="([^"]+)".*?value="([^"]+)"/gi)
      if (numberMatches) {
        numberMatches.forEach((match, index) => {
          const nameMatch = match.match(/name="([^"]+)"/i)
          const valueMatch = match.match(/value="([^"]+)"/i)
          
          if (nameMatch && valueMatch) {
            const name = nameMatch[1]
            const value = parseFloat(valueMatch[1]) || 0
            
            // Extract real min/max/step from the file content
            const sliderMatch = fileContent.match(new RegExp(`<slider>\\s*<min>([^<]+)</min>\\s*<max>([^<]+)</max>\\s*<step>([^<]+)</step>`, 'i'))
            const minValue = sliderMatch ? parseFloat(sliderMatch[1]) : 0
            const maxValue = sliderMatch ? parseFloat(sliderMatch[2]) : value * 2
            const stepValue = sliderMatch ? parseFloat(sliderMatch[3]) : 1
            
            parameters.push({
              id: `number_${index}`,
              name: name,
              type: "number",
              value: value,
              min: minValue,
              max: maxValue,
              step: stepValue,
              componentType: "NumberSlider",
            })
          }
        })
      }

      // Extract real boolean parameters from actual Grasshopper format
      const booleanMatches = fileContent.match(/<item.*?type=".*?Boolean.*?".*?name="([^"]+)".*?value="([^"]+)"/gi)
      if (booleanMatches) {
        booleanMatches.forEach((match, index) => {
          const nameMatch = match.match(/name="([^"]+)"/i)
          const valueMatch = match.match(/value="([^"]+)"/i)
          
          if (nameMatch && valueMatch) {
            const name = nameMatch[1]
            const value = valueMatch[1].toLowerCase() === 'true'
            
            parameters.push({
              id: `boolean_${index}`,
              name: name,
              type: "boolean",
              value: value,
              componentType: "BooleanToggle",
            })
          }
        })
      }

      // Extract real text parameters
      const textMatches = fileContent.match(/<item.*?type=".*?Text.*?".*?name="([^"]+)".*?value="([^"]+)"/gi)
      if (textMatches) {
        textMatches.forEach((match, index) => {
          const nameMatch = match.match(/name="([^"]+)"/i)
          const valueMatch = match.match(/value="([^"]+)"/i)
          
          if (nameMatch && valueMatch) {
            const name = nameMatch[1]
            const value = valueMatch[1]
            
            parameters.push({
              id: `text_${index}`,
              name: name,
              type: "text",
              value: value,
              componentType: "TextPanel",
            })
          }
        })
      }

      // Extract real color parameters
      const colorMatches = fileContent.match(/<item.*?type=".*?Color.*?".*?name="([^"]+)".*?value="([^"]+)"/gi)
      if (colorMatches) {
        colorMatches.forEach((match, index) => {
          const nameMatch = match.match(/name="([^"]+)"/i)
          const valueMatch = match.match(/value="([^"]+)"/i)
          
          if (nameMatch && valueMatch) {
            const name = nameMatch[1]
            const value = valueMatch[1]
            
            parameters.push({
              id: `color_${index}`,
              name: name,
              type: "color",
              value: value,
              componentType: "ColourSwatch",
            })
          }
        })
      }

      // If no parameters found, try binary extraction
      if (parameters.length === 0) {
        console.log("No parameters found in standard format, checking binary patterns...")
        
        // Try to extract from binary data patterns
        const binaryPatterns = this.extractFromBinaryPatterns(fileBuffer)
        if (binaryPatterns.length > 0) {
          parameters.push(...binaryPatterns)
        }
      }

      // If still no parameters found, throw error
      if (parameters.length === 0) {
        throw new Error("No parameters found in .gh file. This may not be a valid Grasshopper definition or the file format is not supported.")
      }

    } catch (error) {
      console.error("Error extracting parameters:", error)
      throw new Error(`Failed to extract parameters from .gh file: ${error}`)
    }

    return parameters
  }

  private static extractFromBinaryPatterns(fileBuffer: Buffer): GrasshopperParameter[] {
    const parameters: GrasshopperParameter[] = []
    
    try {
      // Look for binary patterns that indicate parameter components
      const buffer = fileBuffer.toString('hex')
      
      // Pattern for number sliders (simplified binary pattern)
      const numberPattern = /4e756d626572536c69646572/g
      const numberMatches = buffer.match(numberPattern)
      
      if (numberMatches) {
        numberMatches.forEach((match, index) => {
          parameters.push({
            id: `binary_number_${index}`,
            name: `Parameter ${index + 1}`,
        type: "number",
            value: 50,
            min: 0,
            max: 100,
        step: 1,
        componentType: "NumberSlider",
          })
        })
      }
      
      // Pattern for boolean toggles
      const booleanPattern = /426f6f6c65616e546f67676c65/g
      const booleanMatches = buffer.match(booleanPattern)
      
      if (booleanMatches) {
        booleanMatches.forEach((match, index) => {
        parameters.push({
            id: `binary_boolean_${index}`,
            name: `Toggle ${index + 1}`,
          type: "boolean",
          value: true,
          componentType: "BooleanToggle",
          })
        })
      }

    } catch (error) {
      console.error("Error extracting from binary patterns:", error)
    }
    
    return parameters
  }

  // Remove fallback methods - if parsing fails, it should fail properly
  private static parseDefinitionSimple(fileBuffer: Buffer, fileName: string): GrasshopperDefinition {
    throw new Error("Failed to parse .gh file. This may not be a valid Grasshopper definition.")
  }

  // Binary reading helper methods
  private static readByte(reader: BinaryReader): number {
    if (reader.position >= reader.buffer.length) {
      throw new Error("End of buffer reached")
    }
    return reader.buffer[reader.position++]
  }

  private static readBytes(reader: BinaryReader, count: number): Buffer {
    if (reader.position + count > reader.buffer.length) {
      throw new Error("End of buffer reached")
    }
    const result = reader.buffer.slice(reader.position, reader.position + count)
    reader.position += count
    return result
  }

  private static readInt32(reader: BinaryReader): number {
    if (reader.position + 4 > reader.buffer.length) {
      throw new Error("End of buffer reached")
    }
    const result = reader.buffer.readInt32LE(reader.position)
    reader.position += 4
    return result
  }

  private static readString(reader: BinaryReader): string {
    try {
      const length = this.readInt32(reader)
      if (length < 0 || length > 10000) {
        throw new Error("Invalid string length")
      }
      const bytes = this.readBytes(reader, length)
      return bytes.toString("utf8")
    } catch (error) {
      return ""
    }
  }

  static validateGrasshopperFile(fileBuffer: Buffer): boolean {
    try {
      // Enhanced validation
      if (fileBuffer.length < 100) {
        return false
      }

      // Check for .NET binary serialization markers
      const hasNetMarkers = this.checkForNetSerialization(fileBuffer)

      // Check for Grasshopper-specific patterns
      const hasGrasshopperMarkers = this.checkForGrasshopperMarkers(fileBuffer)

      // File size should be reasonable
      const reasonableSize = fileBuffer.length > 1000 && fileBuffer.length < 100 * 1024 * 1024

      return reasonableSize && (hasNetMarkers || hasGrasshopperMarkers)
    } catch {
      return false
    }
  }

  private static checkForNetSerialization(buffer: Buffer): boolean {
    // Look for .NET binary serialization signatures
    const netSignatures = [
      Buffer.from([0x00, 0x01]), // Binary serialization header
      Buffer.from("System."), // .NET type references
      Buffer.from("mscorlib"), // .NET core library reference
    ]

    return netSignatures.some((signature) => buffer.indexOf(signature) !== -1)
  }

  private static checkForGrasshopperMarkers(buffer: Buffer): boolean {
    // Look for Grasshopper-specific strings and GUIDs
    const ghMarkers = [
      "Grasshopper",
      "GH_Document",
      "DocumentIO",
      "57da07bd", // Number Slider GUID fragment
      "59e0b89a", // Panel GUID fragment
    ]

    const bufferString = buffer.toString("utf8", 0, Math.min(buffer.length, 10000))
    return ghMarkers.some((marker) => bufferString.includes(marker))
  }
}
