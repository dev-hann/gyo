import { Bridge } from 'gyo-bridge';

/**
 * Geographic coordinates
 */
export interface Position {
  /**
   * Latitude in degrees
   */
  latitude: number;
  
  /**
   * Longitude in degrees
   */
  longitude: number;
  
  /**
   * Accuracy of position in meters
   */
  accuracy: number;
  
  /**
   * Altitude in meters (optional)
   */
  altitude?: number;
  
  /**
   * Accuracy of altitude in meters (optional)
   */
  altitudeAccuracy?: number;
  
  /**
   * Heading/direction in degrees (0-360, optional)
   */
  heading?: number;
  
  /**
   * Speed in meters per second (optional)
   */
  speed?: number;
  
  /**
   * Timestamp when position was acquired
   */
  timestamp: number;
}

/**
 * Position error codes
 */
export enum PositionErrorCode {
  PERMISSION_DENIED = 1,
  POSITION_UNAVAILABLE = 2,
  TIMEOUT = 3,
}

/**
 * Position error
 */
export interface PositionError {
  code: PositionErrorCode;
  message: string;
}

/**
 * Geolocation plugin for GPS location tracking
 * 
 * @example
 * ```typescript
 * import { Geolocation } from 'gyo-geolocation';
 * 
 * // Get current position
 * const position = await Geolocation.getCurrentPosition();
 * console.log(`Lat: ${position.latitude}, Lon: ${position.longitude}`);
 * 
 * // Watch position (real-time tracking)
 * const watchId = Geolocation.watchPosition(
 *   (position) => {
 *     console.log('New position:', position);
 *   },
 *   (error) => {
 *     console.error('Position error:', error);
 *   }
 * );
 * 
 * // Stop watching
 * Geolocation.clearWatch(watchId);
 * ```
 */
export class Geolocation {
  private static bridge = new Bridge('gyo-geolocation');
  private static watchCallbacks: Map<number, (pos: Position) => void> = new Map();
  private static errorCallbacks: Map<number, (error: PositionError) => void> = new Map();
  private static unsubscribe: (() => void) | null = null;

  /**
   * Get current device position (one-time)
   * 
   * @returns Promise resolving to current position
   * @throws {PositionError} If position cannot be determined
   */
  static async getCurrentPosition(): Promise<Position> {
    return this.bridge.invoke<Position>('getCurrentPosition');
  }

  /**
   * Watch position for real-time tracking
   * 
   * @param successCallback Called when position updates
   * @param errorCallback Called when error occurs (optional)
   * @returns Watch ID (use with clearWatch to stop)
   * 
   * @example
   * ```typescript
   * const watchId = Geolocation.watchPosition(
   *   (pos) => console.log('Position:', pos),
   *   (err) => console.error('Error:', err)
   * );
   * ```
   */
  static watchPosition(
    successCallback: (position: Position) => void,
    errorCallback?: (error: PositionError) => void
  ): number {
    const watchId = Math.floor(Math.random() * 1000000);
    
    this.watchCallbacks.set(watchId, successCallback);
    if (errorCallback) {
      this.errorCallbacks.set(watchId, errorCallback);
    }

    // Set up listener if not already done
    if (!this.unsubscribe) {
      this.unsubscribe = this.bridge.listen((data) => {
        if (typeof data.watchId === 'number') {
          const callback = this.watchCallbacks.get(data.watchId);
          const errCallback = this.errorCallbacks.get(data.watchId);
          
          if (data.error) {
            errCallback?.(data.error);
          } else if (data.position && callback) {
            callback(data.position);
          }
        }
      });
    }

    // Start watching on native side
    this.bridge.invoke('watchPosition', { watchId });

    return watchId;
  }

  /**
   * Stop watching position
   * 
   * @param watchId Watch ID returned from watchPosition
   * 
   * @example
   * ```typescript
   * Geolocation.clearWatch(watchId);
   * ```
   */
  static clearWatch(watchId: number): void {
    this.watchCallbacks.delete(watchId);
    this.errorCallbacks.delete(watchId);

    // If no more watchers, unsubscribe from bridge
    if (this.watchCallbacks.size === 0 && this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }

    // Notify native side
    this.bridge.invoke('clearWatch', { watchId });
  }

  /**
   * Check if geolocation is available on this device
   * 
   * @returns Promise resolving to availability status
   */
  static async isAvailable(): Promise<boolean> {
    try {
      return await this.bridge.invoke<boolean>('isAvailable');
    } catch {
      return false;
    }
  }
}
