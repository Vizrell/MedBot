/**
 * Normaliza el tipo MIME a los 4 tipos soportados por la API de Anthropic / Claude:
 * "image/jpeg" | "image/png" | "image/gif" | "image/webp"
 */
export function normalizeMediaType(mimeType?: string): "image/jpeg" | "image/png" | "image/gif" | "image/webp" {
  if (!mimeType) return "image/jpeg";
  const lower = mimeType.toLowerCase();

  if (lower.includes("png")) return "image/png";
  if (lower.includes("webp")) return "image/webp";
  if (lower.includes("gif")) return "image/gif";
  if (lower.includes("jpeg") || lower.includes("jpg") || lower.includes("pjpeg")) return "image/jpeg";

  return "image/jpeg";
}

export interface ProcessedImageResult {
  dataUrl: string;
  base64Data: string;
  mediaType: "image/jpeg" | "image/png" | "image/gif" | "image/webp";
  width: number;
  height: number;
}

/**
 * Procesa, escala y comprime una imagen o captura de pantalla
 * para enviarla a la IA optimizando tokens, velocidad y evitando límites de tamaño.
 * Máxima dimensión recomendada por Anthropic: 1568px.
 */
export async function processImage(
  fileOrDataUrl: File | string,
  maxDimension = 1568,
  quality = 0.85
): Promise<ProcessedImageResult> {
  return new Promise((resolve, reject) => {
    let sourceDataUrl = "";

    const handleLoadedDataUrl = (dataUrl: string) => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;

        // Calcular escalado proporcional si supera maxDimension
        if (width > maxDimension || height > maxDimension) {
          if (width > height) {
            height = Math.round((height * maxDimension) / width);
            width = maxDimension;
          } else {
            width = Math.round((width * maxDimension) / height);
            height = maxDimension;
          }
        }

        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          // Fallback directo si no hay contexto canvas
          const parts = dataUrl.split(",");
          const mimeMatch = dataUrl.match(/data:([^;]+);/);
          const rawMime = mimeMatch ? mimeMatch[1] : "image/jpeg";
          const mediaType = normalizeMediaType(rawMime);
          return resolve({
            dataUrl,
            base64Data: parts[1] || parts[0],
            mediaType,
            width: img.width,
            height: img.height,
          });
        }

        // Fondo blanco para imágenes transparentes que se convierten a JPEG
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);

        // Usar JPEG comprimido para reducir drásticamente el peso de capturas grandes
        const outputMediaType: "image/jpeg" = "image/jpeg";
        const compressedDataUrl = canvas.toDataURL(outputMediaType, quality);
        const base64Data = compressedDataUrl.split(",")[1];

        resolve({
          dataUrl: compressedDataUrl,
          base64Data,
          mediaType: outputMediaType,
          width,
          height,
        });
      };

      img.onerror = (err) => {
        reject(new Error("No se pudo cargar la imagen para su procesamiento."));
      };

      img.src = dataUrl;
    };

    if (typeof fileOrDataUrl === "string") {
      handleLoadedDataUrl(fileOrDataUrl);
    } else {
      const reader = new FileReader();
      reader.onload = (e) => {
        const result = e.target?.result as string;
        if (result) {
          handleLoadedDataUrl(result);
        } else {
          reject(new Error("Error al leer el archivo de imagen."));
        }
      };
      reader.onerror = () => reject(new Error("Error en FileReader."));
      reader.readAsDataURL(fileOrDataUrl);
    }
  });
}
