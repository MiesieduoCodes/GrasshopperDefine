// Simple in-memory cache for development
const cacheMap = new Map<string, { data: any; expires: number }>()

export const cache = {
  async getCachedGeometry(definitionHash: string, parametersHash: string) {
    const key = `${definitionHash}:${parametersHash}`
    const cached = cacheMap.get(key)
    
    if (cached && cached.expires > Date.now()) {
      return cached.data
    }
    
    if (cached) {
      cacheMap.delete(key)
    }
    
    return null
  },

  async cacheGeometry(definitionHash: string, parametersHash: string, geometry: any, ttlSeconds: number) {
    const key = `${definitionHash}:${parametersHash}`
    cacheMap.set(key, {
      data: geometry,
      expires: Date.now() + (ttlSeconds * 1000)
    })
  },

  async checkRateLimit(clientIp: string, maxRequests: number, windowSeconds: number): Promise<boolean> {
    // Simple rate limiting - in production use Redis
    const key = `rate_limit:${clientIp}`
    const now = Date.now()
    const window = now - (windowSeconds * 1000)
    
    const requests = cacheMap.get(key)?.data || []
    const recentRequests = requests.filter((timestamp: number) => timestamp > window)
    
    if (recentRequests.length >= maxRequests) {
      return false
    }
    
    recentRequests.push(now)
    cacheMap.set(key, { data: recentRequests, expires: now + (windowSeconds * 1000) })
    
    return true
  },

  async disconnect() {
    cacheMap.clear()
  }
}
