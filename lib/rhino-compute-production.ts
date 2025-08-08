import { RhinoComputeService } from "./rhino-compute"

// Simple production wrapper for Rhino.Compute
export const rhinoComputeCluster = {
  async computeGeometry(
    fileBuffer: Buffer,
    parameters: any[],
    priority: number = 1
  ) {
    // Convert parameters to the format expected by RhinoComputeService
    const paramObject = parameters.reduce((acc, param) => {
      acc[param.name.toLowerCase().replace(/\s+/g, "_")] = param.value
      return acc
    }, {} as Record<string, any>)

    // Use the existing RhinoComputeService
    const result = await RhinoComputeService.computeGeometry("", paramObject)
    return result.geometry[0]
  }
}
