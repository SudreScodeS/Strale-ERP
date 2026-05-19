// ==========================================
// S3/R2 UPLOAD CONFIGURATION EXAMPLE
// ==========================================
//
// To switch from local filesystem uploads to S3 or R2:
//
// 1. Install the AWS SDK:
//    npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
//
// 2. Set environment variables in .env.local:
//    UPLOAD_BACKEND=s3
//    S3_ENDPOINT=https://your-bucket.s3.amazonaws.com  (or R2 endpoint)
//    S3_REGION=us-east-1
//    S3_BUCKET=your-bucket-name
//    S3_ACCESS_KEY_ID=your-access-key
//    S3_SECRET_ACCESS_KEY=your-secret-key
//    S3_PUBLIC_URL=https://cdn.yourdomain.com  (optional: custom CDN URL)
//
// 3. Update the upload route (app/api/v1/upload/route.ts) to use S3:
//
//    import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
//    import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
//
//    const s3 = new S3Client({
//      endpoint: process.env.S3_ENDPOINT,
//      region: process.env.S3_REGION,
//      credentials: {
//        accessKeyId: process.env.S3_ACCESS_KEY_ID!,
//        secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
//      },
//    });
//
//    // Upload:
//    await s3.send(new PutObjectCommand({
//      Bucket: process.env.S3_BUCKET,
//      Key: key,
//      Body: buffer,
//      ContentType: file.type,
//    }));
//
//    // Delete:
//    await s3.send(new DeleteObjectCommand({
//      Bucket: process.env.S3_BUCKET,
//      Key: key,
//    }));
//
//    // Presigned URL:
//    const url = await getSignedUrl(s3, new GetObjectCommand({
//      Bucket: process.env.S3_BUCKET,
//      Key: key,
//    }), { expiresIn: 3600 });
//
// 4. For Cloudflare R2, the setup is similar but:
//    - Endpoint: https://<account-id>.r2.cloudflarestorage.com
//    - Region: auto
//    - Use the R2 access key and secret key
//
// 5. For production, consider:
//    - Using a CDN (CloudFront, Cloudflare) in front of S3/R2
//    - Setting up CORS on the bucket for direct browser uploads
//    - Implementing multipart uploads for large files
//    - Adding virus scanning before storing files

export const S3_EXAMPLE_CONFIG = {
  backend: 's3' as const,
  endpoint: process.env.S3_ENDPOINT || 'https://s3.amazonaws.com',
  region: process.env.S3_REGION || 'us-east-1',
  bucket: process.env.S3_BUCKET || 'elitium-uploads',
  publicUrl: process.env.S3_PUBLIC_URL || '',
};
