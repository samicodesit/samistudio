import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

enum PhotoPreparationError: Error {
  case invalid
  case tooLarge
}

enum DoodlePhotoProcessor {
  static func prepare(uri: String, cacheDirectory: URL, sourceBytes: Int, sourcePixels: Int, edge: Int, outputBytes: Int) throws -> [String: String] {
    guard let input = URL(string: uri), input.isFileURL,
      sourceBytes > 0, sourcePixels > 0, edge > 0, edge <= 600, outputBytes > 0 else { throw PhotoPreparationError.invalid }
    let cache = cacheDirectory.resolvingSymlinksInPath().standardizedFileURL
    let file = input.resolvingSymlinksInPath().standardizedFileURL
    // Accept only the picker-owned cache copy, never arbitrary local files.
    guard file.path.hasPrefix(cache.path + "/"),
      let attributes = try? FileManager.default.attributesOfItem(atPath: file.path),
      attributes[.type] as? FileAttributeType == .typeRegular,
      let size = attributes[.size] as? NSNumber else { throw PhotoPreparationError.invalid }
    guard size.int64Value <= sourceBytes else { throw PhotoPreparationError.tooLarge }
    guard let source = CGImageSourceCreateWithURL(file as CFURL, [kCGImageSourceShouldCache: false] as CFDictionary),
      let properties = CGImageSourceCopyPropertiesAtIndex(source, 0, nil) as? [CFString: Any],
      let width = (properties[kCGImagePropertyPixelWidth] as? NSNumber)?.doubleValue,
      let height = (properties[kCGImagePropertyPixelHeight] as? NSNumber)?.doubleValue,
      width.isFinite, height.isFinite, width > 0, height > 0 else { throw PhotoPreparationError.invalid }
    guard width * height <= Double(sourcePixels) else { throw PhotoPreparationError.tooLarge }
    // ImageIO downsamples directly from the file. Never materialize the original
    // 24/48MP bitmap just to resize it. Apply all EXIF rotation/mirror variants.
    let options: [CFString: Any] = [
      kCGImageSourceCreateThumbnailFromImageAlways: true,
      kCGImageSourceCreateThumbnailWithTransform: true,
      kCGImageSourceThumbnailMaxPixelSize: min(edge, Int(max(width, height))),
      kCGImageSourceShouldCacheImmediately: true,
    ]
    guard let thumbnail = CGImageSourceCreateThumbnailAtIndex(source, 0, options as CFDictionary),
      let context = CGContext(data: nil, width: thumbnail.width, height: thumbnail.height, bitsPerComponent: 8, bytesPerRow: thumbnail.width * 4,
        space: CGColorSpace(name: CGColorSpace.sRGB)!, bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue) else { throw PhotoPreparationError.invalid }
    let bounds = CGRect(x: 0, y: 0, width: thumbnail.width, height: thumbnail.height)
    context.setFillColor(CGColor(gray: 1, alpha: 1))
    context.fill(bounds)
    context.draw(thumbnail, in: bounds)
    guard let opaque = context.makeImage() else { throw PhotoPreparationError.invalid }
    // Encode a fresh sRGB JPEG, stripping source EXIF/GPS. Preview and payload
    // come from these exact same bytes; the Photos original is never modified.
    for quality in [0.9, 0.8, 0.65] {
      let data = NSMutableData()
      guard let destination = CGImageDestinationCreateWithData(data, UTType.jpeg.identifier as CFString, 1, nil) else { throw PhotoPreparationError.invalid }
      CGImageDestinationAddImage(destination, opaque, [kCGImageDestinationLossyCompressionQuality: quality] as CFDictionary)
      guard CGImageDestinationFinalize(destination) else { throw PhotoPreparationError.invalid }
      if data.length > outputBytes { continue }
      let output = cache.appendingPathComponent("doodle-photo-\(UUID().uuidString).jpg")
      let bytes = data as Data
      do { try bytes.write(to: output, options: .atomic) }
      catch { try? FileManager.default.removeItem(at: output); throw error }
      return ["uri": output.absoluteString, "base64": bytes.base64EncodedString()]
    }
    throw PhotoPreparationError.tooLarge
  }
}
