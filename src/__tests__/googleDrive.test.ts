import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";

const ACCESS_TOKEN_KEY = "gdrive_access_token";
const TOKEN_EXPIRY_KEY = "gdrive_token_expiry";

function setRealToken(): void {
  sessionStorage.setItem(ACCESS_TOKEN_KEY, "real_test_token");
  sessionStorage.setItem(
    TOKEN_EXPIRY_KEY,
    (Date.now() + 60 * 60 * 1000).toString(),
  );
}

async function createDriveService(): Promise<
  import("../services/googleDrive").GoogleDriveService
> {
  const { GoogleDriveService } = await import("../services/googleDrive");
  return new GoogleDriveService();
}

describe("GoogleDriveService", () => {
  beforeEach(() => {
    vi.resetModules();
    localStorage.clear();
    sessionStorage.clear();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.unstubAllGlobals();
  });

  it("rejects image uploads in mock mode", async () => {
    const service = await createDriveService();
    const file = new File(["image"], "image.png", { type: "image/png" });

    await expect(service.uploadImageFile(file)).rejects.toThrow(
      "Image upload requires signing in to Google Drive.",
    );
  });

  it("uploads an image with multipart metadata and content", async () => {
    setRealToken();
    const service = await createDriveService();
    const metadata = {
      id: "image_123",
      name: "diagram.png",
      mimeType: "image/png",
      webViewLink: "https://drive.google.com/file/image_123",
    };
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify(metadata), { status: 200 }),
      );
    vi.stubGlobal("fetch", fetchMock);
    const file = new File(["image bytes"], "diagram.png", {
      type: "image/png",
    });

    await expect(service.uploadImageFile(file, "folder_123")).resolves.toEqual(
      metadata,
    );

    const call = fetchMock.mock.calls[0];
    if (!call) throw new Error("Expected image upload request");
    const request = call[1] as RequestInit;
    expect(call[0]).toBe(
      "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,mimeType,webViewLink",
    );
    expect(request.method).toBe("POST");
    expect(new Headers(request.headers).get("Authorization")).toBe(
      "Bearer real_test_token",
    );
    expect(new Headers(request.headers).get("Content-Type")).toContain(
      "multipart/related",
    );
    const body = await (request.body as Blob).text();
    expect(body).toContain('"name":"diagram.png"');
    expect(body).toContain('"mimeType":"image/png"');
    expect(body).toContain('"parents":["folder_123"]');
    expect(body).toContain("image bytes");
  });

  it("requests head revision fields when updating a real file", async () => {
    setRealToken();
    const service = await createDriveService();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          id: "file_123",
          name: "notes.md",
          mimeType: "text/markdown",
          headRevisionId: "abc",
        }),
        { status: 200 },
      ),
    );
    vi.stubGlobal("fetch", fetchMock);

    await service.updateFile("file_123", "content", "notes.md");

    const call = fetchMock.mock.calls[0];
    if (!call) throw new Error("Expected update request");
    const request = call[1] as RequestInit;
    expect(String(call[0])).toContain("headRevisionId");
    expect(request.method).toBe("PATCH");
    expect(new Headers(request.headers).get("Authorization")).toBe(
      "Bearer real_test_token",
    );
  });

  it("fetches the real head revision ID", async () => {
    setRealToken();
    const service = await createDriveService();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ headRevisionId: "abc" }), {
        status: 200,
      }),
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(service.fetchHeadRevisionId("file_123")).resolves.toBe("abc");

    const call = fetchMock.mock.calls[0];
    if (!call) throw new Error("Expected head revision request");
    expect(call[0]).toBe(
      "https://www.googleapis.com/drive/v3/files/file_123?fields=headRevisionId",
    );
    expect(
      new Headers((call[1] as RequestInit).headers).get("Authorization"),
    ).toBe("Bearer real_test_token");
  });
});
