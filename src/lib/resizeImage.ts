// Фото с компьютера → уменьшенные копии прямо в браузере: крупная (карточка
// блюда у гостя) и миниатюра (список меню, подсказки). Снимок с телефона
// весит 3–10 МБ — гостю столько не нужно, а сервер такой и не примет.
// WebP, где браузер его умеет, иначе JPEG.

// Оба файла уходят одним запросом, а сервер принимает до 1 МБ (в base64 — на треть больше).
const MAX_BYTES = 450 * 1024

async function decode(file: File): Promise<CanvasImageSource & { width: number; height: number }> {
  try {
    // Учитывает поворот снимка с телефона (EXIF).
    return await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    const url = URL.createObjectURL(file)
    try {
      const img = new Image()
      img.src = url
      await img.decode()
      return img
    } finally {
      URL.revokeObjectURL(url)
    }
  }
}

function encode(src: CanvasImageSource & { width: number; height: number }, maxSide: number): string {
  const k = Math.min(1, maxSide / Math.max(src.width, src.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(src.width * k))
  canvas.height = Math.max(1, Math.round(src.height * k))
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(src, 0, 0, canvas.width, canvas.height)
  const webp = canvas.toDataURL('image/webp', 0.85)
  let type = webp.startsWith('data:image/webp') ? 'image/webp' : 'image/jpeg'
  if (type === 'image/jpeg') {
    // У JPEG нет прозрачности — подкладываем белый фон (бутылки на прозрачном).
    ctx.globalCompositeOperation = 'destination-over'
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }
  for (let q = 0.85; q >= 0.4; q -= 0.1) {
    const data = canvas.toDataURL(type, q)
    if (data.length * 0.75 < MAX_BYTES) return data
  }
  type = 'image/jpeg'
  return canvas.toDataURL(type, 0.4)
}

export async function resizeDishPhoto(file: File): Promise<{ photo: string; thumb: string }> {
  let src
  try {
    src = await decode(file)
  } catch {
    throw new Error('Не удалось открыть файл. Сохраните фото как JPG или PNG и попробуйте ещё раз.')
  }
  return { photo: encode(src, 1200), thumb: encode(src, 400) }
}
