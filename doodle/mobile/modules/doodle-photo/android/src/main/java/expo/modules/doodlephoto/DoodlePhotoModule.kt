package expo.modules.doodlephoto

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Rect
import android.net.Uri
import android.util.Base64
import com.bumptech.glide.Glide
import com.bumptech.glide.load.engine.DiskCacheStrategy
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Coroutine
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.util.UUID
import kotlin.math.max
import kotlin.math.roundToInt

class PhotoTooLargeException : CodedException("tooLarge")

// Deliberately separate from Glide's pooled bitmap. Only recycle what we own.
internal fun whiteThumbnail(source: Bitmap, edge: Int): Bitmap {
  val scale = minOf(1.0, edge.toDouble() / max(source.width, source.height))
  val width = max(1, (source.width * scale).roundToInt())
  val height = max(1, (source.height * scale).roundToInt())
  val output = Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
  Canvas(output).apply {
    drawColor(Color.WHITE)
    drawBitmap(source, null, Rect(0, 0, width, height), Paint(Paint.ANTI_ALIAS_FLAG or Paint.FILTER_BITMAP_FLAG))
  }
  return output
}

class DoodlePhotoModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("DoodlePhoto")
    AsyncFunction("prepare") Coroutine { uri: String, sourceBytes: Int, sourcePixels: Int, edge: Int, outputBytes: Int ->
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      withContext(Dispatchers.IO) { prepare(context, uri, sourceBytes, sourcePixels, edge, outputBytes) }
    }
  }

  private fun prepare(context: Context, uri: String, sourceBytes: Int, sourcePixels: Int, edge: Int, outputBytes: Int): Map<String, String> {
    val parsed = Uri.parse(uri)
    require(parsed.scheme == "file") { "invalid" }
    val input = File(parsed.path ?: throw IllegalArgumentException("invalid")).canonicalFile
    // Only the system picker's private copy is accepted, never arbitrary paths.
    require(input.path.startsWith(context.cacheDir.canonicalPath + File.separator) && input.isFile) { "invalid" }
    if (input.length() > sourceBytes) throw PhotoTooLargeException()
    val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
    BitmapFactory.decodeFile(input.path, bounds)
    require(bounds.outWidth > 0 && bounds.outHeight > 0 && bounds.outMimeType in setOf("image/jpeg", "image/png", "image/webp", "image/heic", "image/heif", "image/avif")) { "invalid" }
    if (bounds.outWidth.toLong() * bounds.outHeight > sourcePixels) throw PhotoTooLargeException()
    val manager = Glide.with(context.applicationContext)
    // Decode to the requested size and apply EXIF (including mirror variants).
    // Neither the original nor this decoded image enters Glide's disk cache.
    val target = manager.asBitmap().load(input).centerInside().disallowHardwareConfig()
      .diskCacheStrategy(DiskCacheStrategy.NONE).skipMemoryCache(true).submit(edge, edge)
    var output: File? = null
    try {
      val thumbnail = whiteThumbnail(target.get(), edge)
      try {
        output = File(context.cacheDir, "doodle-photo-${UUID.randomUUID()}.jpg")
        output.outputStream().use { require(thumbnail.compress(Bitmap.CompressFormat.JPEG, 90, it)) { "invalid" } }
        if (output.length() > outputBytes) throw PhotoTooLargeException()
        // Encode JPEG once. Base64 is read from the same file shown in preview.
        return mapOf("uri" to Uri.fromFile(output).toString(), "base64" to Base64.encodeToString(output.readBytes(), Base64.NO_WRAP))
      } finally { thumbnail.recycle() }
    } catch (error: Throwable) {
      output?.delete()
      throw error
    } finally { manager.clear(target) }
  }
}
