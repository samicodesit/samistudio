import ExpoModulesCore

public class DoodlePhotoModule: Module {
  public func definition() -> ModuleDefinition {
    Name("DoodlePhoto")
    AsyncFunction("prepare") { (uri: String, sourceBytes: Int, sourcePixels: Int, edge: Int, outputBytes: Int) throws -> [String: String] in
      guard let cache = self.appContext?.config.cacheDirectory else { throw PhotoPreparationError.invalid }
      do {
        return try autoreleasepool {
          try DoodlePhotoProcessor.prepare(uri: uri, cacheDirectory: cache, sourceBytes: sourceBytes, sourcePixels: sourcePixels, edge: edge, outputBytes: outputBytes)
        }
      } catch PhotoPreparationError.tooLarge {
        throw Exception(name: "PhotoTooLarge", description: "Photo limit exceeded", code: "ERR_PHOTO_TOO_LARGE")
      } catch {
        throw Exception(name: "PhotoInvalid", description: "Photo could not be prepared", code: "ERR_PHOTO_INVALID")
      }
    }
  }
}
