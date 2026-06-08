jest.mock("../services/helcim.service", () => ({ createHelcimPayment: jest.fn() }));

import request from "supertest";
import app from "../../app";

describe("Health check", () => {
  it("GET /health should return 200 and status ok", async () => {
    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(res.body.status).toBe("ok");
  });
});
