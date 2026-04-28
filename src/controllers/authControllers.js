import { db } from "../database/db.js";
import bcrypt from "bcrypt";
import generateToken from "../middleware/generateToken.js";
import { deleteFromCloudinary } from "../middleware/upload.js";
import { ObjectId } from "mongodb";
import admin from "firebase-admin";  // ✅ Firebase Admin import করতে হবে

// Firebase Admin SDK initialization
let firebaseAdminInitialized = false;

const initializeFirebaseAdmin = () => {
  if (!firebaseAdminInitialized) {
    try {
      if (!admin.apps.length) {
        // Check if we have the required environment variables
        if (process.env.FIREBASE_PROJECT_ID && 
            process.env.FIREBASE_CLIENT_EMAIL && 
            process.env.FIREBASE_PRIVATE_KEY) {
          
          admin.initializeApp({
            credential: admin.credential.cert({
              projectId: process.env.FIREBASE_PROJECT_ID,
              clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
              privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            }),
          });
          firebaseAdminInitialized = true;
          console.log("Firebase Admin initialized successfully");
        } else {
          console.log("Firebase Admin credentials not found, skipping initialization");
        }
      } else {
        firebaseAdminInitialized = true;
      }
    } catch (error) {
      console.error("Firebase Admin initialization error:", error);
    }
  }
};

// login user
export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "email required",
      });
    }

    if (!password) {
      return res.status(400).json({
        success: false,
        message: "password required",
      });
    }

    const user = await db.collection("users").findOne({ email: email });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "user not found - invalid password or email",
      });
    }

    const isPasswordMatch = await bcrypt.compare(password, user.password);

    if (!isPasswordMatch) {
      return res.status(401).json({
        success: false,
        message: "invalid password",
      });
    }

    const token = generateToken({
      id: user._id,
      email: user.email,
      role: user.role || "user",
    });

    return res.status(200).json({
      success: true,
      message: "Login successfull",
      token: token,
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        role: user.role || "user",
        profilePicture: user.profilePicture || null,
      },
    });
  } catch (error) {
    console.error("login error :", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// register user
export const register = async (req, res) => {
  try {
    const { fullName, email, password, confirmPassword } = req.body;
    if (!fullName || !email || !password || !confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "all fields are required",
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "password do not match",
      });
    }

    const isExists = await db.collection("users").findOne({ email: email });

    if (isExists) {
      return res.status(409).json({
        success: false,
        message: "User already exists with this email",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = {
      fullName: fullName,
      email: email.toLowerCase(),
      password: hashedPassword,
      role: "user",
      isActive: true,
      profilePicture: null,
      profilePicturePublicId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection("users").insertOne(newUser);

    const token = generateToken({
      id: result.insertedId,
      email: newUser.email,
      role: newUser.role,
    });

    return res.status(201).json({
      success: true,
      message: "User created successfully",
      token: token,
      user: {
        id: result.insertedId,
        fullName: newUser.fullName,
        email: newUser.email,
        role: newUser.role,
        isActive: newUser.isActive,
        profilePicture: newUser.profilePicture,
        createdAt: newUser.createdAt,
      },
    });
  } catch (error) {
    console.error("registration error : ", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getUser = async (req, res) => {
  try {
    const userId = req.user.id; 

    const user = await db.collection("users").findOne(
      { _id: new ObjectId(userId) },
      { projection: { password: 0 } } 
    );
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }
    
    return res.status(200).json({
      success: true,
      message: "User fetched successfully",
      user: user,
    });
    
  } catch (error) {
    console.error("Get user error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getAllUsers = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const search = req.query.search || "";

    let searchCondition = {};
    if (search) {
      searchCondition = {
        $or: [
          { fullName: { $regex: search, $options: "i" } },
          { email: { $regex: search, $options: "i" } }
        ]
      };
    }

    const total = await db.collection("users").countDocuments(searchCondition);

    const users = await db.collection("users")
      .find(searchCondition, { projection: { password: 0 } })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    return res.status(200).json({
      success: true,
      message: "Users fetched successfully",
      data: users,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: limit,
      },
    });
  } catch (error) {
    console.error("Get all users error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const getUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await db.collection("users").findOne(
      { _id: new ObjectId(id) },
      { projection: { password: 0 } }
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "User fetched successfully",
      data: user,
    });
  } catch (error) {
    console.error("Get user by id error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const updateUserById = async (req, res) => {
  try {
    const { id } = req.params;
    const { fullName, email, role, isActive } = req.body;

    const existingUser = await db.collection("users").findOne({ _id: new ObjectId(id) });
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const updateFields = {
      updatedAt: new Date(),
    };

    if (fullName) updateFields.fullName = fullName;
    if (email) updateFields.email = email.toLowerCase();
    if (role) updateFields.role = role;
    if (typeof isActive === "boolean") updateFields.isActive = isActive;

    if (email && email !== existingUser.email) {
      const emailExists = await db.collection("users").findOne({ 
        email: email.toLowerCase(),
        _id: { $ne: new ObjectId(id) }
      });
      if (emailExists) {
        return res.status(409).json({
          success: false,
          message: "Email already exists",
        });
      }
    }

    const result = await db.collection("users").updateOne(
      { _id: new ObjectId(id) },
      { $set: updateFields }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const updatedUser = await db.collection("users").findOne(
      { _id: new ObjectId(id) },
      { projection: { password: 0 } }
    );

    return res.status(200).json({
      success: true,
      message: "User updated successfully",
      data: updatedUser,
    });
  } catch (error) {
    console.error("Update user by id error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { role } = req.body;

    if (!role || !["user", "admin"].includes(role)) {
      return res.status(400).json({
        success: false,
        message: "Invalid role. Must be 'user' or 'admin'",
      });
    }

    const existingUser = await db.collection("users").findOne({ _id: new ObjectId(id) });
    if (!existingUser) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (existingUser.email === "moshiurrahmandeap@gmail.com" && role !== "admin") {
      return res.status(403).json({
        success: false,
        message: "Cannot change super admin role",
      });
    }

    const result = await db.collection("users").updateOne(
      { _id: new ObjectId(id) },
      { 
        $set: { 
          role: role,
          updatedAt: new Date()
        } 
      }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: `User role updated to ${role}`,
    });
  } catch (error) {
    console.error("Update user role error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};


export const deleteUserById = async (req, res) => {
  try {
    const { id } = req.params;

    const user = await db.collection("users").findOne({ _id: new ObjectId(id) });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }


    if (user.email === "moshiurrahmandeap@gmail.com") {
      return res.status(403).json({
        success: false,
        message: "Cannot delete super admin",
      });
    }


    if (user.profilePicturePublicId) {
      try {
        await deleteFromCloudinary(user.profilePicturePublicId, 'image');
      } catch (deleteError) {
        console.error("Profile picture deletion error:", deleteError);
      }
    }

  
    if (user.provider === "google" && user.googleId) {
      try {
        initializeFirebaseAdmin();
        if (admin.apps.length) {
          await admin.auth().deleteUser(user.googleId); 
          console.log(`Firebase user deleted: ${user.googleId}`);
        }
      } catch (firebaseError) {
        console.error("Firebase user deletion error:", firebaseError);
      }
    }


    const result = await db.collection("users").deleteOne({ _id: new ObjectId(id) });
    
    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "User deleted successfully" + (user.provider === "google" ? " from database and Firebase" : ""),
    });
  } catch (error) {
    console.error("Delete user by id error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const editUser = async (req, res) => {
  try {
    const userId = req.user.id; 
    const { fullName, currentPassword, newPassword, confirmNewPassword } = req.body;

    const user = await db.collection("users").findOne({ _id: new ObjectId(userId) });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    const updateFields = {
      updatedAt: new Date(),
    };

    if (fullName && fullName !== user.fullName) {
      updateFields.fullName = fullName;
    }

    if (newPassword) {
      if (!currentPassword) {
        return res.status(400).json({
          success: false,
          message: "Current password is required to change password",
        });
      }

      const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isPasswordValid) {
        return res.status(401).json({
          success: false,
          message: "Current password is incorrect",
        });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({
          success: false,
          message: "New password must be at least 6 characters",
        });
      }

      if (newPassword !== confirmNewPassword) {
        return res.status(400).json({
          success: false,
          message: "New password and confirm password do not match",
        });
      }

      const hashedPassword = await bcrypt.hash(newPassword, 10);
      updateFields.password = hashedPassword;
    }

    if (req.file) {
      if (user.profilePicturePublicId) {
        try {
          await deleteFromCloudinary(user.profilePicturePublicId, 'image');
        } catch (deleteError) {
          console.error("Old profile picture deletion error:", deleteError);
        }
      }

      updateFields.profilePicture = req.file.path;
      updateFields.profilePicturePublicId = req.file.filename;
    }

    const result = await db.collection("users").updateOne(
      { _id: new ObjectId(userId) },
      { $set: updateFields }
    );
    
    if (result.modifiedCount === 0 && !updateFields.profilePicture) {
      return res.status(400).json({
        success: false,
        message: "No changes were made to the profile",
      });
    }

    const updatedUser = await db.collection("users").findOne(
      { _id: new ObjectId(userId) },
      { projection: { password: 0 } }
    );
    
    return res.status(200).json({
      success: true,
      message: "User profile updated successfully",
      user: updatedUser,
    });
    
  } catch (error) {
    console.error("Edit user error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};


export const deleteUser = async (req, res) => {
  try {
    const userId = req.user.id; 
    const { password, hardDelete = false } = req.body;

    const user = await db.collection("users").findOne({ _id: new ObjectId(userId) });
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (hardDelete) {

      if (user.provider !== "google") {
        if (!password) {
          return res.status(400).json({
            success: false,
            message: "Password is required to delete account",
          });
        }
        
        const isPasswordValid = await bcrypt.compare(password, user.password);
        if (!isPasswordValid) {
          return res.status(401).json({
            success: false,
            message: "Incorrect password",
          });
        }
      }
      

      if (user.profilePicturePublicId) {
        try {
          await deleteFromCloudinary(user.profilePicturePublicId, 'image');
        } catch (deleteError) {
          console.error("Profile picture deletion error:", deleteError);
        }
      }


      if (user.provider === "google" && user.googleId) {
        try {
          initializeFirebaseAdmin();
          if (admin.apps.length) {
            await admin.auth().deleteUser(user.googleId);  
            console.log(`Firebase user deleted: ${user.googleId}`);
          }
        } catch (firebaseError) {
          console.error("Firebase user deletion error:", firebaseError);
        }
      }


      const result = await db.collection("users").deleteOne({ _id: new ObjectId(userId) });
      
      if (result.deletedCount === 0) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }
      
      return res.status(200).json({
        success: true,
        message: "User account permanently deleted" + (user.provider === "google" ? " from database and Firebase" : ""),
      });
    } else {

      await db.collection("users").updateOne(
        { _id: new ObjectId(userId) },
        { 
          $set: { 
            isActive: false,
            deletedAt: new Date(),
            updatedAt: new Date()
          } 
        }
      );
      
      return res.status(200).json({
        success: true,
        message: "User account deactivated successfully. You can reactivate by logging in.",
      });
    }
    
  } catch (error) {
    console.error("Delete user error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const logOut = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      message: "Logged out successfully. Please remove the token from client side.",
    });
  } catch (error) {
    console.error("Logout error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

export const reactivateUser = async (req, res) => {
  try {
    const userId = req.user.id;
    
    const result = await db.collection("users").updateOne(
      { _id: new ObjectId(userId) },
      { 
        $set: { 
          isActive: true,
          updatedAt: new Date()
        },
        $unset: { deletedAt: "" }
      }
    );
    
    if (result.modifiedCount === 0) {
      return res.status(400).json({
        success: false,
        message: "Account is already active or not found",
      });
    }
    
    return res.status(200).json({
      success: true,
      message: "Account reactivated successfully",
    });
  } catch (error) {
    console.error("Reactivate user error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};

// Google login
export const googleLogin = async (req, res) => {
  try {
    const { fullName, email, profilePicture, googleId } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required",
      });
    }


    let user = await db.collection("users").findOne({ email: email });

    if (!user) {

      const newUser = {
        fullName: fullName || email.split('@')[0],
        email: email.toLowerCase(),
        password: null,
        role: "user",
        isActive: true,
        profilePicture: profilePicture || null,
        profilePicturePublicId: null,
        googleId: googleId,
        provider: "google",
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const result = await db.collection("users").insertOne(newUser);
      user = { ...newUser, _id: result.insertedId };
    }


    const token = generateToken({
      id: user._id,
      email: user.email,
      role: user.role || "user",
    });

    return res.status(200).json({
      success: true,
      message: "Google login successful",
      token: token,
      user: {
        id: user._id,
        email: user.email,
        fullName: user.fullName,
        role: user.role || "user",
        profilePicture: user.profilePicture || null,
      },
    });
  } catch (error) {
    console.error("Google login error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};