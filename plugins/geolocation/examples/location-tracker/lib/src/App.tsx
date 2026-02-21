import { useState, useEffect, useRef } from 'react'
import Geolocation from 'gyo-geolocation'

interface LocationData {
  latitude: number
  longitude: number
  accuracy: number
  altitude: number | null
  altitudeAccuracy: number | null
  speed: number | null
  heading: number | null
  timestamp: number
}

function App() {
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null)
  const [watching, setWatching] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [geoAvailable, setGeoAvailable] = useState(false)
  const [locationHistory, setLocationHistory] = useState<LocationData[]>([])
  const watchIdRef = useRef<number | null>(null)

  useEffect(() => {
    checkAvailability()
  }, [])

  const checkAvailability = async () => {
    const available = await Geolocation.isAvailable()
    setGeoAvailable(available)
  }

  const getCurrentPosition = async () => {
    setLoading(true)
    setError(null)
    
    try {
      const position = await Geolocation.getCurrentPosition()
      const location: LocationData = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        altitude: position.coords.altitude,
        altitudeAccuracy: position.coords.altitudeAccuracy,
        speed: position.coords.speed,
        heading: position.coords.heading,
        timestamp: position.timestamp
      }
      setCurrentLocation(location)
      setLocationHistory(prev => [location, ...prev].slice(0, 10))
    } catch (err: any) {
      setError(err.message || 'Failed to get location')
    } finally {
      setLoading(false)
    }
  }

  const startWatching = async () => {
    setLoading(true)
    setError(null)
    
    try {
      watchIdRef.current = await Geolocation.watchPosition(
        (position) => {
          const location: LocationData = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude,
            altitudeAccuracy: position.coords.altitudeAccuracy,
            speed: position.coords.speed,
            heading: position.coords.heading,
            timestamp: position.timestamp
          }
          setCurrentLocation(location)
          setLocationHistory(prev => [location, ...prev].slice(0, 10))
        },
        (err) => {
          setError(err.message)
          stopWatching()
        }
      )
      setWatching(true)
    } catch (err: any) {
      setError(err.message || 'Failed to start watching')
    } finally {
      setLoading(false)
    }
  }

  const stopWatching = async () => {
    if (watchIdRef.current !== null) {
      await Geolocation.clearWatch(watchIdRef.current)
      watchIdRef.current = null
    }
    setWatching(false)
  }

  const formatCoord = (value: number, decimals: number = 6): string => {
    return value.toFixed(decimals)
  }

  const formatSpeed = (speed: number | null): string => {
    if (speed === null) return 'N/A'
    const kmh = speed * 3.6
    return `${kmh.toFixed(1)} km/h`
  }

  const formatHeading = (heading: number | null): string => {
    if (heading === null) return 'N/A'
    const directions = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
    const index = Math.round(heading / 45) % 8
    return `${heading.toFixed(0)}° ${directions[index]}`
  }

  const formatTime = (timestamp: number): string => {
    return new Date(timestamp).toLocaleTimeString()
  }

  return (
    <div className="app">
      <header className="header">
        <h1>📍 Location Tracker</h1>
        <p className="subtitle">Gyo Geolocation Plugin Example</p>
      </header>

      <main className="content">
        {!geoAvailable && (
          <div className="card error">
            <p>Geolocation is not available on this device</p>
          </div>
        )}

        {error && (
          <div className="card error" onClick={() => setError(null)}>
            <p>❌ {error}</p>
            <small>Tap to dismiss</small>
          </div>
        )}

        <div className="card">
          <h2>Controls</h2>
          <div className="buttons">
            <button 
              onClick={getCurrentPosition} 
              disabled={loading || !geoAvailable}
            >
              {loading ? '⏳' : '📍'} Get Location
            </button>
            {!watching ? (
              <button 
                onClick={startWatching} 
                disabled={loading || !geoAvailable}
                className="watch-btn"
              >
                {loading ? '⏳' : '▶️'} Start Tracking
              </button>
            ) : (
              <button 
                onClick={stopWatching} 
                className="stop-btn"
              >
                ⏹️ Stop Tracking
              </button>
            )}
          </div>
        </div>

        {currentLocation && (
          <div className="card location-card">
            <h2>Current Location</h2>
            
            <div className="coords">
              <div className="coord">
                <span className="label">Latitude</span>
                <span className="value">{formatCoord(currentLocation.latitude)}</span>
              </div>
              <div className="coord">
                <span className="label">Longitude</span>
                <span className="value">{formatCoord(currentLocation.longitude)}</span>
              </div>
            </div>

            <div className="details">
              <div className="detail-row">
                <span>Accuracy</span>
                <span>± {currentLocation.accuracy.toFixed(0)} m</span>
              </div>
              <div className="detail-row">
                <span>Altitude</span>
                <span>{currentLocation.altitude?.toFixed(0) ?? 'N/A'} m</span>
              </div>
              <div className="detail-row">
                <span>Speed</span>
                <span>{formatSpeed(currentLocation.speed)}</span>
              </div>
              <div className="detail-row">
                <span>Heading</span>
                <span>{formatHeading(currentLocation.heading)}</span>
              </div>
              <div className="detail-row">
                <span>Updated</span>
                <span>{formatTime(currentLocation.timestamp)}</span>
              </div>
            </div>

            {watching && (
              <div className="watching-indicator">
                <span className="pulse"></span>
                Live Tracking Active
              </div>
            )}
          </div>
        )}

        {locationHistory.length > 1 && (
          <div className="card">
            <h2>Location History ({locationHistory.length})</h2>
            <div className="history">
              {locationHistory.map((loc, index) => (
                <div key={loc.timestamp} className="history-item">
                  <span className="time">{formatTime(loc.timestamp)}</span>
                  <span className="coords-small">
                    {formatCoord(loc.latitude, 4)}, {formatCoord(loc.longitude, 4)}
                  </span>
                  {loc.speed !== null && (
                    <span className="speed-small">{formatSpeed(loc.speed)}</span>
                  )}
                </div>
              ))}
            </div>
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
