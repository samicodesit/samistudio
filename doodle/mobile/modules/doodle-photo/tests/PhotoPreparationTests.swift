import Foundation
import CoreGraphics
import ImageIO
import UniformTypeIdentifiers

@main
struct PhotoPreparationTests {
  static func main() throws {
    let cache = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
    try FileManager.default.createDirectory(at: cache, withIntermediateDirectories: true)
    defer { try? FileManager.default.removeItem(at: cache) }
    var passed = 0
    func check(_ condition: Bool, _ message: String) throws {
      if !condition { throw NSError(domain: message, code: 1) }
    }
    func image(_ width: Int, _ height: Int, _ type: UTType = .jpeg, orientation: Int = 1, transparent: Bool = false) throws -> URL {
      let context = CGContext(data: nil, width: width, height: height, bitsPerComponent: 8, bytesPerRow: width * 4, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
      if !transparent {
        context.setFillColor(CGColor(red: 1, green: 0, blue: 0, alpha: 1))
        context.fill(CGRect(x: 0, y: 0, width: width, height: height))
      }
      let url = cache.appendingPathComponent(UUID().uuidString).appendingPathExtension(type.preferredFilenameExtension!)
      let destination = CGImageDestinationCreateWithURL(url as CFURL, type.identifier as CFString, 1, nil)!
      CGImageDestinationAddImage(destination, context.makeImage()!, [kCGImagePropertyOrientation: orientation, kCGImagePropertyGPSDictionary: [kCGImagePropertyGPSLatitude: 52.0]] as CFDictionary)
      try check(CGImageDestinationFinalize(destination), "Could not create real test image")
      return url
    }
    func prepare(_ url: URL, bytes: Int = 128_000_000, pixels: Int = 64_000_000, budget: Int = 512_000) throws -> [String: String] {
      try DoodlePhotoProcessor.prepare(uri: url.absoluteString, cacheDirectory: cache, sourceBytes: bytes, sourcePixels: pixels, edge: 600, outputBytes: budget)
    }
    func verifyOutput(_ result: [String: String], width: Int, height: Int) throws {
      let data = try Data(contentsOf: URL(string: result["uri"]!)!)
      try check(data.count <= 512_000, "Upload budget exceeded")
      try check(data.base64EncodedString() == result["base64"], "Preview and upload differ")
      let source = CGImageSourceCreateWithData(data as CFData, nil)!
      try check(CGImageSourceGetType(source) as String? == UTType.jpeg.identifier, "Expected normalized JPEG")
      let metadata = CGImageSourceCopyPropertiesAtIndex(source, 0, nil)! as NSDictionary
      try check(metadata[kCGImagePropertyPixelWidth] as? Int == width, "Wrong output width")
      try check(abs((metadata[kCGImagePropertyPixelHeight] as? Int ?? 0) - height) <= 1, "Wrong output height")
      try check(metadata[kCGImagePropertyGPSDictionary] == nil, "GPS leaked into prepared copy")
    }
    for (width, height, type) in [(5712, 4284, UTType.jpeg), (8064, 6048, .jpeg), (8064, 6048, .heic), (16000, 3900, .jpeg)] {
      try autoreleasepool {
        let original = try image(width, height, type)
        let before = try Data(contentsOf: original)
        let output = try prepare(original)
        try verifyOutput(output, width: 600, height: Int((Double(height) * 600 / Double(width)).rounded()))
        try check(try Data(contentsOf: original) == before, "Original image changed")
      }
      passed += 1
    }
    let larger = try image(100, 80)
    let handle = try FileHandle(forWritingTo: larger)
    try handle.seekToEnd()
    try handle.write(contentsOf: Data(count: 21_000_000))
    try handle.close()
    try verifyOutput(prepare(larger), width: 100, height: 80)
    passed += 1

    let rotated = try image(40, 20, orientation: 6)
    try verifyOutput(prepare(rotated), width: 20, height: 40)
    passed += 1

    let alpha = try image(20, 20, .png, transparent: true)
    let opaque = try prepare(alpha)
    let decoded = CGImageSourceCreateImageAtIndex(CGImageSourceCreateWithURL(URL(string: opaque["uri"]!)! as CFURL, nil)!, 0, nil)!
    let rgba = CGContext(data: nil, width: 20, height: 20, bitsPerComponent: 8, bytesPerRow: 80, space: CGColorSpaceCreateDeviceRGB(), bitmapInfo: CGImageAlphaInfo.premultipliedLast.rawValue)!
    rgba.draw(decoded, in: CGRect(x: 0, y: 0, width: 20, height: 20))
    let channels = rgba.data!.assumingMemoryBound(to: UInt8.self)
    try check(channels[0] > 245 && channels[1] > 245 && channels[2] > 245, "Transparency was not composited onto white")
    passed += 1

    let small = try image(200, 100)
    for (bytes, pixels, budget) in [(1, 64_000_000, 512_000), (128_000_000, 1, 512_000), (128_000_000, 64_000_000, 1)] {
      let before = try FileManager.default.contentsOfDirectory(atPath: cache.path).sorted()
      do {
        _ = try prepare(small, bytes: bytes, pixels: pixels, budget: budget)
        throw NSError(domain: "Size constraint was not enforced", code: 1)
      } catch PhotoPreparationError.tooLarge {}
      try check(try FileManager.default.contentsOfDirectory(atPath: cache.path).sorted() == before, "Rejected preparation left temporary files")
      passed += 1
    }
    let corrupt = cache.appendingPathComponent("corrupt.jpg")
    try Data("not an image".utf8).write(to: corrupt)
    do { _ = try prepare(corrupt); throw NSError(domain: "Accepted corrupt image", code: 1) } catch PhotoPreparationError.invalid {}
    passed += 1
    do { _ = try prepare(cache.appendingPathComponent("../outside.jpg")); throw NSError(domain: "Accepted outside path", code: 1) } catch PhotoPreparationError.invalid {}
    passed += 1
    print("iOS photo processor: \(passed) real-codec checks passed (24MP, 48MP JPEG/HEIC, panorama, large file, orientation, transparency, metadata, limits and cleanup).")
  }
}
