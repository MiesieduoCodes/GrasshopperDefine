// Centralized logging utility with structured logging and different levels
interface LogContext {
  requestId?: string
  userId?: string
  definitionId?: string
  operation?: string
  duration?: number
  error?: Error
  metadata?: Record<string, any>
}

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  context?: LogContext
  emoji?: string
}

class Logger {
  private static logs: LogEntry[] = []
  private static maxLogs = 1000
  private static logLevel: LogLevel = process.env.LOG_LEVEL as LogLevel || 'info'

  private static shouldLog(level: LogLevel): boolean {
    const levels: Record<LogLevel, number> = {
      debug: 0,
      info: 1,
      warn: 2,
      error: 3
    }
    
    return levels[level] >= levels[this.logLevel]
  }

  private static formatMessage(level: LogLevel, message: string, context?: LogContext): string {
    const emoji = this.getEmoji(level)
    const timestamp = new Date().toISOString()
    
    let formatted = `${emoji} [${level.toUpperCase()}] ${message}`
    
    if (context?.requestId) {
      formatted += ` | RequestID: ${context.requestId}`
    }
    
    if (context?.operation) {
      formatted += ` | Operation: ${context.operation}`
    }
    
    if (context?.duration) {
      formatted += ` | Duration: ${context.duration}ms`
    }
    
    return formatted
  }

  private static getEmoji(level: LogLevel): string {
    const emojis: Record<LogLevel, string> = {
      debug: '🔍',
      info: 'ℹ️',
      warn: '⚠️',
      error: '❌'
    }
    
    return emojis[level]
  }

  private static addToHistory(entry: LogEntry): void {
    this.logs.push(entry)
    
    // Keep only the most recent logs
    if (this.logs.length > this.maxLogs) {
      this.logs = this.logs.slice(-this.maxLogs)
    }
  }

  static debug(message: string, context?: LogContext): void {
    if (!this.shouldLog('debug')) return
    
    const formatted = this.formatMessage('debug', message, context)
    console.debug(formatted)
    
    this.addToHistory({
      timestamp: new Date().toISOString(),
      level: 'debug',
      message,
      context,
      emoji: '🔍'
    })
  }

  static info(message: string, context?: LogContext): void {
    if (!this.shouldLog('info')) return
    
    const formatted = this.formatMessage('info', message, context)
    console.log(formatted)
    
    this.addToHistory({
      timestamp: new Date().toISOString(),
      level: 'info',
      message,
      context,
      emoji: 'ℹ️'
    })
  }

  static warn(message: string, context?: LogContext): void {
    if (!this.shouldLog('warn')) return
    
    const formatted = this.formatMessage('warn', message, context)
    console.warn(formatted)
    
    this.addToHistory({
      timestamp: new Date().toISOString(),
      level: 'warn',
      message,
      context,
      emoji: '⚠️'
    })
  }

  static error(message: string, context?: LogContext): void {
    if (!this.shouldLog('error')) return
    
    const formatted = this.formatMessage('error', message, context)
    console.error(formatted)
    
    if (context?.error) {
      console.error('Stack trace:', context.error.stack)
    }
    
    this.addToHistory({
      timestamp: new Date().toISOString(),
      level: 'error',
      message,
      context,
      emoji: '❌'
    })
  }

  // Specialized logging methods for common operations
  static startOperation(operation: string, requestId?: string, metadata?: Record<string, any>): void {
    this.info(`Starting ${operation}`, {
      requestId,
      operation,
      metadata
    })
  }

  static endOperation(operation: string, duration: number, requestId?: string, success: boolean = true): void {
    const level = success ? 'info' : 'warn'
    const message = `${success ? 'Completed' : 'Failed'} ${operation}`
    
    if (level === 'info') {
      this.info(message, { requestId, operation, duration })
    } else {
      this.warn(message, { requestId, operation, duration })
    }
  }

  static logServiceCall(serviceName: string, endpoint: string, duration: number, success: boolean, requestId?: string, error?: Error): void {
    const message = `Service call to ${serviceName}${endpoint ? ` (${endpoint})` : ''} ${success ? 'succeeded' : 'failed'}`
    
    if (success) {
      this.info(message, {
        requestId,
        operation: 'service_call',
        duration,
        metadata: { serviceName, endpoint }
      })
    } else {
      this.error(message, {
        requestId,
        operation: 'service_call',
        duration,
        error,
        metadata: { serviceName, endpoint }
      })
    }
  }

  static logFileOperation(operation: string, filename: string, size?: number, requestId?: string, success: boolean = true): void {
    const message = `File ${operation}: ${filename}${size ? ` (${size} bytes)` : ''}`
    
    if (success) {
      this.info(message, {
        requestId,
        operation: 'file_operation',
        metadata: { operation, filename, size }
      })
    } else {
      this.error(message, {
        requestId,
        operation: 'file_operation',
        metadata: { operation, filename, size }
      })
    }
  }

  static logGeometryOperation(operation: string, vertexCount: number, faceCount: number, requestId?: string): void {
    this.info(`Geometry ${operation}: ${vertexCount} vertices, ${faceCount} faces`, {
      requestId,
      operation: 'geometry_operation',
      metadata: { operation, vertexCount, faceCount }
    })
  }

  // Get recent logs for debugging
  static getRecentLogs(count: number = 50, level?: LogLevel): LogEntry[] {
    let filteredLogs = this.logs
    
    if (level) {
      filteredLogs = this.logs.filter(log => log.level === level)
    }
    
    return filteredLogs.slice(-count)
  }

  // Get logs for a specific request ID
  static getLogsForRequest(requestId: string): LogEntry[] {
    return this.logs.filter(log => log.context?.requestId === requestId)
  }

  // Clear old logs
  static clearLogs(): void {
    this.logs = []
    this.info('Log history cleared')
  }

  // Get log statistics
  static getLogStats(): { total: number; byLevel: Record<LogLevel, number> } {
    const byLevel: Record<LogLevel, number> = {
      debug: 0,
      info: 0,
      warn: 0,
      error: 0
    }
    
    this.logs.forEach(log => {
      byLevel[log.level]++
    })
    
    return {
      total: this.logs.length,
      byLevel
    }
  }
}

export { Logger, type LogContext, type LogLevel, type LogEntry }
