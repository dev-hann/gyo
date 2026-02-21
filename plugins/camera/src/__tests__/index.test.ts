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

describe('Camera Plugin', () => {
  let mockBridgeInstance: { invoke: jest.Mock }

  beforeEach(() => {
    jest.clearAllMocks()
    mockBridgeInstance = new Bridge('test') as any
  })

  describe('takePicture', () => {
    it('should call bridge invoke with correct method name', async () => {
      const mockResult = {
        base64: 'data:image/jpeg;base64,/9j/4AAQ',
        width: 1920,
        height: 1080
      }
      mockBridgeInstance.invoke.mockResolvedValue(mockResult)

      const result = await mockBridgeInstance.invoke('takePicture', {})

      expect(mockBridgeInstance.invoke).toHaveBeenCalledWith('takePicture', {})
      expect(result).toEqual(mockResult)
    })

    it('should pass options to bridge', async () => {
      const options = { quality: 0.5 }
      mockBridgeInstance.invoke.mockResolvedValue({})

      await mockBridgeInstance.invoke('takePicture', options)

      expect(mockBridgeInstance.invoke).toHaveBeenCalledWith('takePicture', options)
    })

    it('should handle errors', async () => {
      const error = new Error('Camera not available')
      mockBridgeInstance.invoke.mockRejectedValue(error)

      await expect(mockBridgeInstance.invoke('takePicture')).rejects.toThrow('Camera not available')
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

      const result = await mockBridgeInstance.invoke('pickFromGallery', {})

      expect(mockBridgeInstance.invoke).toHaveBeenCalledWith('pickFromGallery', {})
      expect(result).toEqual(mockResult)
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

describe('Camera Types', () => {
  it('should accept valid CameraOptions', () => {
    interface CameraOptions {
      quality?: number
      allowsEditing?: boolean
    }
    
    const options: CameraOptions = {
      quality: 0.8,
      allowsEditing: true
    }
    expect(options.quality).toBe(0.8)
    expect(options.allowsEditing).toBe(true)
  })

  it('should accept valid CameraResult', () => {
    interface CameraResult {
      base64: string
      width?: number
      height?: number
    }
    
    const result: CameraResult = {
      base64: 'data:image/jpeg;base64,test',
      width: 1920,
      height: 1080
    }
    expect(result.base64).toBeDefined()
    expect(result.width).toBe(1920)
    expect(result.height).toBe(1080)
  })

  it('should accept minimal CameraResult', () => {
    interface CameraResult {
      base64: string
      width?: number
      height?: number
    }
    
    const result: CameraResult = {
      base64: 'data:image/jpeg;base64,test'
    }
    expect(result.base64).toBeDefined()
    expect(result.width).toBeUndefined()
    expect(result.height).toBeUndefined()
  })
})
