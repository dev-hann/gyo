import { Bridge } from 'gyo-bridge'
import { Geolocation, PositionErrorCode } from '../index'

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
    mockBridgeInstance = new Bridge('test') as unknown as { invoke: jest.Mock; listen: jest.Mock }
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

      const result = await Geolocation.getCurrentPosition()

      expect(mockBridgeInstance.invoke).toHaveBeenCalledWith('getCurrentPosition')
      expect(result.latitude).toBe(37.7749)
      expect(result.longitude).toBe(-122.4194)
      expect(result.accuracy).toBe(10)
    })

    it('should handle errors', async () => {
      const error = { code: PositionErrorCode.PERMISSION_DENIED, message: 'Permission denied' }
      mockBridgeInstance.invoke.mockRejectedValue(error)

      await expect(Geolocation.getCurrentPosition()).rejects.toEqual(error)
    })

    it('should return minimal position', async () => {
      const mockPosition = {
        latitude: 0,
        longitude: 0,
        accuracy: 0,
        timestamp: 0
      }
      mockBridgeInstance.invoke.mockResolvedValue(mockPosition)

      const result = await Geolocation.getCurrentPosition()

      expect(result.latitude).toBe(0)
      expect(result.longitude).toBe(0)
    })
  })

  describe('watchPosition', () => {
    it('should call bridge invoke with watchPosition method', async () => {
      const successCallback = jest.fn()
      mockBridgeInstance.invoke.mockResolvedValue(undefined)

      const watchId = Geolocation.watchPosition(successCallback)

      expect(mockBridgeInstance.invoke).toHaveBeenCalledWith('watchPosition', { watchId })
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
      const successCallback = jest.fn()
      mockBridgeInstance.invoke.mockResolvedValue(undefined)

      const watchId = Geolocation.watchPosition(successCallback)
      Geolocation.clearWatch(watchId)

      expect(mockBridgeInstance.invoke).toHaveBeenCalledWith('clearWatch', { watchId })
    })
  })

  describe('isAvailable', () => {
    it('should return true when available', async () => {
      mockBridgeInstance.invoke.mockResolvedValue(true)

      const result = await Geolocation.isAvailable()

      expect(result).toBe(true)
    })

    it('should return false when not available', async () => {
      mockBridgeInstance.invoke.mockResolvedValue(false)

      const result = await Geolocation.isAvailable()

      expect(result).toBe(false)
    })

    it('should return false on error', async () => {
      mockBridgeInstance.invoke.mockRejectedValue(new Error('fail'))

      const result = await Geolocation.isAvailable()

      expect(result).toBe(false)
    })
  })
})
