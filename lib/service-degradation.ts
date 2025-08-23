// Service degradation manager for graceful handling of service failures
import { HealthMonitor } from "./health-monitor"
import { Logger } from "./logger"

interface DegradationStrategy {
  serviceName: string
  fallbackEnabled: boolean
  fallbackFunction?: () => Promise<any> | any
  gracePeriod: number // Time to wait before switching to fallback
  retryInterval: number // How often to retry the service
  maxRetries: number
}

interface ServiceState {
  isHealthy: boolean
  isDegraded: boolean
  fallbackActive: boolean
  lastSuccessfulCall: Date
  consecutiveFailures: number
  nextRetryTime: Date
}

class ServiceDegradationManager {
  private static strategies = new Map<string, DegradationStrategy>()
  private static serviceStates = new Map<string, ServiceState>()
  private static retryTimers = new Map<string, NodeJS.Timeout>()

  static registerService(strategy: DegradationStrategy): void {
    this.strategies.set(strategy.serviceName, strategy)
    this.serviceStates.set(strategy.serviceName, {
      isHealthy: true,
      isDegraded: false,
      fallbackActive: false,
      lastSuccessfulCall: new Date(),
      consecutiveFailures: 0,
      nextRetryTime: new Date()
    })

    Logger.info(`Registered service degradation strategy for ${strategy.serviceName}`, {
      operation: 'service_registration',
      metadata: { serviceName: strategy.serviceName, fallbackEnabled: strategy.fallbackEnabled }
    })
  }

  static async executeWithDegradation<T>(
    serviceName: string,
    primaryFunction: () => Promise<T>,
    requestId?: string
  ): Promise<T> {
    const strategy = this.strategies.get(serviceName)
    const state = this.serviceStates.get(serviceName)

    if (!strategy || !state) {
      Logger.warn(`No degradation strategy found for service: ${serviceName}`, { requestId })
      return await primaryFunction()
    }

    // Check if we should use fallback immediately
    if (state.fallbackActive && strategy.fallbackEnabled) {
      Logger.info(`Using fallback for ${serviceName} (service degraded)`, {
        requestId,
        operation: 'fallback_execution',
        metadata: { serviceName }
      })
      
      if (strategy.fallbackFunction) {
        return await strategy.fallbackFunction()
      }
    }

    // Try the primary service
    const startTime = Date.now()
    try {
      Logger.debug(`Attempting primary service call for ${serviceName}`, { requestId })
      const result = await primaryFunction()
      
      // Success - reset failure state
      this.handleServiceSuccess(serviceName, Date.now() - startTime, requestId)
      return result

    } catch (error) {
      const duration = Date.now() - startTime
      Logger.error(`Primary service call failed for ${serviceName}`, {
        requestId,
        error: error instanceof Error ? error : new Error(String(error)),
        duration,
        metadata: { serviceName }
      })

      // Handle failure and potentially use fallback
      return await this.handleServiceFailure(serviceName, error, requestId, strategy, state)
    }
  }

  private static handleServiceSuccess(serviceName: string, duration: number, requestId?: string): void {
    const state = this.serviceStates.get(serviceName)
    if (!state) return

    state.isHealthy = true
    state.isDegraded = false
    state.fallbackActive = false
    state.lastSuccessfulCall = new Date()
    state.consecutiveFailures = 0

    // Clear any retry timers
    const timer = this.retryTimers.get(serviceName)
    if (timer) {
      clearTimeout(timer)
      this.retryTimers.delete(serviceName)
    }

    Logger.info(`Service ${serviceName} recovered successfully`, {
      requestId,
      duration,
      operation: 'service_recovery',
      metadata: { serviceName }
    })
  }

  private static async handleServiceFailure<T>(
    serviceName: string,
    error: any,
    requestId: string | undefined,
    strategy: DegradationStrategy,
    state: ServiceState
  ): Promise<T> {
    state.consecutiveFailures++
    state.isHealthy = false

    // Determine if we should degrade the service
    const timeSinceLastSuccess = Date.now() - state.lastSuccessfulCall.getTime()
    const shouldDegrade = timeSinceLastSuccess > strategy.gracePeriod || 
                         state.consecutiveFailures >= strategy.maxRetries

    if (shouldDegrade && strategy.fallbackEnabled && strategy.fallbackFunction) {
      state.isDegraded = true
      state.fallbackActive = true

      Logger.warn(`Service ${serviceName} degraded, switching to fallback`, {
        requestId,
        operation: 'service_degradation',
        metadata: { 
          serviceName, 
          consecutiveFailures: state.consecutiveFailures,
          timeSinceLastSuccess 
        }
      })

      // Schedule retry attempt
      this.scheduleServiceRetry(serviceName, strategy, requestId)

      try {
        return await strategy.fallbackFunction()
      } catch (fallbackError) {
        Logger.error(`Fallback also failed for ${serviceName}`, {
          requestId,
          error: fallbackError instanceof Error ? fallbackError : new Error(String(fallbackError)),
          metadata: { serviceName }
        })
        throw fallbackError
      }
    } else {
      // Not degraded yet, just throw the original error
      throw error
    }
  }

  private static scheduleServiceRetry(serviceName: string, strategy: DegradationStrategy, requestId?: string): void {
    // Clear existing timer
    const existingTimer = this.retryTimers.get(serviceName)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    const retryTimer = setTimeout(async () => {
      Logger.debug(`Attempting service retry for ${serviceName}`, { requestId })
      
      try {
        // Use health monitor to check service
        await HealthMonitor.checkServiceHealth(serviceName, async () => {
          // Simple health check - this would be service-specific
          return { success: true, responseTime: 0 }
        })

        const health = HealthMonitor.getServiceHealth(serviceName)
        if (health && health.status === 'healthy') {
          const state = this.serviceStates.get(serviceName)
          if (state) {
            state.fallbackActive = false
            state.isDegraded = false
            Logger.info(`Service ${serviceName} is healthy again, disabling fallback`, { requestId })
          }
        } else {
          // Schedule another retry
          this.scheduleServiceRetry(serviceName, strategy, requestId)
        }
      } catch (retryError) {
        Logger.debug(`Service retry failed for ${serviceName}, will try again later`, { requestId })
        // Schedule another retry
        this.scheduleServiceRetry(serviceName, strategy, requestId)
      }
    }, strategy.retryInterval)

    this.retryTimers.set(serviceName, retryTimer)
  }

  static getServiceState(serviceName: string): ServiceState | null {
    return this.serviceStates.get(serviceName) || null
  }

  static getAllServiceStates(): Map<string, ServiceState> {
    return new Map(this.serviceStates)
  }

  static isServiceDegraded(serviceName: string): boolean {
    const state = this.serviceStates.get(serviceName)
    return state ? state.isDegraded : false
  }

  static isUsingFallback(serviceName: string): boolean {
    const state = this.serviceStates.get(serviceName)
    return state ? state.fallbackActive : false
  }

  static forceServiceDegradation(serviceName: string, requestId?: string): void {
    const state = this.serviceStates.get(serviceName)
    const strategy = this.strategies.get(serviceName)
    
    if (state && strategy) {
      state.isDegraded = true
      state.fallbackActive = strategy.fallbackEnabled
      state.isHealthy = false
      
      Logger.warn(`Forced degradation for service ${serviceName}`, {
        requestId,
        operation: 'forced_degradation',
        metadata: { serviceName }
      })
    }
  }

  static restoreService(serviceName: string, requestId?: string): void {
    const state = this.serviceStates.get(serviceName)
    
    if (state) {
      state.isDegraded = false
      state.fallbackActive = false
      state.isHealthy = true
      state.consecutiveFailures = 0
      state.lastSuccessfulCall = new Date()
      
      // Clear retry timer
      const timer = this.retryTimers.get(serviceName)
      if (timer) {
        clearTimeout(timer)
        this.retryTimers.delete(serviceName)
      }
      
      Logger.info(`Manually restored service ${serviceName}`, {
        requestId,
        operation: 'service_restoration',
        metadata: { serviceName }
      })
    }
  }

  static getDegradationSummary(): {
    total: number
    healthy: number
    degraded: number
    usingFallback: number
  } {
    const states = Array.from(this.serviceStates.values())
    
    return {
      total: states.length,
      healthy: states.filter(s => s.isHealthy).length,
      degraded: states.filter(s => s.isDegraded).length,
      usingFallback: states.filter(s => s.fallbackActive).length
    }
  }

  static cleanup(): void {
    // Clear all retry timers
    this.retryTimers.forEach(timer => clearTimeout(timer))
    this.retryTimers.clear()
    
    Logger.info('Service degradation manager cleaned up')
  }
}

export { ServiceDegradationManager, type DegradationStrategy, type ServiceState }
