// Health monitoring system for external services
interface ServiceHealth {
  name: string
  status: 'healthy' | 'degraded' | 'unhealthy'
  lastCheck: Date
  responseTime?: number
  errorCount: number
  consecutiveFailures: number
  lastError?: string
}

interface HealthCheckResult {
  success: boolean
  responseTime: number
  error?: string
}

class HealthMonitor {
  private static services = new Map<string, ServiceHealth>()
  private static checkIntervals = new Map<string, NodeJS.Timeout>()

  static initializeService(serviceName: string): void {
    if (!this.services.has(serviceName)) {
      this.services.set(serviceName, {
        name: serviceName,
        status: 'healthy',
        lastCheck: new Date(),
        errorCount: 0,
        consecutiveFailures: 0
      })
      
      console.log(`🏥 Health monitor initialized for service: ${serviceName}`)
    }
  }

  static async checkServiceHealth(serviceName: string, healthCheckFn: () => Promise<HealthCheckResult>): Promise<void> {
    const service = this.services.get(serviceName)
    if (!service) {
      this.initializeService(serviceName)
      return this.checkServiceHealth(serviceName, healthCheckFn)
    }

    try {
      console.log(`🔍 Checking health for service: ${serviceName}`)
      const result = await healthCheckFn()
      
      service.lastCheck = new Date()
      service.responseTime = result.responseTime

      if (result.success) {
        service.consecutiveFailures = 0
        service.status = result.responseTime > 5000 ? 'degraded' : 'healthy'
        console.log(`✅ Service ${serviceName} is ${service.status} (${result.responseTime}ms)`)
      } else {
        service.errorCount++
        service.consecutiveFailures++
        service.lastError = result.error
        
        // Determine status based on consecutive failures
        if (service.consecutiveFailures >= 3) {
          service.status = 'unhealthy'
        } else if (service.consecutiveFailures >= 1) {
          service.status = 'degraded'
        }
        
        console.warn(`⚠️ Service ${serviceName} health check failed: ${result.error}`)
      }
    } catch (error) {
      service.errorCount++
      service.consecutiveFailures++
      service.lastError = error instanceof Error ? error.message : 'Unknown error'
      service.status = 'unhealthy'
      service.lastCheck = new Date()
      
      console.error(`❌ Health check error for ${serviceName}:`, error)
    }

    this.services.set(serviceName, service)
  }

  static getServiceHealth(serviceName: string): ServiceHealth | null {
    return this.services.get(serviceName) || null
  }

  static getAllServicesHealth(): ServiceHealth[] {
    return Array.from(this.services.values())
  }

  static isServiceHealthy(serviceName: string): boolean {
    const service = this.services.get(serviceName)
    return service ? service.status === 'healthy' : false
  }

  static isServiceAvailable(serviceName: string): boolean {
    const service = this.services.get(serviceName)
    return service ? service.status !== 'unhealthy' : true // Default to available if not monitored
  }

  static shouldUseService(serviceName: string): boolean {
    const service = this.services.get(serviceName)
    if (!service) return true // Default to using service if not monitored
    
    // Use service if healthy or degraded, but not if unhealthy
    return service.status !== 'unhealthy'
  }

  static startPeriodicHealthChecks(serviceName: string, healthCheckFn: () => Promise<HealthCheckResult>, intervalMs: number = 60000): void {
    // Clear existing interval if any
    const existingInterval = this.checkIntervals.get(serviceName)
    if (existingInterval) {
      clearInterval(existingInterval)
    }

    // Start new periodic check
    const interval = setInterval(async () => {
      await this.checkServiceHealth(serviceName, healthCheckFn)
    }, intervalMs)

    this.checkIntervals.set(serviceName, interval)
    console.log(`⏰ Started periodic health checks for ${serviceName} every ${intervalMs}ms`)

    // Run initial check
    this.checkServiceHealth(serviceName, healthCheckFn)
  }

  static stopPeriodicHealthChecks(serviceName: string): void {
    const interval = this.checkIntervals.get(serviceName)
    if (interval) {
      clearInterval(interval)
      this.checkIntervals.delete(serviceName)
      console.log(`⏹️ Stopped periodic health checks for ${serviceName}`)
    }
  }

  static getServiceStatus(serviceName: string): 'healthy' | 'degraded' | 'unhealthy' | 'unknown' {
    const service = this.services.get(serviceName)
    return service ? service.status : 'unknown'
  }

  static resetServiceHealth(serviceName: string): void {
    const service = this.services.get(serviceName)
    if (service) {
      service.errorCount = 0
      service.consecutiveFailures = 0
      service.status = 'healthy'
      service.lastError = undefined
      console.log(`🔄 Reset health status for service: ${serviceName}`)
    }
  }

  static getHealthSummary(): { healthy: number; degraded: number; unhealthy: number; total: number } {
    const services = Array.from(this.services.values())
    return {
      healthy: services.filter(s => s.status === 'healthy').length,
      degraded: services.filter(s => s.status === 'degraded').length,
      unhealthy: services.filter(s => s.status === 'unhealthy').length,
      total: services.length
    }
  }
}

export { HealthMonitor, type ServiceHealth, type HealthCheckResult }
