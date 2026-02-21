import Foundation
import CoreLocation
import GyoBridge

/**
 * Geolocation bridge implementation for iOS
 * Uses CoreLocation framework
 */
public class GeolocationBridge: NSObject, BridgeInterface {
    public var name: String = "gyo-geolocation"
    
    private let locationManager = CLLocationManager()
    private var watchCallbacks: [Int: (CLLocation) -> Void] = [:]
    private var getCurrentPositionCallback: BridgeCallback?
    
    public override init() {
        super.init()
        locationManager.delegate = self
        locationManager.desiredAccuracy = kCLLocationAccuracyBest
    }
    
    public func invoke(method: String, data: [String: Any]?, callback: @escaping BridgeCallback) {
        switch method {
        case "getCurrentPosition":
            getCurrentPosition(callback: callback)
        case "watchPosition":
            watchPosition(data: data, callback: callback)
        case "clearWatch":
            clearWatch(data: data, callback: callback)
        case "isAvailable":
            isAvailable(callback: callback)
        default:
            callback(.failure("Unknown method: \(method)"))
        }
    }
    
    private func getCurrentPosition(callback: @escaping BridgeCallback) {
        // Check authorization
        let status = locationManager.authorizationStatus
        
        if status == .notDetermined {
            locationManager.requestWhenInUseAuthorization()
        }
        
        if status == .denied || status == .restricted {
            callback(.failure("Location permission denied"))
            return
        }
        
        getCurrentPositionCallback = callback
        locationManager.requestLocation()
    }
    
    private func watchPosition(data: [String: Any]?, callback: @escaping BridgeCallback) {
        guard let watchId = data?["watchId"] as? Int else {
            callback(.failure("Watch ID required"))
            return
        }
        
        // Check authorization
        let status = locationManager.authorizationStatus
        
        if status == .notDetermined {
            locationManager.requestWhenInUseAuthorization()
        }
        
        if status == .denied || status == .restricted {
            callback(.failure("Location permission denied"))
            return
        }
        
        watchCallbacks[watchId] = { location in
            // Publish location update
            // Note: Need to implement publish mechanism
            print("Location update for watch \(watchId): \(location)")
        }
        
        if watchCallbacks.count == 1 {
            locationManager.startUpdatingLocation()
        }
        
        callback(.success(true))
    }
    
    private func clearWatch(data: [String: Any]?, callback: @escaping BridgeCallback) {
        guard let watchId = data?["watchId"] as? Int else {
            callback(.failure("Watch ID required"))
            return
        }
        
        watchCallbacks.removeValue(forKey: watchId)
        
        if watchCallbacks.isEmpty {
            locationManager.stopUpdatingLocation()
        }
        
        callback(.success(true))
    }
    
    private func isAvailable(callback: @escaping BridgeCallback) {
        callback(.success(CLLocationManager.locationServicesEnabled()))
    }
    
    private func locationToDict(_ location: CLLocation) -> [String: Any] {
        var dict: [String: Any] = [
            "latitude": location.coordinate.latitude,
            "longitude": location.coordinate.longitude,
            "accuracy": location.horizontalAccuracy,
            "timestamp": location.timestamp.timeIntervalSince1970 * 1000
        ]
        
        if location.verticalAccuracy >= 0 {
            dict["altitude"] = location.altitude
            dict["altitudeAccuracy"] = location.verticalAccuracy
        }
        
        if location.course >= 0 {
            dict["heading"] = location.course
        }
        
        if location.speed >= 0 {
            dict["speed"] = location.speed
        }
        
        return dict
    }
}

extension GeolocationBridge: CLLocationManagerDelegate {
    public func locationManager(_ manager: CLLocationManager, didUpdateLocations locations: [CLLocation]) {
        guard let location = locations.last else { return }
        
        // Handle getCurrentPosition callback
        if let callback = getCurrentPositionCallback {
            callback(.success(locationToDict(location)))
            getCurrentPositionCallback = nil
        }
        
        // Handle watch callbacks
        for (watchId, watchCallback) in watchCallbacks {
            watchCallback(location)
        }
    }
    
    public func locationManager(_ manager: CLLocationManager, didFailWithError error: Error) {
        print("Location error: \(error.localizedDescription)")
        
        if let callback = getCurrentPositionCallback {
            callback(.failure(error.localizedDescription))
            getCurrentPositionCallback = nil
        }
    }
    
    public func locationManagerDidChangeAuthorization(_ manager: CLLocationManager) {
        let status = manager.authorizationStatus
        print("Location authorization changed: \(status.rawValue)")
    }
}
