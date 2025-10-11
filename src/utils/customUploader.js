import cloudinary from "../utils/cloudinary.js";


const customUploader = async ({ file, oldUrl = null, folder = "uploads" }) => {
  let uploadedUrl = null;
  if (file && file.path) {
    if (oldUrl) {
      const folderPattern = folder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const publicIdMatch = oldUrl.match(new RegExp(`${folderPattern}/([^./]+)\\.[a-zA-Z0-9]+$`));
      if (publicIdMatch && publicIdMatch[1]) {
        try {
          await cloudinary.uploader.destroy(`${folder}/${publicIdMatch[1]}`);
        } catch (e) {
          console.log('Cloudinary delete error:', e);
        }
      }
    }
    const uploadResult = await cloudinary.uploader.upload(file.path, { folder });
    uploadedUrl = uploadResult.secure_url;
    try {
      const fs = await import('fs');
      fs.unlinkSync(file.path);
    } catch (e) {
      console.log('Error deleting local file:', e);
    }
  }
  return uploadedUrl;
};


export default customUploader;