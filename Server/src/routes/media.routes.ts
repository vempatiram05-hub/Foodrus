import express from "express";
import crypto from "node:crypto";
import path from "node:path";

const router = express.Router();

router.get("/signed-file", (req, res) => {
  const filePath = req.query.path as string | undefined;
  const expires = req.query.expires as string | undefined;
  const sig = req.query.sig as string | undefined;

  if (!filePath || !expires || !sig) {
    return res.status(400).send("Invalid URL");
  }

  if (Date.now() > Number(expires)) {
    return res.status(403).send("URL expired");
  }

  const secret = process.env.LOCAL_URL_SECRET!;
  const signatureBase = `${filePath}:${expires}`;

  const expectedSig = crypto
    .createHmac("sha256", secret)
    .update(signatureBase)
    .digest("hex");

  if (sig !== expectedSig) {
    return res.status(403).send("Invalid signature");
  }

  const absolutePath = path.join(process.cwd(), "src", filePath);

  return res.sendFile(absolutePath);
});


export default router;
