import multer from 'multer';
import { CloudinaryStorage } from 'multer-storage-cloudinary';
import cloudinary from '../config/cloudinary.js';

// ফাইলের ধরন চেক করার জন্য ফিল্টার
const fileFilter = (req, file, cb) => {
    // অনুমোদিত ইমেজ টাইপ
    const allowedImageTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/gif', 'image/webp'];
    // অনুমোদিত ভিডিও টাইপ
    const allowedVideoTypes = ['video/mp4', 'video/mkv', 'video/avi', 'video/mov', 'video/webm'];
    // অনুমোদিত ডকুমেন্ট টাইপ
    const allowedDocumentTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'];
    
    // সব অনুমোদিত টাইপ একত্রে
    const allAllowed = [...allowedImageTypes, ...allowedVideoTypes, ...allowedDocumentTypes];
    
    if (allAllowed.includes(file.mimetype)) {
        cb(null, true);
    } else {
        cb(new Error('Invalid file type. Only images, videos, and PDFs are allowed!'), false);
    }
};

// ক্লাউডিনারি স্টোরেজ তৈরি
const createStorage = (folderName) => {
    return new CloudinaryStorage({
        cloudinary: cloudinary,
        params: async (req, file) => {
            // ফাইলের টাইপ অনুযায়ী resourceType সেট
            let resourceType = 'auto';
            let format = 'jpg';
            
            if (file.mimetype.startsWith('image/')) {
                resourceType = 'image';
                format = file.mimetype.split('/')[1];
            } else if (file.mimetype.startsWith('video/')) {
                resourceType = 'video';
                format = file.mimetype.split('/')[1];
            } else if (file.mimetype === 'application/pdf') {
                resourceType = 'raw'; 
                format = 'pdf';
            } else if (file.mimetype === 'application/msword') {
                resourceType = 'raw';
                format = 'doc';
            } else if (file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
                resourceType = 'raw';
                format = 'docx';
            }
            
            return {
                folder: folderName,                    // ফোল্ডারের নাম (যেমন: users, products)
                resource_type: resourceType,           // image, video, বা raw
                format: format,                        // ফাইলের ফরম্যাট
                public_id: `${Date.now()}_${Math.round(Math.random() * 1e9)}`, // ইউনিক আইডি
                transformation: resourceType === 'image' ? [
                    { width: 1200, height: 1200, crop: 'limit' },
                    { quality: 'auto' }
                ] : []
            };
        }
    });
};

// সিঙ্গেল ফাইল আপলোড মিডলওয়্যার
export const uploadSingle = (folderName, fieldName) => {
    const storage = createStorage(folderName);
    const upload = multer({ 
        storage: storage,
        fileFilter: fileFilter,
        limits: {
            fileSize: 100 * 1024 * 1024  // 100MB লিমিট
        }
    });
    return upload.single(fieldName);
};

// মাল্টিপল ফাইল আপলোড মিডলওয়্যার
export const uploadMultiple = (folderName, fieldName, maxCount = 10) => {
    const storage = createStorage(folderName);
    const upload = multer({ 
        storage: storage,
        fileFilter: fileFilter,
        limits: {
            fileSize: 100 * 1024 * 1024  // 100MB লিমিট
        }
    });
    return upload.array(fieldName, maxCount);
};

// বিভিন্ন ফিল্ডের জন্য আপলোড মিডলওয়্যার
export const uploadFields = (folderName, fields) => {
    const storage = createStorage(folderName);
    const upload = multer({ 
        storage: storage,
        fileFilter: fileFilter
    });
    return upload.fields(fields);
};

// ক্লাউডিনারি থেকে ফাইল ডিলিট করার ফাংশন
export const deleteFromCloudinary = async (publicId, resourceType = 'image') => {
    try {
        const result = await cloudinary.uploader.destroy(publicId, {
            resource_type: resourceType
        });
        return result;
    } catch (error) {
        console.error('Error deleting from Cloudinary:', error);
        throw error;
    }
};

// URL থেকে পাবলিক আইডি বের করার ফাংশন
export const getPublicIdFromUrl = (url) => {
    const parts = url.split('/');
    const filename = parts.pop();
    const publicId = filename.split('.')[0];
    return publicId;
};