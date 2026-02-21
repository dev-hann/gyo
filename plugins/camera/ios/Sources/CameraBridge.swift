import Foundation
import UIKit
import GyoBridge

/**
 * Camera bridge implementation for iOS
 */
public class CameraBridge: NSObject, BridgeInterface {
    public var name: String = "gyo-camera"
    
    private weak var viewController: UIViewController?
    private var pendingCallback: BridgeCallback?
    private var requestQuality: Double = 0.8
    
    public init(viewController: UIViewController) {
        self.viewController = viewController
        super.init()
    }
    
    public func invoke(method: String, data: [String: Any]?, callback: @escaping BridgeCallback) {
        switch method {
        case "takePicture":
            takePicture(data: data, callback: callback)
        case "pickFromGallery":
            pickFromGallery(data: data, callback: callback)
        case "isAvailable":
            isAvailable(callback: callback)
        default:
            callback(.failure("Unknown method: \(method)"))
        }
    }
    
    private func takePicture(data: [String: Any]?, callback: @escaping BridgeCallback) {
        guard UIImagePickerController.isSourceTypeAvailable(.camera) else {
            callback(.failure("Camera not available"))
            return
        }
        
        requestQuality = data?["quality"] as? Double ?? 0.8
        pendingCallback = callback
        
        DispatchQueue.main.async {
            let picker = UIImagePickerController()
            picker.delegate = self
            picker.sourceType = .camera
            picker.allowsEditing = data?["allowsEditing"] as? Bool ?? false
            
            self.viewController?.present(picker, animated: true)
        }
    }
    
    private func pickFromGallery(data: [String: Any]?, callback: @escaping BridgeCallback) {
        guard UIImagePickerController.isSourceTypeAvailable(.photoLibrary) else {
            callback(.failure("Gallery not available"))
            return
        }
        
        requestQuality = data?["quality"] as? Double ?? 0.8
        pendingCallback = callback
        
        DispatchQueue.main.async {
            let picker = UIImagePickerController()
            picker.delegate = self
            picker.sourceType = .photoLibrary
            picker.allowsEditing = data?["allowsEditing"] as? Bool ?? false
            
            self.viewController?.present(picker, animated: true)
        }
    }
    
    private func isAvailable(callback: @escaping BridgeCallback) {
        let available = UIImagePickerController.isSourceTypeAvailable(.camera)
        callback(.success(available))
    }
    
    private func handleImage(_ image: UIImage) {
        guard let imageData = image.jpegData(compressionQuality: requestQuality) else {
            pendingCallback?(.failure("Failed to encode image"))
            pendingCallback = nil
            return
        }
        
        let base64 = imageData.base64EncodedString()
        let result: [String: Any] = [
            "base64": "data:image/jpeg;base64,\(base64)",
            "width": Int(image.size.width),
            "height": Int(image.size.height)
        ]
        
        pendingCallback?(.success(result))
        pendingCallback = nil
    }
}

extension CameraBridge: UIImagePickerControllerDelegate, UINavigationControllerDelegate {
    public func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
        picker.dismiss(animated: true)
        
        let image: UIImage?
        if let editedImage = info[.editedImage] as? UIImage {
            image = editedImage
        } else if let originalImage = info[.originalImage] as? UIImage {
            image = originalImage
        } else {
            image = nil
        }
        
        if let image = image {
            handleImage(image)
        } else {
            pendingCallback?(.failure("Failed to get image"))
            pendingCallback = nil
        }
    }
    
    public func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
        picker.dismiss(animated: true)
        pendingCallback?(.failure("Operation cancelled"))
        pendingCallback = nil
    }
}
