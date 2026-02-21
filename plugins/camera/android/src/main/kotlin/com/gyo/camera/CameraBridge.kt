package com.gyo.camera

import android.app.Activity
import android.content.Intent
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.provider.MediaStore
import android.util.Base64
import android.util.Log
import com.gyo.bridge.BridgeCallback
import com.gyo.bridge.BridgeInterface
import org.json.JSONObject
import java.io.ByteArrayOutputStream
import java.io.InputStream

/**
 * Camera bridge implementation for Android
 */
class CameraBridge(private val activity: Activity) : BridgeInterface {
    override val name = "gyo-camera"
    
    private companion object {
        const val TAG = "CameraBridge"
        const val REQUEST_CAMERA = 1001
        const val REQUEST_GALLERY = 1002
        const val DEFAULT_QUALITY = 0.8
    }
    
    private var pendingCallback: BridgeCallback? = null
    private var requestQuality: Double = DEFAULT_QUALITY
    
    override fun invoke(method: String, data: JSONObject?, callback: BridgeCallback) {
        when (method) {
            "takePicture" -> takePicture(data, callback)
            "pickFromGallery" -> pickFromGallery(data, callback)
            "isAvailable" -> isAvailable(callback)
            else -> callback.reject("Unknown method: $method")
        }
    }
    
    private fun takePicture(data: JSONObject?, callback: BridgeCallback) {
        requestQuality = data?.optDouble("quality", DEFAULT_QUALITY) ?: DEFAULT_QUALITY
        pendingCallback = callback
        
        val intent = Intent(MediaStore.ACTION_IMAGE_CAPTURE)
        if (intent.resolveActivity(activity.packageManager) != null) {
            activity.startActivityForResult(intent, REQUEST_CAMERA)
        } else {
            callback.reject("Camera not available")
            pendingCallback = null
        }
    }
    
    private fun pickFromGallery(data: JSONObject?, callback: BridgeCallback) {
        requestQuality = data?.optDouble("quality", DEFAULT_QUALITY) ?: DEFAULT_QUALITY
        pendingCallback = callback
        
        val intent = Intent(Intent.ACTION_PICK, MediaStore.Images.Media.EXTERNAL_CONTENT_URI)
        if (intent.resolveActivity(activity.packageManager) != null) {
            activity.startActivityForResult(intent, REQUEST_GALLERY)
        } else {
            callback.reject("Gallery not available")
            pendingCallback = null
        }
    }
    
    private fun isAvailable(callback: BridgeCallback) {
        val intent = Intent(MediaStore.ACTION_IMAGE_CAPTURE)
        val available = intent.resolveActivity(activity.packageManager) != null
        callback.resolve(available)
    }
    
    /**
     * Handle activity result from camera or gallery
     * Call this from your Activity's onActivityResult
     */
    fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        if (resultCode != Activity.RESULT_OK || pendingCallback == null) {
            pendingCallback?.reject("Operation cancelled")
            pendingCallback = null
            return
        }
        
        try {
            when (requestCode) {
                REQUEST_CAMERA -> {
                    val bitmap = data?.extras?.get("data") as? Bitmap
                    if (bitmap != null) {
                        handleBitmap(bitmap)
                    } else {
                        pendingCallback?.reject("Failed to capture image")
                        pendingCallback = null
                    }
                }
                REQUEST_GALLERY -> {
                    val uri = data?.data
                    if (uri != null) {
                        val inputStream: InputStream? = activity.contentResolver.openInputStream(uri)
                        val bitmap = BitmapFactory.decodeStream(inputStream)
                        inputStream?.close()
                        
                        if (bitmap != null) {
                            handleBitmap(bitmap)
                        } else {
                            pendingCallback?.reject("Failed to load image")
                            pendingCallback = null
                        }
                    } else {
                        pendingCallback?.reject("No image selected")
                        pendingCallback = null
                    }
                }
            }
        } catch (e: Exception) {
            Log.e(TAG, "Error processing image", e)
            pendingCallback?.reject("Error processing image: ${e.message}")
            pendingCallback = null
        }
    }
    
    private fun handleBitmap(bitmap: Bitmap) {
        try {
            val outputStream = ByteArrayOutputStream()
            val quality = (requestQuality * 100).toInt()
            bitmap.compress(Bitmap.CompressFormat.JPEG, quality, outputStream)
            val base64 = Base64.encodeToString(outputStream.toByteArray(), Base64.NO_WRAP)
            
            val result = JSONObject().apply {
                put("base64", "data:image/jpeg;base64,$base64")
                put("width", bitmap.width)
                put("height", bitmap.height)
            }
            
            pendingCallback?.resolve(result)
            pendingCallback = null
            
            bitmap.recycle()
        } catch (e: Exception) {
            Log.e(TAG, "Error encoding image", e)
            pendingCallback?.reject("Error encoding image: ${e.message}")
            pendingCallback = null
        }
    }
}
