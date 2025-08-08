import { RhinoComputeService } from "./rhino-compute"

// Simple production wrapper for Rhino.Compute
export const rhinoComputeCluster = {
  async computeGeometry(
    fileBuffer: Buffer,
    parameters: any[],
    priority: number = 1
  ) {
    // Convert parameters to the format expected by RhinoComputeService
    const formattedParameters = parameters.map((param) => ({
      id: param.name,
      name: param.name,
      type: param.type || "number",
      value: param.value
    }))

    // Use the existing RhinoComputeService
    const result = await RhinoComputeService.computeGeometry(fileBuffer, formattedParameters)
    return result
  }
}
