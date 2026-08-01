const { test, expect } = require("@playwright/test");

const BASE_URL = "http://localhost:5000/api/auth";

const user = {
  username: `user_${Date.now()}`,
  email: `user_${Date.now()}@gmail.com`,
  password: "Password@123",
};

let accessToken;

test.describe("Authentication APIs", () => {
  test("1. Register User", async ({ request }) => {
    const response = await request.post(`${BASE_URL}/register`, {
      data: user,
    });

    expect(response.status()).toBe(201);

    const body = await response.json();

    expect(body.success).toBe(true);
    expect(body.data.email).toBe(user.email);
  });

  test("2. Login User", async ({ request }) => {
    const response = await request.post(`${BASE_URL}/login`, {
      data: {
        email: user.email,
        password: user.password,
      },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();

    expect(body.success).toBe(true);

    accessToken = body.data.accessToken;

    expect(accessToken).toBeTruthy();
  });

  test("3. Get Current User", async ({ request }) => {
    const response = await request.get(`${BASE_URL}/me`, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();

    expect(body.success).toBe(true);
    expect(body.data.email).toBe(user.email);
  });

  test("4. Refresh Access Token", async ({ request }) => {
    // Login again so this request context has the refresh-token cookie
    await request.post(`${BASE_URL}/login`, {
      data: {
        email: user.email,
        password: user.password,
      },
    });

    const response = await request.post(`${BASE_URL}/refresh`);

    expect(response.status()).toBe(200);

    const body = await response.json();

    expect(body.success).toBe(true);
    expect(body.data.accessToken).toBeTruthy();
  });

  test("5. Logout", async ({ request }) => {
    // Login again so this request context has the refresh-token cookie
    const login = await request.post(`${BASE_URL}/login`, {
      data: {
        email: user.email,
        password: user.password,
      },
    });

    const loginBody = await login.json();

    const token = loginBody.data.accessToken;

    const response = await request.post(`${BASE_URL}/logout`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    expect(response.status()).toBe(200);

    const body = await response.json();

    expect(body.success).toBe(true);
  });
});