import { useState, useEffect } from 'react'
import Camera from 'gyo-camera'

interface Photo {
  base64: string
  width: number
  height: number
  timestamp: number
}

function App() {
  const [photos, setPhotos] = useState<Photo[]>([])
  const [selectedPhoto, setSelectedPhoto] = useState<Photo | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [quality, setQuality] = useState(0.8)
  const [cameraAvailable, setCameraAvailable] = useState(false)

  useEffect(() => {
    checkCamera()
  }, [])

  const checkCamera = async () => {
    const available = await Camera.isAvailable()
    setCameraAvailable(available)
  }

  const takePhoto = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const result = await Camera.takePicture({ quality })
      
      if (result.base64) {
        const photo: Photo = {
          base64: result.base64,
          width: result.width || 0,
          height: result.height || 0,
          timestamp: Date.now()
        }
        setPhotos(prev => [photo, ...prev])
        setSelectedPhoto(photo)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to take photo')
    } finally {
      setLoading(false)
    }
  }

  const pickFromGallery = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const result = await Camera.pickFromGallery({ quality })
      
      if (result.base64) {
        const photo: Photo = {
          base64: result.base64,
          width: result.width || 0,
          height: result.height || 0,
          timestamp: Date.now()
        }
        setPhotos(prev => [photo, ...prev])
        setSelectedPhoto(photo)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to pick image')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app">
      <header className="header">
        <h1>📷 Camera Demo</h1>
        <p className="subtitle">Gyo Camera Plugin Example</p>
      </header>

      <main className="content">
        {!cameraAvailable && (
          <div className="card error">
            <p>Camera is not available on this device</p>
          </div>
        )}

        {error && (
          <div className="card error" onClick={() => setError(null)}>
            <p>❌ {error}</p>
            <small>Tap to dismiss</small>
          </div>
        )}

        <div className="card">
          <h2>Camera Actions</h2>
          
          <div className="quality-control">
            <label>Quality: {Math.round(quality * 100)}%</label>
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.1"
              value={quality}
              onChange={(e) => setQuality(parseFloat(e.target.value))}
            />
          </div>

          <div className="buttons">
            <button onClick={takePhoto} disabled={loading || !cameraAvailable}>
              {loading ? '⏳' : '📸'} Take Photo
            </button>
            <button onClick={pickFromGallery} disabled={loading || !cameraAvailable}>
              {loading ? '⏳' : '🖼️'} Gallery
            </button>
          </div>
        </div>

        {selectedPhoto && (
          <div className="card preview">
            <h2>Selected Photo</h2>
            <img 
              src={selectedPhoto.base64} 
              alt="Selected" 
              className="preview-image"
            />
            <p className="dimensions">
              {selectedPhoto.width} × {selectedPhoto.height}px
            </p>
            <button className="close-btn" onClick={() => setSelectedPhoto(null)}>
              Close Preview
            </button>
          </div>
        )}

        {photos.length > 0 && (
          <div className="card">
            <h2>Photo Gallery ({photos.length})</h2>
            <div className="gallery">
              {photos.map((photo, index) => (
                <div 
                  key={photo.timestamp} 
                  className="gallery-item"
                  onClick={() => setSelectedPhoto(photo)}
                >
                  <img src={photo.base64} alt={`Photo ${index + 1}`} />
                </div>
              ))}
            </div>
            <button 
              className="clear-btn" 
              onClick={() => {
                setPhotos([])
                setSelectedPhoto(null)
              }}
            >
              Clear All Photos
            </button>
          </div>
        )}
      </main>

      <footer className="footer">
        <p>Built with Gyo Framework</p>
      </footer>
    </div>
  )
}

export default App
