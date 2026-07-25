const { S3Client } = require('@aws-sdk/client-s3');
const { Upload } = require('@aws-sdk/lib-storage');
const fs = require('fs');
require('dotenv').config();

async function uploadFileToR2() {
  const filePath = 'Kayıt 2026-07-09 224750.mp4';
  if (!fs.existsSync(filePath)) {
    console.error('File not found:', filePath);
    return;
  }

  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });

  const fileStream = fs.createReadStream(filePath);
  const r2FileName = 'bekir-video.mp4';

  console.log('Starting upload...');
  const upload = new Upload({
    client,
    params: {
      Bucket: process.env.R2_BUCKET_NAME,
      Key: r2FileName,
      Body: fileStream,
      ContentType: 'video/mp4',
      ContentDisposition: 'attachment; filename="video.mp4"',
    },
  });

  let lastLoggedPercent = 0;
  upload.on('httpUploadProgress', (progress) => {
    if (progress.loaded && progress.total) {
      const currentPercent = ((progress.loaded / progress.total) * 100);
      if (currentPercent - lastLoggedPercent >= 5 || currentPercent === 100) {
          console.log(`Uploaded ${currentPercent.toFixed(2)}%`);
          lastLoggedPercent = currentPercent;
      }
    } else {
      console.log(`Uploaded ${progress.loaded} bytes`);
    }
  });

  await upload.done();
  console.log('Upload complete!');
  const publicDomain = process.env.R2_PUBLIC_DOMAIN;
  if (publicDomain) {
    console.log(`Public URL: ${publicDomain.endsWith('/') ? publicDomain.slice(0, -1) : publicDomain}/${r2FileName}`);
  }
}

uploadFileToR2().catch(console.error);
