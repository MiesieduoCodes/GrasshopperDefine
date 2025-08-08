import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  try {
    // Simple authentication check
    const authHeader = request.headers.get("authorization")
    const expectedToken = process.env.MONITORING_TOKEN

    if (!expectedToken || authHeader !== `Bearer ${expectedToken}`) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Simple metrics for database-free setup
    const systemMetrics = {
      timestamp: new Date().toISOString(),
      system: {
        uptime: process.uptime(),
        memory: process.memoryUsage(),
        nodeVersion: process.version,
      },
      status: "running",
      database: "none (in-memory only)"
    }

    return NextResponse.json(systemMetrics)
  } catch (error) {
    console.error("Metrics error:", error)
    return NextResponse.json({ error: "Failed to get metrics" }, { status: 500 })
  }
}
