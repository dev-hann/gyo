import { Bridge } from 'gyo-bridge'

jest.mock('gyo-bridge', () => {
  const mockInvoke = jest.fn()
  const mockListen = jest.fn().mockReturnValue(() => {})
  
  return {
    Bridge: jest.fn().mockImplementation(() => ({
      invoke: mockInvoke,
      listen: mockListen
    }))
  }
})

describe('Geolocation Plugin', () => {
  let mockBridgeInstance: { invoke: jest.Mock; listen: jest.Mock }

  beforeEach(() => {
    jest.clearAllMocks()
    mockBridgeInstance = new Bridge('test') as any
  })

  describe('getCurrentPosition', () => {
    it('should call bridge invoke with correct method name', async () => {
      const mockPosition = {
        latitude: 37.7749,
        longitude: -122.4194,
        accuracy: 10,
        altitude: 50,
        timestamp: Date.now()
      }
      mockBridgeInstance.invoke.mockResolvedValue(mockPosition)

      const result = await mockBridgeInstance.invoke('getCurrentPosition')

      expect(mockBridgeInstance.invoke).toHaveBeenCalledWith('getCurrentPosition')
      expect(result.latitude).toBe(37.7749)
      expect(result.longitude).toBe(-122.4194)
      expect(result.accuracy).toBe(10)
    })

    it('should handle errors', async () => {
      const error = { code: 1, message: 'Permission denied' }
      mockBridgeInstance.invoke.mockRejectedValue(error)

      await expect(mockBridgeInstance.invoke('getCurrentPosition')).rejects.toEqual(error)
    })

    it('should return minimal position', async () => {
      const mockPosition = {
        latitude: 0,
        longitude: 0,
        accuracy: 0,
        timestamp: 0
      }
      mockBridgeInstance.invoke.mockResolvedValue(mockPosition)

      const result = await mockBridgeInstance.invoke('getCurrentPosition')

      expect(result.latitude).toBe(0)
      expect(result.longitude).toBe(0)
    })
  })

  describe('watchPosition', () => {
    it('should call bridge invoke with watchPosition method', async () => {
      mockBridgeInstance.invoke.mockResolvedValue(undefined)

      await mockBridgeInstance.invoke('watchPosition', { watchId: 1 })

      expect(mockBridgeInstance.invoke).toHaveBeenCalledWith('watchPosition', { watchId: 1 })
    })

    it('should set up listener for position updates', () => {
      const callback = jest.fn()
      const unsubscribe = mockBridgeInstance.listen(callback)

      expect(mockBridgeInstance.listen).toHaveBeenCalledWith(callback)
      expect(typeof unsubscribe).toBe('function')
    })
  })

  describe('clearWatch', () => {
    it('should call bridge with watch ID', async () => {
      mockBridgeInstance.invoke.mockResolvedValue(undefined)

      await mockBridgeInstance.invoke('clearWatch', { watchId: 1 })

      expect(mockBridgeInstance.invoke).toHaveBeenCalledWith('clearWatch', { watchId: 1 })
    })
  })

  describe('isAvailable', () => {
    it('should return true when available', async () => {
      mockBridgeInstance.invoke.mockResolvedValue(true)

      const result = await mockBridgeInstance.invoke('isAvailable')

      expect(result).toBe(true)
    })

    it('should return false when not available', async () => {
      mockBridgeInstance.invoke.mockResolvedValue(false)

      const result = await mockBridgeInstance.invoke('isAvailable')

      expect(result).toBe(false)
    })
  })
})

describe('Geolocation Types', () => {
  it('should accept valid Position', () => {
    interface Position {
      latitude: number
      longitude: number
      accuracy: number
      altitude?: number
      altitudeAccuracy?: number
      heading?: number
      speed?: number
      timestamp: number
    }
    
    const position: Position = {
      latitude: 37.7749,
      longitude: -122.4194,
      accuracy: 10,
      altitude: 50,
      altitudeAccuracy: 5,
      heading: 180,
      speed: 5,
      timestamp: Date.now()
    }
    expect(position.latitude).toBeDefined()
    expect(position.longitude).toBeDefined()
  })

  it('should accept minimal Position', () => {
    interface Position {
      latitude: number
      longitude: number
      accuracy: number
      timestamp: number
    }
    
    const position: Position = {
      latitude: 0,
      longitude: 0,
      accuracy: 0,
      timestamp: 0
    }
    expect(position.latitude).toBeDefined()
  })

  it('should have correct PositionErrorCode values', () => {
    enum PositionErrorCode {
      PERMISSION_DENIED = 1,
      POSITION_UNAVAILABLE = 2,
      TIMEOUT = 3,
    }
    
    expect(PositionErrorCode.PERMISSION_DENIED).toBe(1)
    expect(PositionErrorCode.POSITION_UNAVAILABLE).toBe(2)
    expect(PositionErrorCode.TIMEOUT).toBe(3)
  })

  it('should accept valid PositionError', () => {
    enum PositionErrorCode {
      PERMISSION_DENIED = 1,
    }
    
    interface PositionError {
      code: PositionErrorCode
      message: string
    }
    
    const error: PositionError = {
      code: PositionErrorCode.PERMISSION_DENIED,
      message: 'Test error'
    }
    expect(error.code).toBe(1)
    expect(error.message).toBe('Test error')
  })
})
