import { db } from "../database/db.js";
import bcrypt from "bcrypt";
import generateToken from "../middleware/generateToken.js";
import { deleteFromCloudinary } from "../middleware/upload.js";
import { ObjectId } from "mongodb"; 

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

    // proper email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address",
      });
    }

    // password length verification and matching verification
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Passowrd must be at least 6 characters",
      });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "password do not match",
      });
    }

    // check with email if user exists
    const isExists = await db.collection("users").findOne({ email: email });

    if (isExists) {
      return res.status(409).json({
        success: false,
        message: "User already exists with this email",
      });
    }

    // make the password encrypt using bcrypt
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
    

    if (hardDelete) {

      if (user.profilePicturePublicId) {
        try {
          await deleteFromCloudinary(user.profilePicturePublicId, 'image');
        } catch (deleteError) {
          console.error("Profile picture deletion error:", deleteError);
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
        message: "User account permanently deleted",
      });
    }
    

    else {
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