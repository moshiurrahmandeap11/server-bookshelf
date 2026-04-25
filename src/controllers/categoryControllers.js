import { db } from "../database/db.js";
import { deleteFromCloudinary } from "../middleware/upload.js"; 

// get all categories
export const fetchCategories = async (req, res) => {
    try {
        const result = await db.collection("categories")
            .find({})
            .sort({ createdAt: -1 }) 
            .limit(50) 
            .toArray();

        return res.status(200).json({
            success: true,
            message: "Categories fetched successfully",
            count: result.length,
            data: result,
        });
    } catch (error) {
        console.error("Category fetch error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message,
        });
    }
};

// get single category by id
export const fetchCategoryById = async (req, res) => {
    try {
        const { id } = req.params;
        const { ObjectId } = await import('mongodb');
        
        const result = await db.collection("categories").findOne({ 
            _id: new ObjectId(id) 
        });
        
        if (!result) {
            return res.status(404).json({
                success: false,
                message: "Category not found",
            });
        }
        
        return res.status(200).json({
            success: true,
            message: "Category fetched successfully",
            data: result,
        });
    } catch (error) {
        console.error("Category fetch by id error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

// get categories with pagination
export const fetchCategoriesPaginated = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        
        const total = await db.collection("categories").countDocuments();
        
        const result = await db.collection("categories")
            .find({})
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .toArray();
        
        return res.status(200).json({
            success: true,
            message: "Categories fetched successfully",
            data: result,
            pagination: {
                currentPage: page,
                totalPages: Math.ceil(total / limit),
                totalItems: total,
                itemsPerPage: limit,
            },
        });
    } catch (error) {
        console.error("Category fetch error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

// ✅ create new category (ইমেজ আপলোড সহ)
export const createCategory = async (req, res) => {
    try {
        const { name, slug, description } = req.body;
        
        // ভ্যালিডেশন
        if (!name || !slug) {
            return res.status(400).json({
                success: false,
                message: "Name and slug are required",
            });
        }
        
        // ক্যাটাগরি ইতিমধ্যে আছে কিনা চেক
        const existingCategory = await db.collection("categories").findOne({ 
            $or: [{ name }, { slug }] 
        });
        
        if (existingCategory) {
            return res.status(409).json({
                success: false,
                message: "Category with this name or slug already exists",
            });
        }
        
        // ✅ ইমেজ URL (যদি আপলোড করা হয়)
        let imageUrl = null;
        let imagePublicId = null;
        
        if (req.file) {
            imageUrl = req.file.path;
            imagePublicId = req.file.filename;
        }
        
        const newCategory = {
            name,
            slug,
            description: description || "",
            image: imageUrl,
            imagePublicId: imagePublicId,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        
        const result = await db.collection("categories").insertOne(newCategory);
        
        return res.status(201).json({
            success: true,
            message: "Category created successfully",
            data: {
                id: result.insertedId,
                ...newCategory,
            },
        });
    } catch (error) {
        console.error("Category creation error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

// ✅ update category (ইমেজ আপলোড সহ)
export const updateCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, slug, description } = req.body;
        const { ObjectId } = await import('mongodb');
        
        // বিদ্যমান ক্যাটাগরি খুঁজে বের করুন
        const existingCategory = await db.collection("categories").findOne({ 
            _id: new ObjectId(id) 
        });
        
        if (!existingCategory) {
            return res.status(404).json({
                success: false,
                message: "Category not found",
            });
        }
        
        const updateFields = {
            updatedAt: new Date(),
        };
        
        if (name) updateFields.name = name;
        if (slug) updateFields.slug = slug;
        if (description !== undefined) updateFields.description = description;
        
        // ✅ ইমেজ আপডেট (যদি নতুন ইমেজ আসে)
        if (req.file) {
            // পুরনো ইমেজ ডিলিট করুন (যদি থাকে)
            if (existingCategory.imagePublicId) {
                try {
                    await deleteFromCloudinary(existingCategory.imagePublicId, 'image');
                } catch (deleteError) {
                    console.error("Old image deletion error:", deleteError);
                }
            }
            
            updateFields.image = req.file.path;
            updateFields.imagePublicId = req.file.filename;
        }
        
        const result = await db.collection("categories").updateOne(
            { _id: new ObjectId(id) },
            { $set: updateFields }
        );
        
        return res.status(200).json({
            success: true,
            message: "Category updated successfully",
        });
    } catch (error) {
        console.error("Category update error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};

// ✅ delete category (ইমেজও ডিলিট হবে)
export const deleteCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { ObjectId } = await import('mongodb');
        
        // ক্যাটাগরি খুঁজে বের করুন
        const category = await db.collection("categories").findOne({ 
            _id: new ObjectId(id) 
        });
        
        if (!category) {
            return res.status(404).json({
                success: false,
                message: "Category not found",
            });
        }
        
        // ✅ ক্যাটাগরির ইমেজ ডিলিট করুন (যদি থাকে)
        if (category.imagePublicId) {
            try {
                await deleteFromCloudinary(category.imagePublicId, 'image');
            } catch (deleteError) {
                console.error("Image deletion error:", deleteError);
            }
        }
        
        // ক্যাটাগরি ডিলিট করুন
        const result = await db.collection("categories").deleteOne({ 
            _id: new ObjectId(id) 
        });
        
        return res.status(200).json({
            success: true,
            message: "Category deleted successfully",
        });
    } catch (error) {
        console.error("Category deletion error:", error);
        return res.status(500).json({
            success: false,
            message: "Internal server error",
        });
    }
};