import crypto from "crypto";
const key = Buffer.from(process.env.MARKETPLACE_MASTER_KEY || "", "hex");
export const encrypt = (plaintext) => {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  const enc = Buffer.concat([cipher.update(Buffer.from(plaintext, "utf8")), cipher.final()]);
  return `${iv.toString("base64")}:${enc.toString("base64")}`;
};
export const decrypt = (ciphertext) => {
  const [ivB64, dataB64] = ciphertext.split(":");
  const iv = Buffer.from(ivB64, "base64");
  const data = Buffer.from(dataB64, "base64");
  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  const dec = Buffer.concat([decipher.update(data), decipher.final()]);
  return dec.toString("utf8");
};
