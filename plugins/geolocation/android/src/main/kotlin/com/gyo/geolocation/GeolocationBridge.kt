package com.gyo.geolocation

import android.Manifest
import android.app.Activity
import android.content.pm.PackageManager
import android.location.Location
import android.os.Looper
import android.util.Log
import androidx.core.app.ActivityCompat
import androidx.core.content.ContextCompat
import com.google.android.gms.location.*
import com.gyo.bridge.BridgeCallback
import com.gyo.bridge.BridgeInterface
import org.json.JSONObject

/**
 * Geolocation bridge implementation for Android
 * Uses Google Play Services Fused Location Provider
 */
class GeolocationBridge(private val activity: Activity) : BridgeInterface {
    override val name = "gyo-geolocation"
    
    private companion object {
        const val TAG = "GeolocationBridge"
        const val PERMISSION_REQUEST_CODE = 2001
    }
    
    private val fusedLocationClient: FusedLocationProviderClient =
        LocationServices.getFusedLocationProviderClient(activity)
    
    private val locationCallbacks = mutableMapOf<Int, LocationCallback>()
    
    override fun invoke(method: String, data: JSONObject?, callback: BridgeCallback) {
        when (method) {
            "getCurrentPosition" -> getCurrentPosition(callback)
            "watchPosition" -> watchPosition(data, callback)
            "clearWatch" -> clearWatch(data, callback)
            "isAvailable" -> isAvailable(callback)
            else -> callback.reject("Unknown method: $method")
        }
    }
    
    private fun getCurrentPosition(callback: BridgeCallback) {
        // Check permissions
        if (!hasLocationPermission()) {
            callback.reject("Location permission not granted")
            return
        }
        
        try {
            fusedLocationClient.lastLocation.addOnSuccessListener { location: Location? ->
                if (location != null) {
                    callback.resolve(locationToJson(location))
                } else {
                    // Request fresh location
                    requestSingleUpdate(callback)
                }
            }.addOnFailureListener { e ->
                Log.e(TAG, "Failed to get location", e)
                callback.reject("Failed to get location: ${e.message}")
            }
        } catch (e: SecurityException) {
            callback.reject("Location permission denied")
        }
    }
    
    private fun requestSingleUpdate(callback: BridgeCallback) {
        val locationRequest = LocationRequest.Builder(
            Priority.PRIORITY_HIGH_ACCURACY, 10000
        ).build()
        
        val locationCallback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                result.lastLocation?.let { location ->
                    callback.resolve(locationToJson(location))
                    fusedLocationClient.removeLocationUpdates(this)
                }
            }
        }
        
        try {
            fusedLocationClient.requestLocationUpdates(
                locationRequest,
                locationCallback,
                Looper.getMainLooper()
            )
        } catch (e: SecurityException) {
            callback.reject("Location permission denied")
        }
    }
    
    private fun watchPosition(data: JSONObject?, callback: BridgeCallback) {
        val watchId = data?.optInt("watchId") ?: return
        
        if (!hasLocationPermission()) {
            callback.reject("Location permission not granted")
            return
        }
        
        val locationRequest = LocationRequest.Builder(
            Priority.PRIORITY_HIGH_ACCURACY, 1000
        ).setMinUpdateIntervalMillis(500).build()
        
        val locationCallback = object : LocationCallback() {
            override fun onLocationResult(result: LocationResult) {
                result.lastLocation?.let { location ->
                    val response = JSONObject().apply {
                        put("watchId", watchId)
                        put("position", locationToJson(location))
                    }
                    // Note: This needs to be published via WebView JavaScript
                    // In real implementation, call webView.evaluateJavascript()
                    Log.d(TAG, "Location update: $response")
                }
            }
        }
        
        locationCallbacks[watchId] = locationCallback
        
        try {
            fusedLocationClient.requestLocationUpdates(
                locationRequest,
                locationCallback,
                Looper.getMainLooper()
            )
            callback.resolve(true)
        } catch (e: SecurityException) {
            callback.reject("Location permission denied")
        }
    }
    
    private fun clearWatch(data: JSONObject?, callback: BridgeCallback) {
        val watchId = data?.optInt("watchId") ?: return
        
        locationCallbacks[watchId]?.let { locationCallback ->
            fusedLocationClient.removeLocationUpdates(locationCallback)
            locationCallbacks.remove(watchId)
            callback.resolve(true)
        } ?: callback.reject("Watch ID not found")
    }
    
    private fun isAvailable(callback: BridgeCallback) {
        callback.resolve(true) // Always available on Android
    }
    
    private fun hasLocationPermission(): Boolean {
        return ContextCompat.checkSelfPermission(
            activity,
            Manifest.permission.ACCESS_FINE_LOCATION
        ) == PackageManager.PERMISSION_GRANTED
    }
    
    private fun locationToJson(location: Location): JSONObject {
        return JSONObject().apply {
            put("latitude", location.latitude)
            put("longitude", location.longitude)
            put("accuracy", location.accuracy.toDouble())
            put("altitude", location.altitude)
            put("altitudeAccuracy", if (location.hasVerticalAccuracy()) location.verticalAccuracyMeters.toDouble() else null)
            put("speed", if (location.hasSpeed()) location.speed.toDouble() else null)
            put("heading", if (location.hasBearing()) location.bearing.toDouble() else null)
            put("timestamp", location.time)
        }
    }
}
