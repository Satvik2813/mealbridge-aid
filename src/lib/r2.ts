import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

// Determine bucket from role
export const getBucketUrl = (role: "donor" | "recipient" | "partner") => {
  return `https://191a5a2501e16ad7236f97b921a8ebbf.r2.cloudflarestorage.com/${role}`;
};

const R2_ACCESS_KEY_ID = import.meta.env.VITE_R2_ACCESS_KEY_ID || "";
const R2_SECRET_ACCESS_KEY = import.meta.env.VITE_R2_SECRET_ACCESS_KEY || "";
const R2_ACCOUNT_ID = "191a5a2501e16ad7236f97b921a8ebbf";

const s3Client = new S3Client({
  region: "auto",
  endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: R2_ACCESS_KEY_ID,
    secretAccessKey: R2_SECRET_ACCESS_KEY,
  },
});

export const uploadPhotoToR2 = async (file: File, role: "donor" | "recipient" | "partner") => {
  if (!R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) {
    throw new Error("Missing Cloudflare R2 credentials. Please set VITE_R2_ACCESS_KEY_ID and VITE_R2_SECRET_ACCESS_KEY in .env");
  }

  const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, "_")}`;
  
  await s3Client.send(
    new PutObjectCommand({
      Bucket: role,
      Key: fileName,
      Body: file,
      ContentType: file.type,
      // ACL: "public-read", // Optionally if bucket allows it
    })
  );

  // Return the public URL Assuming the bucket is publicly readable, or we use the custom domain.
  // Note: if the R2 bucket isn't explicitly public, this URL will require signing to view.
  return `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com/${role}/${fileName}`;
};
