export const MAX_ROBOT_IMAGE_BYTES = 2 * 1024 * 1024;

export type RobotImageContentType = "image/jpeg" | "image/png" | "image/webp";

export function decodeRobotImage(data: string, contentType: string) {
  if (!["image/jpeg", "image/png", "image/webp"].includes(contentType)) {
    throw new Error("Choose a JPEG, PNG, or WebP image.");
  }
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(data)) {
    throw new Error("The uploaded image data is invalid.");
  }

  const bytes = Buffer.from(data, "base64");
  if (bytes.length === 0 || bytes.length > MAX_ROBOT_IMAGE_BYTES) {
    throw new Error("Robot images must be smaller than 2 MB.");
  }

  const isJpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const isPng = bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const isWebp = bytes.length >= 12 && bytes.toString("ascii", 0, 4) === "RIFF" && bytes.toString("ascii", 8, 12) === "WEBP";
  const matchesType = (contentType === "image/jpeg" && isJpeg)
    || (contentType === "image/png" && isPng)
    || (contentType === "image/webp" && isWebp);
  if (!matchesType) throw new Error("The uploaded file does not match its image type.");
  const image = new Uint8Array(bytes.length);
  image.set(bytes);
  return image;
}
