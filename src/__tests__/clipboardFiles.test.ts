import { describe, expect, it } from "vitest";
import { extractImageFiles } from "../utils/clipboardFiles";

const createFile = (name: string, type = "image/png") =>
  new File(["image"], name, { type });

describe("extractImageFiles", () => {
  it("filters image files while keeping order", () => {
    const first = createFile("first.png");
    const second = createFile("second.jpg", "image/jpeg");

    expect(
      extractImageFiles([
        first,
        createFile("document.txt", "text/plain"),
        second,
      ]),
    ).toEqual([first, second]);
  });

  it("drops non-image files", () => {
    const image = createFile("image.png");

    expect(
      extractImageFiles([
        createFile("document.pdf", "application/pdf"),
        createFile("archive.zip", "application/zip"),
        image,
      ]),
    ).toEqual([image]);
  });

  it("caps results at ten files", () => {
    const files = Array.from({ length: 12 }, (_, index) =>
      createFile(`image-${index}.png`),
    );

    expect(extractImageFiles(files)).toEqual(files.slice(0, 10));
  });

  it("skips files over ten megabytes", () => {
    const image = createFile("image.png");
    const oversized = new File(
      [new Uint8Array(10 * 1024 * 1024 + 1)],
      "large.png",
      { type: "image/png" },
    );

    expect(extractImageFiles([oversized, image])).toEqual([image]);
  });
});
