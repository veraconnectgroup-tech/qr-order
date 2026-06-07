import { describe, expect, it } from "vitest";
import { verifyCronSecret } from "@/lib/cron/verify-cron-secret";

function mockReq(input: {
  authorization?: string;
  xCronSecret?: string;
  secretQuery?: string;
}) {
  const headers = new Headers();
  if (input.authorization) headers.set("authorization", input.authorization);
  if (input.xCronSecret) headers.set("x-cron-secret", input.xCronSecret);
  const params = new URLSearchParams();
  if (input.secretQuery) params.set("secret", input.secretQuery);
  return { headers, nextUrl: { searchParams: params } };
}

describe("verifyCronSecret", () => {
  const secret = "abc123";

  it("accepts Bearer header", () => {
    expect(
      verifyCronSecret(mockReq({ authorization: "Bearer abc123" }), secret)
    ).toBe(true);
  });

  it("accepts query secret for cron-job.org", () => {
    expect(
      verifyCronSecret(mockReq({ secretQuery: "abc123" }), secret)
    ).toBe(true);
  });

  it("rejects wrong secret", () => {
    expect(
      verifyCronSecret(mockReq({ authorization: "Bearer wrong" }), secret)
    ).toBe(false);
  });
});
