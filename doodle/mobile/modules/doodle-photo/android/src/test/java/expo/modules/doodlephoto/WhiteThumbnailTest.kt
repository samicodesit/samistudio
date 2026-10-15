package expo.modules.doodlephoto

import android.graphics.Bitmap
import android.graphics.Color
import org.junit.Assert.assertEquals
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config
import org.robolectric.annotation.GraphicsMode

@RunWith(RobolectricTestRunner::class)
@Config(sdk = [35], manifest = Config.NONE)
@GraphicsMode(GraphicsMode.Mode.NATIVE)
class WhiteThumbnailTest {
  @Test fun transparencyBecomesWhiteAndSmallImagesStaySmall() {
    val source = Bitmap.createBitmap(30, 20, Bitmap.Config.ARGB_8888)
    source.setPixel(15, 10, Color.RED)
    val output = whiteThumbnail(source, 600)
    assertEquals(30, output.width)
    assertEquals(20, output.height)
    assertEquals(Color.WHITE, output.getPixel(0, 0))
    assertEquals(Color.RED, output.getPixel(15, 10))
    output.recycle(); source.recycle()
  }

  @Test fun tallImagesKeepTheirFullAspectRatio() {
    val source = Bitmap.createBitmap(20, 2400, Bitmap.Config.ARGB_8888)
    val output = whiteThumbnail(source, 600)
    assertEquals(5, output.width)
    assertEquals(600, output.height)
    output.recycle(); source.recycle()
  }
}
