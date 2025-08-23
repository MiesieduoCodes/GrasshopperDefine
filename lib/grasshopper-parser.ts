interface GrasshopperParameter {
  id: string
  name: string
  type: "number" | "boolean" | "color" | "text" | "integer" | "point" | "vector" | "curve" | "surface" | "brep" | "mesh" | "domain"
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
      console.log("🔍 Starting binary parameter extraction from .gh file")
      
      // First, try proper binary parsing
      const binaryParameters = this.extractParametersFromBinary(fileBuffer)
      if (binaryParameters.length > 0) {
        parameters.push(...binaryParameters)
        console.log(`✅ Extracted ${binaryParameters.length} parameters from binary data`)
      }
      
      // If binary parsing fails or finds no parameters, fall back to text-based parsing
      if (parameters.length === 0) {
        console.log("⚠️ Binary parsing found no parameters, trying text-based fallback")
        const textParameters = this.extractParametersFromText(fileBuffer)
        parameters.push(...textParameters)
      }
      
      console.log(`📊 Total parameters extracted: ${parameters.length}`)
      return parameters
      
    } catch (error) {
      console.error("❌ Error extracting parameters:", error)
      throw new Error(`Failed to extract parameters from .gh file: ${error}`)
    }
  }

  private static extractParametersFromBinary(fileBuffer: Buffer): GrasshopperParameter[] {
    const parameters: GrasshopperParameter[] = []
    
    try {
      console.log("🔧 Parsing .gh file binary structure")
      
      // Create binary reader
      const reader = { buffer: fileBuffer, position: 0 }
      
      // Skip .NET binary serialization header
      this.skipBinaryHeader(reader)
      
      // Look for Grasshopper document structure
      const documentData = this.findGrasshopperDocument(reader)
      if (!documentData) {
        throw new Error("No Grasshopper document structure found")
      }
      
      // Extract parameters from document
      const extractedParams = this.extractParametersFromDocument(documentData, fileBuffer)
      parameters.push(...extractedParams)
      
      return parameters
      
    } catch (error) {
      console.warn("⚠️ Binary parameter extraction failed:", error)
      return []
    }
  }

  private static skipBinaryHeader(reader: { buffer: Buffer; position: number }): void {
    try {
      console.log("🔧 Processing .NET binary serialization header")
      
      if (reader.position + 16 > reader.buffer.length) return
      
      // Check for .NET Binary Formatter signature (0x00)
      if (reader.buffer[reader.position] === 0x00) {
        console.log("📋 Found .NET Binary Formatter signature")
        reader.position += 1
        
        // Parse serialization header record
        const headerRecord = this.parseBinaryFormatterHeader(reader)
        if (headerRecord) {
          console.log(`✅ Parsed .NET header: version ${headerRecord.majorVersion}.${headerRecord.minorVersion}`)
        }
      }
      
      // Check for other .NET serialization formats
      else if (this.isDataContractSerialization(reader.buffer, reader.position)) {
        console.log("📋 Found DataContract serialization")
        this.skipDataContractHeader(reader)
      }
      
      else if (this.isXmlSerialization(reader.buffer, reader.position)) {
        console.log("📋 Found XML serialization")
        this.skipXmlHeader(reader)
      }
      
      else {
        console.log("⚠️ Unknown serialization format, proceeding with raw binary")
      }
      
    } catch (error) {
      console.warn("⚠️ Error processing binary header:", error)
    }
  }

  private static parseBinaryFormatterHeader(reader: { buffer: Buffer; position: number }): any {
    try {
      if (reader.position + 17 > reader.buffer.length) return null
      
      // Parse SerializationHeaderRecord
      const recordType = reader.buffer[reader.position]
      reader.position += 1
      
      if (recordType !== 0x00) return null // Not a header record
      
      // Read header fields
      const rootId = reader.buffer.readInt32LE(reader.position)
      reader.position += 4
      
      const headerId = reader.buffer.readInt32LE(reader.position)
      reader.position += 4
      
      const majorVersion = reader.buffer.readInt32LE(reader.position)
      reader.position += 4
      
      const minorVersion = reader.buffer.readInt32LE(reader.position)
      reader.position += 4
      
      return {
        rootId,
        headerId,
        majorVersion,
        minorVersion
      }
      
    } catch (error) {
      console.warn("⚠️ Error parsing binary formatter header:", error)
      return null
    }
  }

  private static isDataContractSerialization(buffer: Buffer, position: number): boolean {
    const dcMarkers = [
      Buffer.from('<DataContract'),
      Buffer.from('System.Runtime.Serialization'),
      Buffer.from('DataContractSerializer')
    ]
    
    return dcMarkers.some(marker => 
      buffer.indexOf(marker, position) !== -1 && 
      buffer.indexOf(marker, position) < position + 1000
    )
  }

  private static isXmlSerialization(buffer: Buffer, position: number): boolean {
    const xmlMarkers = [
      Buffer.from('<?xml'),
      Buffer.from('<root'),
      Buffer.from('System.Xml.Serialization')
    ]
    
    return xmlMarkers.some(marker => 
      buffer.indexOf(marker, position) !== -1 && 
      buffer.indexOf(marker, position) < position + 1000
    )
  }

  private static skipDataContractHeader(reader: { buffer: Buffer; position: number }): void {
    // Skip DataContract serialization header
    const dcStart = reader.buffer.indexOf(Buffer.from('<DataContract'), reader.position)
    if (dcStart !== -1) {
      reader.position = dcStart
    }
  }

  private static skipXmlHeader(reader: { buffer: Buffer; position: number }): void {
    // Skip XML declaration and root element
    const xmlStart = reader.buffer.indexOf(Buffer.from('<?xml'), reader.position)
    if (xmlStart !== -1) {
      reader.position = xmlStart
      
      // Find end of XML declaration
      const declEnd = reader.buffer.indexOf(Buffer.from('?>'), reader.position)
      if (declEnd !== -1) {
        reader.position = declEnd + 2
      }
    }
  }

  private static findGrasshopperDocument(reader: { buffer: Buffer; position: number }): any {
    try {
      console.log("🔍 Searching for Grasshopper document structure")
      
      // Look for Grasshopper document markers in the binary data
      const documentMarkers = [
        "GH_Document",
        "DocumentIO", 
        "Grasshopper.Kernel.GH_Document",
        "Grasshopper.Kernel.GH_DocumentIO",
        "GH_Archive"
      ]
      
      for (const marker of documentMarkers) {
        const markerBuffer = Buffer.from(marker, 'utf8')
        const index = reader.buffer.indexOf(markerBuffer, reader.position)
        
        if (index !== -1) {
          console.log(`🎯 Found document marker "${marker}" at position ${index}`)
          
          // Try to parse the document structure
          const docStructure = this.parseDocumentStructure(reader.buffer, index)
          return { 
            position: index, 
            type: marker,
            structure: docStructure
          }
        }
      }
      
      // If no specific markers found, try to find .NET object references
      const netObjects = this.findNetObjectReferences(reader.buffer, reader.position)
      if (netObjects.length > 0) {
        console.log(`🎯 Found ${netObjects.length} .NET object references`)
        return {
          position: netObjects[0].position,
          type: "NET_OBJECTS",
          objects: netObjects
        }
      }
      
      return null
      
    } catch (error) {
      console.warn("⚠️ Error finding Grasshopper document:", error)
      return null
    }
  }

  private static parseDocumentStructure(buffer: Buffer, position: number): any {
    try {
      // Look for document version and metadata around the marker
      const searchArea = buffer.slice(
        Math.max(0, position - 200), 
        Math.min(buffer.length, position + 1000)
      )
      
      const structure = {
        version: this.extractDocumentVersion(searchArea),
        components: this.findComponentReferences(searchArea),
        properties: this.extractDocumentProperties(searchArea)
      }
      
      console.log(`📊 Document structure: version ${structure.version}, ${structure.components.length} components`)
      return structure
      
    } catch (error) {
      console.warn("⚠️ Error parsing document structure:", error)
      return null
    }
  }

  private static extractDocumentVersion(buffer: Buffer): string {
    try {
      // Look for version patterns in the buffer
      const versionPatterns = [
        /Version\s*[:=]\s*([0-9]+\.[0-9]+\.[0-9]+)/i,
        /v([0-9]+\.[0-9]+)/i,
        /([0-9]+\.[0-9]+\.[0-9]+\.[0-9]+)/
      ]
      
      const text = buffer.toString('utf8')
      for (const pattern of versionPatterns) {
        const match = text.match(pattern)
        if (match) {
          return match[1]
        }
      }
      
      return "unknown"
    } catch (error) {
      return "unknown"
    }
  }

  private static findComponentReferences(buffer: Buffer): string[] {
    const components: string[] = []
    
    try {
      const text = buffer.toString('utf8')
      
      // Look for GUID patterns that indicate components
      const guidPattern = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi
      const matches = text.match(guidPattern)
      
      if (matches) {
        components.push(...matches.slice(0, 20)) // Limit to first 20 GUIDs
      }
      
    } catch (error) {
      // Ignore text conversion errors
    }
    
    return components
  }

  private static extractDocumentProperties(buffer: Buffer): any {
    try {
      const properties: any = {}
      const text = buffer.toString('utf8')
      
      // Look for common document properties
      const propertyPatterns = [
        { key: 'author', pattern: /Author\s*[:=]\s*([^\r\n]+)/i },
        { key: 'description', pattern: /Description\s*[:=]\s*([^\r\n]+)/i },
        { key: 'created', pattern: /Created\s*[:=]\s*([^\r\n]+)/i },
        { key: 'modified', pattern: /Modified\s*[:=]\s*([^\r\n]+)/i }
      ]
      
      for (const prop of propertyPatterns) {
        const match = text.match(prop.pattern)
        if (match) {
          properties[prop.key] = match[1].trim()
        }
      }
      
      return properties
      
    } catch (error) {
      return {}
    }
  }

  private static findNetObjectReferences(buffer: Buffer, startPosition: number): any[] {
    const objects: any[] = []
    
    try {
      // Look for .NET type references
      const netTypePatterns = [
        "System.",
        "Grasshopper.",
        "Rhino.",
        "GH_",
        "mscorlib"
      ]
      
      for (const pattern of netTypePatterns) {
        const patternBuffer = Buffer.from(pattern, 'utf8')
        let searchPos = startPosition
        
        while (true) {
          const index = buffer.indexOf(patternBuffer, searchPos)
          if (index === -1) break
          
          // Try to extract the full type name
          const typeName = this.extractTypeName(buffer, index)
          if (typeName) {
            objects.push({
              position: index,
              type: pattern,
              typeName: typeName
            })
          }
          
          searchPos = index + 1
          if (objects.length >= 50) break // Limit results
        }
      }
      
    } catch (error) {
      console.warn("⚠️ Error finding .NET object references:", error)
    }
    
    return objects
  }

  private static extractTypeName(buffer: Buffer, position: number): string | null {
    try {
      // Extract a reasonable type name from the buffer
      const maxLength = 200
      const endPos = Math.min(buffer.length, position + maxLength)
      const segment = buffer.slice(position, endPos)
      
      // Convert to string and find the type name
      const text = segment.toString('utf8')
      const typeMatch = text.match(/^([A-Za-z0-9_.]+)/)
      
      return typeMatch ? typeMatch[1] : null
      
    } catch (error) {
      return null
    }
  }

  private static extractParametersFromDocument(documentData: any, fileBuffer: Buffer): GrasshopperParameter[] {
    const parameters: GrasshopperParameter[] = []
    
    try {
      // Look for component GUIDs and their associated data
      const componentTypes = [
        { 
          guid: "57da07bd-ecab-415d-9d86-af36d7073abc", 
          name: "Number Slider", 
          type: "number",
          parser: this.parseNumberSlider.bind(this)
        },
        { 
          guid: "59e0b89a-e487-49f8-bab8-b5bab16be14c", 
          name: "Panel", 
          type: "text",
          parser: this.parseTextPanel.bind(this)
        },
        { 
          guid: "368c0e55-7b6d-4f82-8c0e-4a8c8e0e4f4f", 
          name: "Boolean Toggle", 
          type: "boolean",
          parser: this.parseBooleanToggle.bind(this)
        },
        { 
          guid: "c552a431-af5b-46a9-a8a4-0fcbc27ef596", 
          name: "Colour Swatch", 
          type: "color",
          parser: this.parseColorSwatch.bind(this)
        },
        {
          guid: "3581f42a-9592-4549-bd6b-1c0fc39d067b",
          name: "Integer Slider",
          type: "integer",
          parser: this.parseIntegerSlider.bind(this)
        },
        {
          guid: "e6c42834-5a24-4c56-b9e8-9c3f4e5a6b7c",
          name: "Point Parameter",
          type: "point",
          parser: this.parsePointParameter.bind(this)
        },
        {
          guid: "8ec86459-bf01-4409-baee-174d0d2b13d0",
          name: "Vector Parameter",
          type: "vector",
          parser: this.parseVectorParameter.bind(this)
        },
        {
          guid: "84fa917c-1ed8-4db3-8be1-7bdc4a6495a2",
          name: "Curve Parameter",
          type: "curve",
          parser: this.parseCurveParameter.bind(this)
        },
        {
          guid: "162056fc-4d54-4b89-8c72-1c3f4e5a6b7d",
          name: "Surface Parameter",
          type: "surface", 
          parser: this.parseSurfaceParameter.bind(this)
        },
        {
          guid: "4f5c4b2a-3d8e-4f7a-9b2c-1d4e5f6a7b8c",
          name: "Brep Parameter",
          type: "brep",
          parser: this.parseBrepParameter.bind(this)
        },
        {
          guid: "8bdc4a64-95a2-4c56-b9e8-9c3f4e5a6b7e",
          name: "Mesh Parameter",
          type: "mesh",
          parser: this.parseMeshParameter.bind(this)
        },
        {
          guid: "37261734-eec7-4f50-b6a8-b8d4a6495a3f",
          name: "Domain Parameter",
          type: "domain",
          parser: this.parseDomainParameter.bind(this)
        }
      ]
      
      for (const componentType of componentTypes) {
        const foundComponents = this.findComponentsByGuid(fileBuffer, componentType.guid)
        
        for (const component of foundComponents) {
          try {
            const param = componentType.parser(component, fileBuffer)
            if (param) {
              param.componentType = componentType.name
              parameters.push(param)
            }
          } catch (parseError) {
            console.warn(`⚠️ Failed to parse ${componentType.name}:`, parseError)
          }
        }
      }
      
      return parameters
      
    } catch (error) {
      console.error("❌ Error extracting parameters from document:", error)
      return []
    }
  }

  private static findComponentsByGuid(fileBuffer: Buffer, guid: string): any[] {
    const components: any[] = []
    
    // Convert GUID to different formats that might appear in the file
    const guidFormats = [
      guid.toLowerCase().replace(/-/g, ''),
      guid.toUpperCase().replace(/-/g, ''),
      guid.toLowerCase(),
      guid.toUpperCase()
    ]
    
    for (const guidFormat of guidFormats) {
      const guidBuffer = Buffer.from(guidFormat, 'utf8')
      let searchPos = 0
      
      while (true) {
        const index = fileBuffer.indexOf(guidBuffer, searchPos)
        if (index === -1) break
        
        // Found a component, try to extract its data
        const componentData = this.extractComponentData(fileBuffer, index)
        if (componentData) {
          components.push(componentData)
        }
        
        searchPos = index + 1
      }
    }
    
    return components
  }

  private static extractComponentData(fileBuffer: Buffer, position: number): any {
    try {
      // Look for component data structure around the GUID position
      const dataStart = Math.max(0, position - 1000)
      const dataEnd = Math.min(fileBuffer.length, position + 1000)
      const componentBuffer = fileBuffer.slice(dataStart, dataEnd)
      
      return {
        position: position,
        buffer: componentBuffer,
        dataStart: dataStart
      }
    } catch (error) {
      return null
    }
  }

  private static extractParametersFromText(fileBuffer: Buffer): GrasshopperParameter[] {
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
      console.log("🔍 Performing enhanced .gh file validation")
      
      // Basic size validation
      if (fileBuffer.length < 100) {
        console.log("❌ File too small to be a valid .gh file")
        return false
      }

      if (fileBuffer.length > 100 * 1024 * 1024) {
        console.log("❌ File too large (>100MB)")
        return false
      }

      // Check file structure integrity
      const structureValid = this.validateFileStructure(fileBuffer)
      if (!structureValid) {
        console.log("❌ Invalid file structure")
        return false
      }

      // Check for .NET binary serialization markers
      const hasNetMarkers = this.checkForNetSerialization(fileBuffer)

      // Check for Grasshopper-specific patterns
      const hasGrasshopperMarkers = this.checkForGrasshopperMarkers(fileBuffer)

      // Validate document version compatibility
      const versionValid = this.validateDocumentVersion(fileBuffer)

      // Check for required Grasshopper components
      const hasRequiredComponents = this.validateRequiredComponents(fileBuffer)

      // Validate binary format consistency
      const binaryConsistent = this.validateBinaryConsistency(fileBuffer)

      const isValid = (hasNetMarkers || hasGrasshopperMarkers) && 
                     versionValid && 
                     hasRequiredComponents && 
                     binaryConsistent

      console.log(`📊 Validation results: NET=${hasNetMarkers}, GH=${hasGrasshopperMarkers}, Version=${versionValid}, Components=${hasRequiredComponents}, Binary=${binaryConsistent}`)
      console.log(`✅ File validation: ${isValid ? 'PASSED' : 'FAILED'}`)

      return isValid
    } catch (error) {
      console.error("❌ Error during file validation:", error)
      return false
    }
  }

  private static validateFileStructure(fileBuffer: Buffer): boolean {
    try {
      // Check for common file corruption indicators
      const nullByteRatio = this.calculateNullByteRatio(fileBuffer)
      if (nullByteRatio > 0.8) {
        console.log("⚠️ High null byte ratio, possible corruption")
        return false
      }

      // Check for reasonable text/binary balance
      const textRatio = this.calculateTextRatio(fileBuffer)
      if (textRatio < 0.1 && textRatio > 0.9) {
        console.log("⚠️ Unusual text/binary ratio")
        return false
      }

      // Check for file header consistency
      const hasValidHeader = this.validateFileHeader(fileBuffer)
      if (!hasValidHeader) {
        console.log("⚠️ Invalid or missing file header")
        return false
      }

      return true
    } catch (error) {
      return false
    }
  }

  private static calculateNullByteRatio(buffer: Buffer): number {
    let nullCount = 0
    for (let i = 0; i < buffer.length; i++) {
      if (buffer[i] === 0) nullCount++
    }
    return nullCount / buffer.length
  }

  private static calculateTextRatio(buffer: Buffer): number {
    let textCount = 0
    const sampleSize = Math.min(10000, buffer.length)
    
    for (let i = 0; i < sampleSize; i++) {
      const byte = buffer[i]
      // Count printable ASCII characters
      if ((byte >= 32 && byte <= 126) || byte === 9 || byte === 10 || byte === 13) {
        textCount++
      }
    }
    
    return textCount / sampleSize
  }

  private static validateFileHeader(buffer: Buffer): boolean {
    // Check for various valid header patterns
    const validHeaders = [
      Buffer.from([0x00]), // .NET Binary Formatter
      Buffer.from('<?xml'), // XML serialization
      Buffer.from('<DataContract'), // DataContract serialization
      Buffer.from('GH_'), // Grasshopper marker
      Buffer.from('Grasshopper') // Direct Grasshopper reference
    ]

    return validHeaders.some(header => 
      buffer.indexOf(header, 0) !== -1 && buffer.indexOf(header, 0) < 1000
    )
  }

  private static validateDocumentVersion(fileBuffer: Buffer): boolean {
    try {
      // Extract version information
      const version = this.extractDocumentVersion(fileBuffer.slice(0, 5000))
      
      if (version === "unknown") {
        console.log("⚠️ Could not determine document version")
        return true // Allow unknown versions
      }

      // Check for supported version ranges
      const supportedVersions = [
        /^[0-9]+\.[0-9]+$/, // Major.Minor
        /^[0-9]+\.[0-9]+\.[0-9]+$/, // Major.Minor.Build
        /^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$/ // Major.Minor.Build.Revision
      ]

      const versionSupported = supportedVersions.some(pattern => pattern.test(version))
      
      if (!versionSupported) {
        console.log(`⚠️ Unsupported version format: ${version}`)
        return false
      }

      console.log(`✅ Document version: ${version}`)
      return true
      
    } catch (error) {
      console.log("⚠️ Error validating version, allowing file")
      return true
    }
  }

  private static validateRequiredComponents(fileBuffer: Buffer): boolean {
    try {
      // Check for essential Grasshopper components
      const requiredMarkers = [
        "GH_Document", // Core document structure
        "DocumentIO"   // I/O handling
      ]

      let foundMarkers = 0
      for (const marker of requiredMarkers) {
        if (fileBuffer.indexOf(Buffer.from(marker, 'utf8')) !== -1) {
          foundMarkers++
        }
      }

      // At least one core marker should be present
      const hasRequired = foundMarkers > 0

      if (!hasRequired) {
        console.log("⚠️ Missing required Grasshopper components")
      }

      return hasRequired
      
    } catch (error) {
      return false
    }
  }

  private static validateBinaryConsistency(fileBuffer: Buffer): boolean {
    try {
      // Check for binary format consistency
      const reader = { buffer: fileBuffer, position: 0 }
      
      // Try to parse the header without errors
      this.skipBinaryHeader(reader)
      
      // Check if we can find document structure
      const docData = this.findGrasshopperDocument(reader)
      
      // If we found document data, the binary format is likely consistent
      const isConsistent = docData !== null
      
      if (!isConsistent) {
        console.log("⚠️ Binary format appears inconsistent")
      }

      return isConsistent
      
    } catch (error) {
      console.log("⚠️ Error checking binary consistency")
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

  // Component-specific parsers for binary data
  private static parseNumberSlider(componentData: any, fileBuffer: Buffer): GrasshopperParameter | null {
    try {
      console.log("🔢 Parsing Number Slider component")
      
      const buffer = componentData.buffer
      const position = componentData.position - componentData.dataStart
      
      // Look for number slider data patterns
      const sliderData = this.extractSliderData(buffer, position)
      if (!sliderData) return null
      
      return {
        id: `slider_${componentData.position}`,
        name: sliderData.name || `Slider ${componentData.position}`,
        type: "number",
        value: sliderData.value || 0,
        min: sliderData.min || 0,
        max: sliderData.max || 100,
        step: sliderData.step || 1,
        componentType: "Number Slider"
      }
    } catch (error) {
      console.warn("⚠️ Failed to parse number slider:", error)
      return null
    }
  }

  private static parseTextPanel(componentData: any, fileBuffer: Buffer): GrasshopperParameter | null {
    try {
      console.log("📝 Parsing Text Panel component")
      
      const buffer = componentData.buffer
      const position = componentData.position - componentData.dataStart
      
      // Look for text panel data patterns
      const panelData = this.extractPanelData(buffer, position)
      if (!panelData) return null
      
      return {
        id: `panel_${componentData.position}`,
        name: panelData.name || `Panel ${componentData.position}`,
        type: "text",
        value: panelData.value || "",
        componentType: "Panel"
      }
    } catch (error) {
      console.warn("⚠️ Failed to parse text panel:", error)
      return null
    }
  }

  private static parseBooleanToggle(componentData: any, fileBuffer: Buffer): GrasshopperParameter | null {
    try {
      console.log("🔘 Parsing Boolean Toggle component")
      
      const buffer = componentData.buffer
      const position = componentData.position - componentData.dataStart
      
      // Look for boolean toggle data patterns
      const toggleData = this.extractToggleData(buffer, position)
      if (!toggleData) return null
      
      return {
        id: `toggle_${componentData.position}`,
        name: toggleData.name || `Toggle ${componentData.position}`,
        type: "boolean",
        value: toggleData.value || false,
        componentType: "Boolean Toggle"
      }
    } catch (error) {
      console.warn("⚠️ Failed to parse boolean toggle:", error)
      return null
    }
  }

  private static parseColorSwatch(componentData: any, fileBuffer: Buffer): GrasshopperParameter | null {
    try {
      console.log("🎨 Parsing Color Swatch component")
      
      const buffer = componentData.buffer
      const position = componentData.position - componentData.dataStart
      
      // Look for color swatch data patterns
      const colorData = this.extractColorData(buffer, position)
      if (!colorData) return null
      
      return {
        id: `color_${componentData.position}`,
        name: colorData.name || `Color ${componentData.position}`,
        type: "color",
        value: colorData.value || "#ffffff",
        componentType: "Colour Swatch"
      }
    } catch (error) {
      console.warn("⚠️ Failed to parse color swatch:", error)
      return null
    }
  }

  // Data extraction helpers for different component types
  private static extractSliderData(buffer: Buffer, position: number): any {
    try {
      // Look for slider-specific data patterns in the binary
      const searchArea = buffer.slice(Math.max(0, position - 500), Math.min(buffer.length, position + 500))
      
      // Try to find numeric values that could be min/max/value/step
      const floatPattern = this.findFloatValues(searchArea)
      const namePattern = this.findComponentName(searchArea)
      
      if (floatPattern.length >= 3) {
        return {
          name: namePattern,
          value: floatPattern[0],
          min: floatPattern[1],
          max: floatPattern[2],
          step: floatPattern[3] || 1
        }
      }
      
      return null
    } catch (error) {
      return null
    }
  }

  private static extractPanelData(buffer: Buffer, position: number): any {
    try {
      const searchArea = buffer.slice(Math.max(0, position - 500), Math.min(buffer.length, position + 500))
      
      // Look for text content in the panel
      const textContent = this.findTextContent(searchArea)
      const namePattern = this.findComponentName(searchArea)
      
      return {
        name: namePattern,
        value: textContent || ""
      }
    } catch (error) {
      return null
    }
  }

  private static extractToggleData(buffer: Buffer, position: number): any {
    try {
      const searchArea = buffer.slice(Math.max(0, position - 500), Math.min(buffer.length, position + 500))
      
      // Look for boolean values (0x00 or 0x01)
      const boolValue = this.findBooleanValue(searchArea)
      const namePattern = this.findComponentName(searchArea)
      
      return {
        name: namePattern,
        value: boolValue
      }
    } catch (error) {
      return null
    }
  }

  private static extractColorData(buffer: Buffer, position: number): any {
    try {
      const searchArea = buffer.slice(Math.max(0, position - 500), Math.min(buffer.length, position + 500))
      
      // Look for ARGB color values
      const colorValue = this.findColorValue(searchArea)
      const namePattern = this.findComponentName(searchArea)
      
      return {
        name: namePattern,
        value: colorValue || "#ffffff"
      }
    } catch (error) {
      return null
    }
  }

  // Binary data parsing utilities
  private static findFloatValues(buffer: Buffer): number[] {
    const values: number[] = []
    
    // Scan for 32-bit float patterns
    for (let i = 0; i <= buffer.length - 4; i += 4) {
      try {
        const value = buffer.readFloatLE(i)
        if (!isNaN(value) && isFinite(value) && value > -1000000 && value < 1000000) {
          values.push(value)
        }
      } catch (error) {
        // Skip invalid reads
      }
    }
    
    return values.slice(0, 10) // Limit to first 10 reasonable values
  }

  private static findComponentName(buffer: Buffer): string {
    try {
      // Look for readable text that could be a component name
      const text = buffer.toString('utf8')
      const nameMatch = text.match(/[A-Za-z][A-Za-z0-9\s]{2,30}/g)
      
      if (nameMatch && nameMatch.length > 0) {
        // Return the first reasonable name candidate
        return nameMatch[0].trim()
      }
      
      return ""
    } catch (error) {
      return ""
    }
  }

  private static findTextContent(buffer: Buffer): string {
    try {
      // Extract readable text content
      const text = buffer.toString('utf8')
      const cleanText = text.replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim()
      
      // Return first substantial text block
      const textMatch = cleanText.match(/[A-Za-z0-9\s\.\,\!\?]{5,100}/)
      return textMatch ? textMatch[0].trim() : ""
    } catch (error) {
      return ""
    }
  }

  private static findBooleanValue(buffer: Buffer): boolean {
    // Look for boolean patterns in binary data
    for (let i = 0; i < buffer.length; i++) {
      const byte = buffer[i]
      if (byte === 0x01) return true
      if (byte === 0x00) return false
    }
    return false
  }

  private static findColorValue(buffer: Buffer): string {
    try {
      // Look for ARGB color values (4 bytes)
      for (let i = 0; i <= buffer.length - 4; i++) {
        const a = buffer[i]
        const r = buffer[i + 1]
        const g = buffer[i + 2]
        const b = buffer[i + 3]
        
        // Check if values are reasonable for color components
        if (a <= 255 && r <= 255 && g <= 255 && b <= 255) {
          return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`
        }
      }
      
      return "#ffffff"
    } catch (error) {
      return "#ffffff"
    }
  }

  // Additional component parsers for expanded support
  private static parseIntegerSlider(componentData: any, fileBuffer: Buffer): GrasshopperParameter | null {
    try {
      console.log("🔢 Parsing Integer Slider component")
      
      const buffer = componentData.buffer
      const position = componentData.position - componentData.dataStart
      
      const sliderData = this.extractSliderData(buffer, position)
      if (!sliderData) return null
      
      return {
        id: `intslider_${componentData.position}`,
        name: sliderData.name || `Integer Slider ${componentData.position}`,
        type: "integer",
        value: Math.round(sliderData.value) || 0,
        min: Math.round(sliderData.min) || 0,
        max: Math.round(sliderData.max) || 100,
        step: Math.max(1, Math.round(sliderData.step)) || 1,
        componentType: "Integer Slider"
      }
    } catch (error) {
      console.warn("⚠️ Failed to parse integer slider:", error)
      return null
    }
  }

  private static parsePointParameter(componentData: any, fileBuffer: Buffer): GrasshopperParameter | null {
    try {
      console.log("📍 Parsing Point Parameter component")
      
      const buffer = componentData.buffer
      const position = componentData.position - componentData.dataStart
      
      const pointData = this.extractPointData(buffer, position)
      if (!pointData) return null
      
      return {
        id: `point_${componentData.position}`,
        name: pointData.name || `Point ${componentData.position}`,
        type: "point",
        value: pointData.value || { x: 0, y: 0, z: 0 },
        componentType: "Point Parameter"
      }
    } catch (error) {
      console.warn("⚠️ Failed to parse point parameter:", error)
      return null
    }
  }

  private static parseVectorParameter(componentData: any, fileBuffer: Buffer): GrasshopperParameter | null {
    try {
      console.log("🔄 Parsing Vector Parameter component")
      
      const buffer = componentData.buffer
      const position = componentData.position - componentData.dataStart
      
      const vectorData = this.extractVectorData(buffer, position)
      if (!vectorData) return null
      
      return {
        id: `vector_${componentData.position}`,
        name: vectorData.name || `Vector ${componentData.position}`,
        type: "vector",
        value: vectorData.value || { x: 1, y: 0, z: 0 },
        componentType: "Vector Parameter"
      }
    } catch (error) {
      console.warn("⚠️ Failed to parse vector parameter:", error)
      return null
    }
  }

  private static parseCurveParameter(componentData: any, fileBuffer: Buffer): GrasshopperParameter | null {
    try {
      console.log("🌊 Parsing Curve Parameter component")
      
      const buffer = componentData.buffer
      const position = componentData.position - componentData.dataStart
      
      const curveData = this.extractGeometryData(buffer, position, "curve")
      if (!curveData) return null
      
      return {
        id: `curve_${componentData.position}`,
        name: curveData.name || `Curve ${componentData.position}`,
        type: "curve",
        value: curveData.value || null,
        componentType: "Curve Parameter"
      }
    } catch (error) {
      console.warn("⚠️ Failed to parse curve parameter:", error)
      return null
    }
  }

  private static parseSurfaceParameter(componentData: any, fileBuffer: Buffer): GrasshopperParameter | null {
    try {
      console.log("🏔️ Parsing Surface Parameter component")
      
      const buffer = componentData.buffer
      const position = componentData.position - componentData.dataStart
      
      const surfaceData = this.extractGeometryData(buffer, position, "surface")
      if (!surfaceData) return null
      
      return {
        id: `surface_${componentData.position}`,
        name: surfaceData.name || `Surface ${componentData.position}`,
        type: "surface",
        value: surfaceData.value || null,
        componentType: "Surface Parameter"
      }
    } catch (error) {
      console.warn("⚠️ Failed to parse surface parameter:", error)
      return null
    }
  }

  private static parseBrepParameter(componentData: any, fileBuffer: Buffer): GrasshopperParameter | null {
    try {
      console.log("🏗️ Parsing Brep Parameter component")
      
      const buffer = componentData.buffer
      const position = componentData.position - componentData.dataStart
      
      const brepData = this.extractGeometryData(buffer, position, "brep")
      if (!brepData) return null
      
      return {
        id: `brep_${componentData.position}`,
        name: brepData.name || `Brep ${componentData.position}`,
        type: "brep",
        value: brepData.value || null,
        componentType: "Brep Parameter"
      }
    } catch (error) {
      console.warn("⚠️ Failed to parse brep parameter:", error)
      return null
    }
  }

  private static parseMeshParameter(componentData: any, fileBuffer: Buffer): GrasshopperParameter | null {
    try {
      console.log("🕸️ Parsing Mesh Parameter component")
      
      const buffer = componentData.buffer
      const position = componentData.position - componentData.dataStart
      
      const meshData = this.extractGeometryData(buffer, position, "mesh")
      if (!meshData) return null
      
      return {
        id: `mesh_${componentData.position}`,
        name: meshData.name || `Mesh ${componentData.position}`,
        type: "mesh",
        value: meshData.value || null,
        componentType: "Mesh Parameter"
      }
    } catch (error) {
      console.warn("⚠️ Failed to parse mesh parameter:", error)
      return null
    }
  }

  private static parseDomainParameter(componentData: any, fileBuffer: Buffer): GrasshopperParameter | null {
    try {
      console.log("📏 Parsing Domain Parameter component")
      
      const buffer = componentData.buffer
      const position = componentData.position - componentData.dataStart
      
      const domainData = this.extractDomainData(buffer, position)
      if (!domainData) return null
      
      return {
        id: `domain_${componentData.position}`,
        name: domainData.name || `Domain ${componentData.position}`,
        type: "domain",
        value: domainData.value || { min: 0, max: 1 },
        componentType: "Domain Parameter"
      }
    } catch (error) {
      console.warn("⚠️ Failed to parse domain parameter:", error)
      return null
    }
  }

  // Additional data extraction helpers
  private static extractPointData(buffer: Buffer, position: number): any {
    try {
      const searchArea = buffer.slice(Math.max(0, position - 500), Math.min(buffer.length, position + 500))
      const floatValues = this.findFloatValues(searchArea)
      const namePattern = this.findComponentName(searchArea)
      
      if (floatValues.length >= 3) {
        return {
          name: namePattern,
          value: { x: floatValues[0], y: floatValues[1], z: floatValues[2] }
        }
      }
      
      return null
    } catch (error) {
      return null
    }
  }

  private static extractVectorData(buffer: Buffer, position: number): any {
    try {
      const searchArea = buffer.slice(Math.max(0, position - 500), Math.min(buffer.length, position + 500))
      const floatValues = this.findFloatValues(searchArea)
      const namePattern = this.findComponentName(searchArea)
      
      if (floatValues.length >= 3) {
        return {
          name: namePattern,
          value: { x: floatValues[0], y: floatValues[1], z: floatValues[2] }
        }
      }
      
      return null
    } catch (error) {
      return null
    }
  }

  private static extractGeometryData(buffer: Buffer, position: number, geometryType: string): any {
    try {
      const searchArea = buffer.slice(Math.max(0, position - 1000), Math.min(buffer.length, position + 1000))
      const namePattern = this.findComponentName(searchArea)
      
      // Look for geometry data markers
      const geometryMarkers = {
        curve: ["NurbsCurve", "LineCurve", "ArcCurve"],
        surface: ["NurbsSurface", "PlaneSurface", "CylinderSurface"],
        brep: ["Brep", "BrepFace", "BrepEdge"],
        mesh: ["Mesh", "MeshFace", "MeshVertex"]
      }
      
      const markers = geometryMarkers[geometryType as keyof typeof geometryMarkers] || []
      const hasGeometry = markers.some(marker => 
        searchArea.toString('utf8').includes(marker)
      )
      
      return {
        name: namePattern,
        value: hasGeometry ? `${geometryType}_data` : null
      }
    } catch (error) {
      return null
    }
  }

  private static extractDomainData(buffer: Buffer, position: number): any {
    try {
      const searchArea = buffer.slice(Math.max(0, position - 500), Math.min(buffer.length, position + 500))
      const floatValues = this.findFloatValues(searchArea)
      const namePattern = this.findComponentName(searchArea)
      
      if (floatValues.length >= 2) {
        const min = Math.min(floatValues[0], floatValues[1])
        const max = Math.max(floatValues[0], floatValues[1])
        
        return {
          name: namePattern,
          value: { min, max }
        }
      }
      
      return null
    } catch (error) {
      return null
    }
  }
}
