const DEFAULT_MAX_OUTPUT_DIMENSION = 1600;
const DEFAULT_MIN_TARGET_BYTES = 180 * 1024;
const DEFAULT_SCALE_STEPS = [1, 0.9, 0.8, 0.7, 0.6] as const;
const DEFAULT_QUALITY_STEPS = [0.82, 0.74, 0.66, 0.58, 0.5, 0.42] as const;

type OptimizeImageFieldOptions = {
  fieldName: string;
  maxFiles?: number;
  maxTotalBytes?: number;
  maxPerFileBytes?: number;
  maxOutputDimension?: number;
  minTargetBytes?: number;
  tooManyFilesMessage?: string;
  tooLargeAfterCompressionMessage: string;
  invalidTypeMessage?: string;
  processingErrorMessage?: string;
};

function replaceExtension(name: string, nextExt: string) {
  const clean = name.trim() || "photo";
  return clean.includes(".")
    ? clean.replace(/\.[^.]+$/u, nextExt)
    : `${clean}${nextExt}`;
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality?: number
) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Unable to optimize one of the photos."));
        return;
      }
      resolve(blob);
    }, type, quality);
  });
}

function loadImage(file: File, processingErrorMessage: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(processingErrorMessage));
    };

    img.src = url;
  });
}

async function optimizeImageFile(
  file: File,
  targetBytes: number,
  {
    maxOutputDimension,
    processingErrorMessage,
    invalidTypeMessage,
  }: Pick<
    Required<OptimizeImageFieldOptions>,
    "maxOutputDimension" | "processingErrorMessage" | "invalidTypeMessage"
  >
) {
  if (!file.type.startsWith("image/")) {
    throw new Error(invalidTypeMessage);
  }

  if (file.size <= targetBytes) return file;

  const image = await loadImage(file, processingErrorMessage);
  const longestSide = Math.max(image.naturalWidth, image.naturalHeight);
  const baseScale = longestSide > maxOutputDimension ? maxOutputDimension / longestSide : 1;

  let bestCandidate: File | null = null;

  for (const scaleStep of DEFAULT_SCALE_STEPS) {
    const scale = Math.min(1, baseScale * scaleStep);
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Image optimization is not supported in this browser.");

    // JPEG keeps file sizes predictable; fill the canvas to avoid dark transparency output.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);

    for (const quality of DEFAULT_QUALITY_STEPS) {
      const blob = await canvasToBlob(canvas, "image/jpeg", quality);
      const candidate = new File([blob], replaceExtension(file.name, ".jpg"), {
        type: "image/jpeg",
        lastModified: file.lastModified,
      });

      if (!bestCandidate || candidate.size < bestCandidate.size) {
        bestCandidate = candidate;
      }
      if (candidate.size <= targetBytes) {
        return candidate;
      }
    }
  }

  return bestCandidate ?? file;
}

export async function optimizeImageFieldInFormData(
  formData: FormData,
  options: OptimizeImageFieldOptions
) {
  const {
    fieldName,
    maxFiles,
    maxTotalBytes,
    maxPerFileBytes,
    maxOutputDimension = DEFAULT_MAX_OUTPUT_DIMENSION,
    minTargetBytes = DEFAULT_MIN_TARGET_BYTES,
    tooManyFilesMessage = "Too many images were selected.",
    tooLargeAfterCompressionMessage,
    invalidTypeMessage = "Only image files can be uploaded.",
    processingErrorMessage = "One of the photos could not be processed. Please use JPG, PNG, or WEBP images.",
  } = options;

  const files = formData
    .getAll(fieldName)
    .filter((value) => value instanceof File && value.size > 0) as File[];

  if (!files.length) return formData;
  if (maxFiles != null && files.length > maxFiles) {
    throw new Error(tooManyFilesMessage);
  }

  const currentTotal = files.reduce((sum, file) => sum + file.size, 0);
  const needsTotalCompression = maxTotalBytes != null && currentTotal > maxTotalBytes;
  const needsPerFileCompression = maxPerFileBytes != null && files.some((file) => file.size > maxPerFileBytes);

  if (!needsTotalCompression && !needsPerFileCompression) {
    return formData;
  }

  const next = new FormData();
  for (const [key, value] of formData.entries()) {
    if (key === fieldName && value instanceof File) continue;
    next.append(key, value);
  }

  const optimizedFiles: File[] = [];
  let optimizedTotal = 0;

  for (let index = 0; index < files.length; index += 1) {
    let targetBytes = files[index].size;

    if (maxTotalBytes != null) {
      const remainingBudget = maxTotalBytes - optimizedTotal;
      const remainingFiles = files.length - index;
      targetBytes = Math.max(
        minTargetBytes,
        Math.floor(remainingBudget / Math.max(1, remainingFiles))
      );
    }

    if (maxPerFileBytes != null) {
      targetBytes = Math.min(targetBytes, maxPerFileBytes);
    }

    const optimized = await optimizeImageFile(files[index], targetBytes, {
      maxOutputDimension,
      processingErrorMessage,
      invalidTypeMessage,
    });

    optimizedFiles.push(optimized);
    optimizedTotal += optimized.size;

    if (maxPerFileBytes != null && optimized.size > maxPerFileBytes) {
      throw new Error(tooLargeAfterCompressionMessage);
    }
  }

  if (maxTotalBytes != null && optimizedTotal > maxTotalBytes) {
    throw new Error(tooLargeAfterCompressionMessage);
  }

  for (const file of optimizedFiles) {
    next.append(fieldName, file);
  }

  return next;
}
