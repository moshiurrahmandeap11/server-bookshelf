import { db } from "../database/db.js";
import { ObjectId } from "mongodb";
import { deleteFromCloudinary } from "../middleware/upload.js";

// get all books (with filters, pagination, search)
export const getAllBooks = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || "";
    const category = req.query.category || "";
    const minPrice = parseFloat(req.query.minPrice) || 0;
    const maxPrice = parseFloat(req.query.maxPrice) || 1000;

    let searchCondition = {};
    if (search) {
      searchCondition = {
        $or: [
          { title: { $regex: search, $options: "i" } },
          { authorName: { $regex: search, $options: "i" } },
          { "category.name": { $regex: search, $options: "i" } }
        ]
      };
    }

    if (category) {
      searchCondition["category.slug"] = category;
    }

    searchCondition.discountPrice = { $gte: minPrice, $lte: maxPrice };

    const total = await db.collection("books").countDocuments(searchCondition);

    const books = await db.collection("books")
      .find(searchCondition)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    return res.status(200).json({
      success: true,
      message: "Books fetched successfully",
      data: books,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: limit,
      },
    });
  } catch (error) {

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// get book by ID
export const getBookById = async (req, res) => {
  try {
    const { id } = req.params;

    const book = await db.collection("books").findOne({ 
      _id: new ObjectId(id) 
    });

    if (!book) {
      return res.status(404).json({
        success: false,
        message: "Book not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Book fetched successfully",
      data: book,
    });
  } catch (error) {

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// create new book
export const createBook = async (req, res) => {
  try {


    const {
      title,
      authorName,
      categoryId,
      publisher,
      price,
      discountPrice,
      description,
      stock,
      pages,
      language,
      isbn,
      publishedDate,
      tags
    } = req.body;

    // validation
    if (!title || !authorName || !categoryId || !price) {
      return res.status(400).json({
        success: false,
        message: "Title, author, category, and price are required",
      });
    }

    let category = null;
    try {
      category = await db.collection("categories").findOne({ 
        _id: new ObjectId(categoryId) 
      });
    } catch (err) {
      return res.status(400).json({
        success: false,
        message: "Invalid category ID",
      });
    }

    if (!category) {
      return res.status(404).json({
        success: false,
        message: "Category not found",
      });
    }


    let thumbnail = null;
    let thumbnailPublicId = null;
    if (req.files && req.files.thumbnail && req.files.thumbnail.length > 0) {
      thumbnail = req.files.thumbnail[0].path;
      thumbnailPublicId = req.files.thumbnail[0].filename;
    }


    let images = [];
    if (req.files && req.files.images && req.files.images.length > 0) {
      images = req.files.images.map(file => ({
        url: file.path,
        publicId: file.filename,
        isPrimary: false
      }));
    }

    const newBook = {
      title: title.trim(),
      authorName: authorName.trim(),
      category: {
        id: category._id,
        name: category.name,
        slug: category.slug
      },
      publisher: publisher || "",
      price: parseFloat(price),
      discountPrice: discountPrice ? parseFloat(discountPrice) : parseFloat(price),
      description: description || "",
      thumbnail,
      thumbnailPublicId,
      images,
      rating: {
        average: 0,
        count: 0
      },
      reviews: [],
      stock: stock ? parseInt(stock) : 1,
      pages: pages ? parseInt(pages) : 0,
      language: language || "English",
      isbn: isbn || "",
      publishedDate: publishedDate ? new Date(publishedDate) : new Date(),
      tags: tags ? tags.split(",").map(t => t.trim()) : [],
      status: "active",
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: new ObjectId(req.user.id),
    };

    const result = await db.collection("books").insertOne(newBook);


    return res.status(201).json({
      success: true,
      message: "Book created successfully",
      data: {
        id: result.insertedId,
        ...newBook,
      },
    });
  } catch (error) {

    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};


export const updateReview = async (req, res) => {
  try {
    const { id, reviewId } = req.params;
    const { rating, comment } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: "Rating must be between 1 and 5",
      });
    }

    const book = await db.collection("books").findOne({ 
      _id: new ObjectId(id) 
    });

    if (!book) {
      return res.status(404).json({
        success: false,
        message: "Book not found",
      });
    }


    const reviewIndex = book.reviews?.findIndex(r => r.id.toString() === reviewId);
    
    if (reviewIndex === -1 || reviewIndex === undefined) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    const review = book.reviews[reviewIndex];


    if (review.userId !== userId && userRole !== "admin") {
      return res.status(403).json({
        success: false,
        message: "You can only edit your own reviews",
      });
    }

  
    const updatedReviews = [...book.reviews];
    updatedReviews[reviewIndex] = {
      ...review,
      rating: parseInt(rating),
      comment: comment || "",
      updatedAt: new Date()
    };


    const totalRating = updatedReviews.reduce((sum, r) => sum + r.rating, 0);
    const averageRating = totalRating / updatedReviews.length;

    await db.collection("books").updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          reviews: updatedReviews,
          rating: {
            average: averageRating,
            count: updatedReviews.length
          },
          updatedAt: new Date()
        }
      }
    );

    return res.status(200).json({
      success: true,
      message: "Review updated successfully",
    });
  } catch (error) {

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};


export const updateBookById = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      authorName,
      categoryId,
      publisher,
      price,
      discountPrice,
      description,
      stock,
      pages,
      language,
      isbn,
      publishedDate,
      tags,
      status,
      deletedImages 
    } = req.body;


    const existingBook = await db.collection("books").findOne({ 
      _id: new ObjectId(id) 
    });

    if (!existingBook) {
      return res.status(404).json({
        success: false,
        message: "Book not found",
      });
    }

    const updateFields = {
      updatedAt: new Date(),
    };


    if (title) updateFields.title = title;
    if (authorName) updateFields.authorName = authorName;
    if (publisher) updateFields.publisher = publisher;
    if (price) updateFields.price = parseFloat(price);
    if (discountPrice) updateFields.discountPrice = parseFloat(discountPrice);
    if (description !== undefined) updateFields.description = description;
    if (stock !== undefined) updateFields.stock = parseInt(stock);
    if (pages) updateFields.pages = parseInt(pages);
    if (language) updateFields.language = language;
    if (isbn) updateFields.isbn = isbn;
    if (publishedDate) updateFields.publishedDate = new Date(publishedDate);
    if (tags) updateFields.tags = tags.split(",").map(t => t.trim());
    if (status) updateFields.status = status;


    if (categoryId && categoryId !== existingBook.category?.id?.toString()) {
      const category = await db.collection("categories").findOne({ 
        _id: new ObjectId(categoryId) 
      });
      if (category) {
        updateFields.category = {
          id: category._id,
          name: category.name,
          slug: category.slug
        };
      }
    }


    if (req.files && req.files.thumbnail && req.files.thumbnail.length > 0) {
      if (existingBook.thumbnailPublicId) {
        try {
          await deleteFromCloudinary(existingBook.thumbnailPublicId, 'image');
        } catch (err) {
          console.error("Old thumbnail deletion error:", err);
        }
      }
      updateFields.thumbnail = req.files.thumbnail[0].path;
      updateFields.thumbnailPublicId = req.files.thumbnail[0].filename;
    }


    let deletedImagesArray = [];
    if (deletedImages) {

      if (typeof deletedImages === 'string') {
        try {
          deletedImagesArray = JSON.parse(deletedImages);
        } catch (e) {
          deletedImagesArray = deletedImages.split(',').filter(Boolean);
        }
      } else if (Array.isArray(deletedImages)) {
        deletedImagesArray = deletedImages;
      }
    }


    if (deletedImagesArray && deletedImagesArray.length > 0) {
      for (const publicId of deletedImagesArray) {
        try {
          await deleteFromCloudinary(publicId, 'image');

        } catch (err) {

        }
      }
      

      const currentImages = existingBook.images || [];
      const remainingImages = currentImages.filter(img => !deletedImagesArray.includes(img.publicId));
      updateFields.images = remainingImages;
    }


    if (req.files && req.files.images && req.files.images.length > 0) {
      const newImages = req.files.images.map(file => ({
        url: file.path,
        publicId: file.filename,
        isPrimary: false
      }));
      

      const currentImages = updateFields.images || existingBook.images || [];
      updateFields.images = [...currentImages, ...newImages];
    }

    const result = await db.collection("books").updateOne(
      { _id: new ObjectId(id) },
      { $set: updateFields }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Book not found",
      });
    }


    const updatedBook = await db.collection("books").findOne({ 
      _id: new ObjectId(id) 
    });

    return res.status(200).json({
      success: true,
      message: "Book updated successfully",
      data: updatedBook,
    });
  } catch (error) {
    console.error("Update book error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};


export const getUserBooks = async (req, res) => {
  try {
    const userId = req.user.id; 
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || "";
    const status = req.query.status || "";


    let searchCondition = { createdBy: new ObjectId(userId) };
    
    if (search) {
      searchCondition.$or = [
        { title: { $regex: search, $options: "i" } },
        { authorName: { $regex: search, $options: "i" } }
      ];
    }
    
    if (status && status !== "all") {
      searchCondition.status = status;
    }

 
    const total = await db.collection("books").countDocuments(searchCondition);


    const books = await db.collection("books")
      .find(searchCondition)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    return res.status(200).json({
      success: true,
      message: "User books fetched successfully",
      data: books,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: limit,
      },
    });
  } catch (error) {

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// delete book by ID
export const deleteBook = async (req, res) => {
  try {
    const { id } = req.params;

    const book = await db.collection("books").findOne({ 
      _id: new ObjectId(id) 
    });

    if (!book) {
      return res.status(404).json({
        success: false,
        message: "Book not found",
      });
    }

    if (book.thumbnailPublicId) {
      try {
        await deleteFromCloudinary(book.thumbnailPublicId, 'image');
      } catch (err) {
        console.error("Thumbnail deletion error:", err);
      }
    }

    if (book.images && book.images.length > 0) {
      for (const image of book.images) {
        try {
          await deleteFromCloudinary(image.publicId, 'image');
        } catch (err) {
          console.error("Gallery image deletion error:", err);
        }
      }
    }

    const result = await db.collection("books").deleteOne({ 
      _id: new ObjectId(id) 
    });

    return res.status(200).json({
      success: true,
      message: "Book deleted successfully",
    });
  } catch (error) {

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// add review to book
export const addReview = async (req, res) => {
  try {
    const { id } = req.params;
    const { rating, comment } = req.body;
    const userId = req.user.id;
    const userName = req.user.fullName;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({
        success: false,
        message: "Rating must be between 1 and 5",
      });
    }

    const book = await db.collection("books").findOne({ 
      _id: new ObjectId(id) 
    });

    if (!book) {
      return res.status(404).json({
        success: false,
        message: "Book not found",
      });
    }

    const newReview = {
      id: new ObjectId(),
      userId,
      userName,
      rating: parseInt(rating),
      comment: comment || "",
      createdAt: new Date(),
    };

    const updatedReviews = [...(book.reviews || []), newReview];
    const totalRating = updatedReviews.reduce((sum, r) => sum + r.rating, 0);
    const averageRating = totalRating / updatedReviews.length;

    await db.collection("books").updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          reviews: updatedReviews,
          rating: {
            average: averageRating,
            count: updatedReviews.length
          },
          updatedAt: new Date()
        }
      }
    );

    return res.status(200).json({
      success: true,
      message: "Review added successfully",
    });
  } catch (error) {

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// delete review
export const deleteReview = async (req, res) => {
  try {
    const { id, reviewId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    const book = await db.collection("books").findOne({ 
      _id: new ObjectId(id) 
    });

    if (!book) {
      return res.status(404).json({
        success: false,
        message: "Book not found",
      });
    }

    const review = book.reviews?.find(r => r.id.toString() === reviewId);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Review not found",
      });
    }

    if (review.userId !== userId && userRole !== "admin") {
      return res.status(403).json({
        success: false,
        message: "You can only delete your own reviews",
      });
    }

    const updatedReviews = book.reviews.filter(r => r.id.toString() !== reviewId);
    const totalRating = updatedReviews.reduce((sum, r) => sum + r.rating, 0);
    const averageRating = updatedReviews.length > 0 ? totalRating / updatedReviews.length : 0;

    await db.collection("books").updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          reviews: updatedReviews,
          rating: {
            average: averageRating,
            count: updatedReviews.length
          },
          updatedAt: new Date()
        }
      }
    );

    return res.status(200).json({
      success: true,
      message: "Review deleted successfully",
    });
  } catch (error) {

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// delete gallery image
export const deleteGalleryImage = async (req, res) => {
  try {
    const { id, imageId } = req.params;

    const book = await db.collection("books").findOne({ 
      _id: new ObjectId(id) 
    });

    if (!book) {
      return res.status(404).json({
        success: false,
        message: "Book not found",
      });
    }

    const imageToDelete = book.images?.find(img => img.publicId === imageId);
    if (imageToDelete) {
      try {
        await deleteFromCloudinary(imageToDelete.publicId, 'image');
      } catch (err) {
        console.error("Image deletion error:", err);
      }
    }

    const updatedImages = book.images?.filter(img => img.publicId !== imageId) || [];

    await db.collection("books").updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          images: updatedImages,
          updatedAt: new Date()
        }
      }
    );

    return res.status(200).json({
      success: true,
      message: "Image deleted successfully",
    });
  } catch (error) {

    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};