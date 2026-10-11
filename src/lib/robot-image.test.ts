import { describe, expect, it } from "vitest";
import { decodeRobotImage, MAX_ROBOT_IMAGE_BYTES } from "@/lib/robot-image";

const pngSignature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]).toString("base64");

describe("decodeRobotImage", () => {
  it("accepts a PNG with matching file signature", () => {
    expect(decodeRobotImage(pngSignature, "image/png")).toEqual(new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]));
  });

  it("rejects a mismatch between declared content type and file signature", () => {
    expect(() => decodeRobotImage(pngSignature, "image/jpeg")).toThrow("does not match its image type");
  });

  it("rejects invalid base64", () => {
    expect(() => decodeRobotImage("not an image", "image/png")).toThrow("data is invalid");
  });

  it("rejects empty images", () => {
    expect(() => decodeRobotImage("", "image/png")).toThrow("smaller than 2 MB");
  });

  it("enforces the image size limit", () => {
    const oversized = Buffer.alloc(MAX_ROBOT_IMAGE_BYTES + 1).toString("base64");
    expect(() => decodeRobotImage(oversized, "image/png")).toThrow("smaller than 2 MB");
  });
});
