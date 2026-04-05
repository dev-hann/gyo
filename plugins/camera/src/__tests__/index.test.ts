import { Bridge } from 'gyo-bridge'
import { Camera } from '../index'

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

describe('Camera Plugin', () => {
  let mockBridgeInstance: { invoke: jest.Mock }

  beforeEach(() => {
    jest.clearAllMocks()
    mockBridgeInstance = new Bridge('test') as unknown as { invoke: jest.Mock }
  })

  describe('takePicture', () => {
    it('should call bridge invoke with correct method name', async () => {
      const mockResult = {
        base64: 'data:image/jpeg;base64,/9j/4AAQ',
        width: 1920,
        height: 1080
      }
      mockBridgeInstance.invoke.mockResolvedValue(mockResult)

      const result = await Camera.takePicture()

      expect(mockBridgeInstance.invoke).toHaveBeenCalledWith('takePicture', {})
      expect(result).toEqual(mockResult)
    })

    it('should pass options to bridge', async () => {
      const options = { quality: 0.5 }
      mockBridgeInstance.invoke.mockResolvedValue({})

      await Camera.takePicture(options)

      expect(mockBridgeInstance.invoke).toHaveBeenCalledWith('takePicture', options)
    })

    it('should handle errors', async () => {
      mockBridgeInstance.invoke.mockRejectedValue(new Error('Camera not available'))

      await expect(Camera.takePicture()).rejects.toThrow('Camera not available')
    })
  })

  describe('pickFromGallery', () => {
    it('should call bridge invoke with correct method name', async () => {
      const mockResult = {
        base64: 'data:image/jpeg;base64,/9j/4AAQ',
        width: 800,
        height: 600
      }
      mockBridgeInstance.invoke.mockResolvedValue(mockResult)

      const result = await Camera.pickFromGallery()

      expect(mockBridgeInstance.invoke).toHaveBeenCalledWith('pickFromGallery', {})
      expect(result).toEqual(mockResult)
    })
  })

  describe('isAvailable', () => {
    it('should return true when available', async () => {
      mockBridgeInstance.invoke.mockResolvedValue(true)

      const result = await Camera.isAvailable()

      expect(result).toBe(true)
    })

    it('should return false when not available', async () => {
      mockBridgeInstance.invoke.mockResolvedValue(false)

      const result = await Camera.isAvailable()

      expect(result).toBe(false)
    })
  })
})
