import crypto from "crypto";

export const generateLocalSignedUrl = (filePath: string): string => {
  const expiresInSeconds = 300; // 5 minutes
  const expiresAt = Date.now() + expiresInSeconds * 1000;

  const secret = process.env.LOCAL_URL_SECRET!;
  const signatureBase = `${filePath}:${expiresAt}`;

  const signature = crypto
    .createHmac("sha256", secret)
    .update(signatureBase)
    .digest("hex");

  return `/signed-file?path=${encodeURIComponent(
    filePath
  )}&expires=${expiresAt}&sig=${signature}`;
};
