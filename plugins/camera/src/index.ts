import { Bridge } from 'gyo-bridge';

export interface CameraOptions {
  /**
   * Image quality (0.0 - 1.0)
   * @default 0.8
   */
  quality?: number;
  
  /**
   * Allow image editing before returning
   * @default false
   */
  allowsEditing?: boolean;
}

export interface CameraResult {
  /**
   * Base64 encoded image data
   */
  base64: string;
  
  /**
   * Image width in pixels
   */
  width?: number;
  
  /**
   * Image height in pixels
   */
  height?: number;
}

/**
 * Camera plugin for taking photos and accessing gallery
 */
export class Camera {
  private static bridge = new Bridge('gyo-camera');

  /**
   * Take a photo using the device camera
   * @param options Camera options
   * @returns Promise with base64 encoded image
   */
  static async takePicture(options: CameraOptions = {}): Promise<CameraResult> {
    return this.bridge.invoke<CameraResult>('takePicture', options);
  }

  /**
   * Pick an image from the device gallery
   * @param options Camera options
   * @returns Promise with base64 encoded image
   */
  static async pickFromGallery(options: CameraOptions = {}): Promise<CameraResult> {
    return this.bridge.invoke<CameraResult>('pickFromGallery', options);
  }

  /**
   * Check if camera is available on this device
   * @returns Promise with availability status
   */
  static async isAvailable(): Promise<boolean> {
    return this.bridge.invoke<boolean>('isAvailable');
  }
}
