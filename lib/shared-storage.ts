// Shared in-memory storage for definitions

interface Definition {
  id: string
  name: string
  description: string
  parameters: Parameter[]
  geometry: any
  originalFileBuffer: Buffer
  uploadedAt: string
  metadata?: any
}

interface Parameter {
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

const definitions = new Map<string, Definition>()

export function getDefinitions(): Map<string, Definition> {
  return definitions
}

export function setDefinition(id: string, definition: Definition): void {
  definitions.set(id, definition)
}

export function getDefinition(id: string): Definition | undefined {
  return definitions.get(id)
}

export function deleteDefinition(id: string): boolean {
  return definitions.delete(id)
}

export function getAllDefinitions(): Definition[] {
  return Array.from(definitions.values())
} 