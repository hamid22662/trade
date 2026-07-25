import * as ImagePicker from 'expo-image-picker';

export const MAX_TRADE_IMAGES = 4;
export const MAX_COMPRESSED_IMAGE_BYTES = 600 * 1024;

function canvasBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => canvas.toBlob(
    (blob) => blob ? resolve(blob) : reject(new Error('IMAGE_COMPRESSION_FAILED')),
    'image/jpeg',
    quality,
  ));
}

function blobDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('IMAGE_READ_FAILED'));
    reader.readAsDataURL(blob);
  });
}

async function compressForUpload(uri: string) {
  const response = await fetch(uri);
  if (!response.ok) throw new Error('IMAGE_READ_FAILED');
  const sourceBlob = await response.blob();
  const objectUrl = URL.createObjectURL(sourceBlob);
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new window.Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error('IMAGE_DECODE_FAILED'));
      element.src = objectUrl;
    });
    const scale = Math.min(1, 1600 / Math.max(image.naturalWidth, image.naturalHeight));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('IMAGE_COMPRESSION_UNAVAILABLE');
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    let quality = 0.82;
    let output = await canvasBlob(canvas, quality);
    while (output.size > MAX_COMPRESSED_IMAGE_BYTES && quality > 0.42) {
      quality -= 0.1;
      output = await canvasBlob(canvas, quality);
    }
    if (output.size > 1024 * 1024) throw new Error('IMAGE_TOO_LARGE');
    return blobDataUrl(output);
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

export async function pickAndPersistChartImage() {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.85,
    allowsMultipleSelection: false,
  });
  if (result.canceled || !result.assets?.[0]) return null;
  return compressForUpload(result.assets[0].uri);
}
