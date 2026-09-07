const MAX_REPORT_IMAGE_BYTES = 60_000;

async function canvasBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("Could not prepare report image")), "image/jpeg", quality);
  });
}

async function blobBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 16_384) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 16_384));
  }
  return btoa(binary);
}

export async function prepareReportImage(file: File): Promise<{ base64: string; width: number; height: number }> {
  const bitmap = await createImageBitmap(file);
  try {
    const attempts = [
      { dimension: 640, quality: 0.72 },
      { dimension: 512, quality: 0.6 },
      { dimension: 384, quality: 0.5 },
    ];
    for (const attempt of attempts) {
      const scale = Math.min(1, attempt.dimension / Math.max(bitmap.width, bitmap.height));
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Could not prepare report image");
      context.fillStyle = "#fcfcf8";
      context.fillRect(0, 0, width, height);
      context.drawImage(bitmap, 0, 0, width, height);
      const blob = await canvasBlob(canvas, attempt.quality);
      if (blob.size <= MAX_REPORT_IMAGE_BYTES) {
        return { base64: await blobBase64(blob), width, height };
      }
    }
    throw new Error("Report image is too large");
  } finally {
    bitmap.close();
  }
}
