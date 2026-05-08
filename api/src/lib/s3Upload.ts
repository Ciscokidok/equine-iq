import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

function getS3Client(): S3Client {
  const bucket = process.env.AWS_S3_BUCKET
  const region = process.env.AWS_REGION
  if (!bucket || !region) {
    throw new Error('AWS_S3_BUCKET and AWS_REGION are required')
  }
  return new S3Client({ region })
}

function getBucket(): string {
  const bucket = process.env.AWS_S3_BUCKET
  if (!bucket) throw new Error('AWS_S3_BUCKET and AWS_REGION are required')
  return bucket
}

export async function getPresignedUploadUrl(
  listingId: string,
  docType: string,
  fileName: string,
  mimeType: string
): Promise<{ uploadUrl: string; s3Key: string }> {
  const s3Client = getS3Client()
  const bucket = getBucket()
  const sanitized = fileName.replace(/[^a-zA-Z0-9._-]/g, '_')
  const s3Key = `listings/${listingId}/${docType}/${Date.now()}-${sanitized}`

  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: s3Key,
    ContentType: mimeType,
  })

  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 900 })
  return { uploadUrl, s3Key }
}

export async function getPresignedDownloadUrl(s3Key: string): Promise<string> {
  const s3Client = getS3Client()
  const bucket = getBucket()

  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: s3Key,
  })

  return getSignedUrl(s3Client, command, { expiresIn: 900 })
}
