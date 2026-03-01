# Plugin API Reference

## @gyo-framework/bridge

웹-네이티브 통신 코어 라이브러리.

### TypeScript API

```typescript
import { Bridge } from '@gyo-framework/bridge'

const bridge = new Bridge('@gyo-framework/plugin-name')

// 동기 호출
const result = await bridge.call('methodName', { param: 'value' })

// 이벤트 리스닝
bridge.onEvent('eventName', (data) => {
  console.log('Event:', data)
})
```

### BridgeResponse 타입

```typescript
type BridgeResponse = 
  | { success: true; data: any }
  | { success: false; error: string }
```

---

## @gyo-framework/camera

카메라 및 갤러리 접근.

### API

```typescript
import Camera from '@gyo-framework/camera'

interface CameraResult {
  base64: string      // Base64 인코딩 이미지
  format: string      // 'jpeg' | 'png'
  width: number
  height: number
}

interface CameraOptions {
  quality?: number    // 0-1, default 0.8
  maxWidth?: number   // default 1920
  maxHeight?: number  // default 1080
}

// 사진 촬영
const result: CameraResult = await Camera.takePicture(options?)

// 갤러리에서 선택
const result: CameraResult = await Camera.pickFromGallery(options?)

// 카메라 사용 가능 여부
const available: boolean = await Camera.isAvailable()
```

### 권한

**Android**: `CAMERA`, `READ_EXTERNAL_STORAGE`
**iOS**: `NSCameraUsageDescription`, `NSPhotoLibraryUsageDescription`

---

## @gyo-framework/geolocation

GPS 위치 추적.

### API

```typescript
import Geolocation from '@gyo-framework/geolocation'

interface Position {
  coords: {
    latitude: number
    longitude: number
    accuracy: number       // meters
    altitude: number | null
    altitudeAccuracy: number | null
    heading: number | null   // 0-359 degrees
    speed: number | null     // m/s
  }
  timestamp: number
}

interface PositionError {
  code: 1 | 2 | 3  // PERMISSION_DENIED | POSITION_UNAVAILABLE | TIMEOUT
  message: string
}

// 현재 위치 (1회)
const position: Position = await Geolocation.getCurrentPosition()

// 위치 감시 (실시간)
const watchId: number = await Geolocation.watchPosition(
  (position: Position) => { /* update */ },
  (error: PositionError) => { /* handle error */ }
)

// 감시 중지
await Geolocation.clearWatch(watchId)

// 사용 가능 여부
const available: boolean = await Geolocation.isAvailable()
```

### 권한

**Android**: `ACCESS_FINE_LOCATION`, `ACCESS_COARSE_LOCATION`
**iOS**: `NSLocationWhenInUseUsageDescription`

### 의존성

**Android**: Google Play Services Location 21.0.1
**iOS**: CoreLocation (내장)
