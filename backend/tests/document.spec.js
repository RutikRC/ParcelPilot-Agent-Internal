const { test, expect } = require("@playwright/test");
const fs = require("fs");

const BASE_URL = "http://localhost:5000/api/documents";
const uploadFilePath = "E:\\AI CRM\\upload-test.pdf"; // Update this path to point to a valid PDF file on your system
let createdDocument;

const ensureFileExists = () => {
  if (!fs.existsSync(uploadFilePath)) {
    throw new Error(`Upload file not found: ${uploadFilePath}`);
  }
};

test.describe.serial("Document upload API", () => {
  test.beforeAll(() => {
    ensureFileExists();
  });

  test("Upload PDF document", async ({ request }) => {
    const response = await request.post(`${BASE_URL}/upload`, {
      multipart: {
        file: {
          name: "upload-test.pdf",
          mimeType: "application/pdf",
          buffer: fs.readFileSync(uploadFilePath),
        },
        title: "Test PDF Document",
        description: "Playwright upload test",
        metadata: JSON.stringify({ source: "playwright", environment: "test" }),
        tags: JSON.stringify(["playwright", "upload"]),
      },
    });

    expect(response.status()).toBe(201);
    const body = await response.json();

    expect(body.success).toBe(true);
    expect(body.data.title).toBe("Test PDF Document");
    expect(body.data.original_name).toBe("upload-test.pdf");
    expect(body.data.mime_type).toBe("application/pdf");
    expect(body.data.path).toContain("uploads/");
    expect(body.data.metadata).toEqual({ source: "playwright", environment: "test" });
    expect(body.data.tags).toEqual(["playwright", "upload"]);

    createdDocument = body.data;
  });

  test("List documents with pagination and search", async ({ request }) => {
    const response = await request.get(`${BASE_URL}?page=1&limit=10&search=Test&sort_by=created_at&order=desc`);

    expect(response.status()).toBe(200);
    const body = await response.json();

    expect(body.success).toBe(true);
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.meta).toBeTruthy();
    expect(body.meta.page).toBe(1);
    expect(body.meta.limit).toBe(10);
  });

  test("Update document metadata", async ({ request }) => {
    expect(createdDocument).toBeTruthy();

    const response = await request.patch(`${BASE_URL}/${createdDocument.id}`, {
      data: {
        metadata: JSON.stringify({ source: "playwright", environment: "test", updated: true }),
      },
    });

    expect(response.status()).toBe(200);
    const body = await response.json();

    expect(body.success).toBe(true);
    expect(body.data.metadata).toEqual({ source: "playwright", environment: "test", updated: true });
  });

  test("Download document by ID", async ({ request }) => {
    expect(createdDocument).toBeTruthy();

    const response = await request.get(`${BASE_URL}/${createdDocument.id}/download`);

    expect(response.status()).toBe(200);
    expect(response.headers()["content-disposition"]).toContain("attachment");
  });

  test("Soft delete and restore document", async ({ request }) => {
    expect(createdDocument).toBeTruthy();

    const deleteResponse = await request.delete(`${BASE_URL}/${createdDocument.id}`);
    expect(deleteResponse.status()).toBe(200);
    const deleteBody = await deleteResponse.json();
    expect(deleteBody.success).toBe(true);

    const notFoundResponse = await request.get(`${BASE_URL}/${createdDocument.id}`);
    expect(notFoundResponse.status()).toBe(404);

    const restoreResponse = await request.patch(`${BASE_URL}/${createdDocument.id}/restore`);
    expect(restoreResponse.status()).toBe(200);
    const restoreBody = await restoreResponse.json();
    expect(restoreBody.success).toBe(true);
    expect(restoreBody.data.id).toBe(createdDocument.id);

    const restoredResponse = await request.get(`${BASE_URL}/${createdDocument.id}`);
    expect(restoredResponse.status()).toBe(200);
    const restoredBody = await restoredResponse.json();
    expect(restoredBody.success).toBe(true);
    expect(restoredBody.data.id).toBe(createdDocument.id);
  });
});
