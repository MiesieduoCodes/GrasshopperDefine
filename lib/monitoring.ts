import * as Sentry from "@sentry/nextjs"

// Initialize Sentry
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  beforeSend(event) {
    // Filter out non-critical errors in production
    if (process.env.NODE_ENV === "production") {
      if (event.exception?.values?.[0]?.type === "ChunkLoadError") {
        return null // Don't send chunk load errors
      }
    }
    return event
  },
  integrations: [
    // Remove BrowserTracing as it's not available in this version
  ],
})

interface PerformanceMetrics {
  computeTime: number
  cacheHitRate: number
  queueSize: number
  activeNodes: number
  totalRequests: number
  errorRate: number
}

class MonitoringService {
  private metrics: PerformanceMetrics = {
    computeTime: 0,
    cacheHitRate: 0,
    queueSize: 0,
    activeNodes: 0,
    totalRequests: 0,
    errorRate: 0,
  }

  // Track compute performance
  trackComputeTime(duration: number, success: boolean) {
    Sentry.addBreadcrumb({
      message: "Compute operation",
      data: { duration, success },
      level: success ? "info" : "error",
    })

    // Update metrics
    this.metrics.computeTime = duration
    this.metrics.totalRequests++

    if (!success) {
      this.updateErrorRate()
    }

    // Alert on slow operations
    if (duration > 30000) {
      // 30 seconds
      Sentry.captureMessage(`Slow compute operation: ${duration}ms`, "warning")
    }
  }

  // Track cache performance
  trackCacheHit(hit: boolean) {
    // Remove transaction tracking as it's not available in this version
    Sentry.addBreadcrumb({
      message: "Cache access",
      data: { hit },
      level: "info",
    })
  }

  // Track system health
  updateSystemMetrics(metrics: any) {
    this.metrics = { ...this.metrics, ...metrics }

    // Alert on high queue size
    if (metrics.queueSize > 50) {
      Sentry.captureMessage(`High queue size: ${metrics.queueSize}`, "warning")
    }

    // Alert on low cache hit rate
    if (metrics.cacheHitRate < 0.5) {
      Sentry.captureMessage(`Low cache hit rate: ${metrics.cacheHitRate}`, "warning")
    }

    // Alert on node failures
    if (metrics.activeNodes === 0) {
      Sentry.captureMessage("All Rhino.Compute nodes are down", "error")
    }
  }

  private updateErrorRate() {
    // Calculate error rate over last 100 requests
    // This is simplified - in production you'd use a sliding window
    this.metrics.errorRate = Math.min(this.metrics.errorRate + 0.01, 1.0)
  }

  // Custom error tracking
  captureError(error: Error, context: Record<string, any> = {}) {
    Sentry.withScope((scope) => {
      Object.entries(context).forEach(([key, value]) => {
        scope.setExtra(key, value)
      })

      scope.setTag("component", context.component || "unknown")
      Sentry.captureException(error)
    })
  }

  // Performance monitoring
  startTransaction(name: string, operation: string) {
    // Remove transaction tracking as it's not available in this version
    return null
  }

  // User feedback
  captureUserFeedback(feedback: {
    name?: string
    email?: string
    comments: string
  }) {
    const user = Sentry.getCurrentHub().getScope()?.getUser()
    const eventId = Sentry.lastEventId()
    if (eventId) {
      Sentry.captureUserFeedback({
        event_id: eventId,
        name: feedback.name || user?.username || "Anonymous",
        email: feedback.email || user?.email || "unknown@example.com",
        comments: feedback.comments,
      })
    }
  }

  getMetrics(): PerformanceMetrics {
    return { ...this.metrics }
  }
}

export const monitoring = new MonitoringService()

// Global error handler
if (typeof window !== "undefined") {
  window.addEventListener("unhandledrejection", (event) => {
    monitoring.captureError(new Error(event.reason), {
      component: "unhandled_promise_rejection",
    })
  })
}
