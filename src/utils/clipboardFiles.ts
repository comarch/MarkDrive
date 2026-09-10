const MAX_IMAGE_FILE_SIZE = 10 * 1024 * 1024;
const MAX_IMAGE_FILE_COUNT = 10;

export function extractImageFiles(files: File[]): File[] {
  return files
    .filter(
      (file) =>
        file.type.startsWith("image/") && file.size <= MAX_IMAGE_FILE_SIZE,
    )
    .slice(0, MAX_IMAGE_FILE_COUNT);
}
