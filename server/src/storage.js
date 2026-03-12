import { S3Client, PutObjectCommand, DeleteObjectCommand, CreateBucketCommand, HeadBucketCommand, PutBucketPolicyCommand } from '@aws-sdk/client-s3';
import 'dotenv/config';

const MINIO_ENDPOINT = process.env.MINIO_ENDPOINT || 'localhost';
const MINIO_PORT = process.env.MINIO_PORT || '9000';
const MINIO_USE_SSL = process.env.MINIO_USE_SSL === 'true';
const MINIO_ACCESS_KEY = process.env.MINIO_ACCESS_KEY || 'minioadmin';
const MINIO_SECRET_KEY = process.env.MINIO_SECRET_KEY || 'minioadmin123';
const MINIO_BUCKET = process.env.MINIO_BUCKET || 'mtuci-guesser';

// Create S3 client configured for MinIO
const s3Client = new S3Client({
  endpoint: `http${MINIO_USE_SSL ? 's' : ''}://${MINIO_ENDPOINT}:${MINIO_PORT}`,
  region: 'us-east-1', // MinIO requires a region, but ignores it
  credentials: {
    accessKeyId: MINIO_ACCESS_KEY,
    secretAccessKey: MINIO_SECRET_KEY,
  },
  forcePathStyle: true, // Required for MinIO
});

/**
 * Set public read policy for the bucket
 */
async function setBucketPublicPolicy() {
  const policy = {
    Version: '2012-10-17',
    Statement: [
      {
        Effect: 'Allow',
        Principal: '*',
        Action: ['s3:GetObject'],
        Resource: [`arn:aws:s3:::${MINIO_BUCKET}/*`]
      }
    ]
  };

  try {
    await s3Client.send(new PutBucketPolicyCommand({
      Bucket: MINIO_BUCKET,
      Policy: JSON.stringify(policy)
    }));
    console.log(`✓ Set public read policy for bucket '${MINIO_BUCKET}'`);
  } catch (error) {
    console.error('Failed to set bucket policy:', error);
  }
}

/**
 * Initialize storage - create bucket if it doesn't exist
 */
export async function initializeStorage() {
  try {
    // Check if bucket exists
    await s3Client.send(new HeadBucketCommand({ Bucket: MINIO_BUCKET }));
    console.log(`✓ MinIO bucket '${MINIO_BUCKET}' exists`);
    // Ensure public policy is set
    await setBucketPublicPolicy();
  } catch (error) {
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      // Bucket doesn't exist, create it
      try {
        await s3Client.send(new CreateBucketCommand({ Bucket: MINIO_BUCKET }));
        console.log(`✓ Created MinIO bucket '${MINIO_BUCKET}'`);
        // Set public policy for new bucket
        await setBucketPublicPolicy();
      } catch (createError) {
        console.error('Failed to create bucket:', createError);
        throw createError;
      }
    } else {
      console.error('MinIO connection error:', error);
      throw error;
    }
  }
}

/**
 * Upload a file to MinIO
 * @param {Buffer} buffer - File buffer
 * @param {string} objectName - Object name (path in bucket)
 * @param {string} contentType - MIME type
 * @returns {Promise<string>} - Public URL of uploaded file
 */
export async function uploadFile(buffer, objectName, contentType) {
  const command = new PutObjectCommand({
    Bucket: MINIO_BUCKET,
    Key: objectName,
    Body: buffer,
    ContentType: contentType,
  });

  await s3Client.send(command);
  
  // Return URL for accessing the file
  const protocol = MINIO_USE_SSL ? 'https' : 'http';
  return `${protocol}://${MINIO_ENDPOINT}:${MINIO_PORT}/${MINIO_BUCKET}/${objectName}`;
}

/**
 * Delete a file from MinIO
 * @param {string} objectName - Object name (path in bucket)
 */
export async function deleteFile(objectName) {
  try {
    const command = new DeleteObjectCommand({
      Bucket: MINIO_BUCKET,
      Key: objectName,
    });
    await s3Client.send(command);
    console.log(`Deleted: ${objectName}`);
  } catch (error) {
    console.error(`Failed to delete ${objectName}:`, error);
  }
}

/**
 * Extract object name from full MinIO URL
 * @param {string} url - Full URL like http://localhost:9000/bucket/path/file.png
 * @returns {string|null} - Object name like path/file.png
 */
export function getObjectNameFromUrl(url) {
  if (!url) return null;
  
  // Handle MinIO URLs
  const minioPattern = new RegExp(`/${MINIO_BUCKET}/(.+)$`);
  const match = url.match(minioPattern);
  if (match) {
    return match[1];
  }
  
  // Handle old local paths like /uploads/floors/file.png
  if (url.startsWith('/uploads/')) {
    return url.replace('/uploads/', '');
  }
  
  return null;
}

/**
 * Get MinIO bucket name
 */
export function getBucket() {
  return MINIO_BUCKET;
}

/**
 * Get MinIO base URL
 */
export function getBaseUrl() {
  const protocol = MINIO_USE_SSL ? 'https' : 'http';
  return `${protocol}://${MINIO_ENDPOINT}:${MINIO_PORT}/${MINIO_BUCKET}`;
}

