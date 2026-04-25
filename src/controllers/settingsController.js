import { db } from "../database/db.js";
import { ObjectId } from "mongodb";
import { deleteFromCloudinary } from "../middleware/upload.js";

// get site settings
export const getSettings = async (req, res) => {
  try {
    let settings = await db.collection("settings").findOne({ type: "site_settings" });
    
    if (!settings) {
      const defaultSettings = {
        type: "site_settings",
        siteTitle: "BookShelf",
        siteDescription: "Discover and read thousands of books online. Your ultimate digital library for reading, reviewing, and sharing books.",
        siteKeywords: "books, reading, ebook, library, book review, online reading",
        siteAuthor: "BookShelf Team",
        favicon: null,
        faviconPublicId: null,
        logo: null,
        logoPublicId: null,
        ogImage: null,
        ogImagePublicId: null,
        footerText: "© 2024 BookShelf. All rights reserved.",
        contactEmail: "info@bookshelf.com",
        contactPhone: "+1 (234) 567-8900",
        contactAddress: "123 Book Street, Reading City, RC 12345",
        socialLinks: {
          facebook: "",
          twitter: "",
          instagram: "",
          linkedin: "",
          github: ""
        },
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const result = await db.collection("settings").insertOne(defaultSettings);
      settings = { ...defaultSettings, _id: result.insertedId };
    }
    
    // ✅ socialLinks কে JSON এ কনভার্ট করা (যদি স্ট্রিং হয়)
    if (settings.socialLinks && typeof settings.socialLinks === 'string') {
      try {
        settings.socialLinks = JSON.parse(settings.socialLinks);
      } catch (e) {
        console.error("Failed to parse socialLinks:", e);
        settings.socialLinks = {
          facebook: "",
          twitter: "",
          instagram: "",
          linkedin: "",
          github: ""
        };
      }
    }
    
    return res.status(200).json({
      success: true,
      message: "Settings fetched successfully",
      data: settings
    });
  } catch (error) {
    console.error("Get settings error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};

// update site settings
export const updateSettings = async (req, res) => {
  try {
    console.log("📝 Updating settings...");
    
    const {
      siteTitle,
      siteDescription,
      siteKeywords,
      siteAuthor,
      footerText,
      contactEmail,
      contactPhone,
      contactAddress,
      socialLinks
    } = req.body;

    let updateFields = {
      updatedAt: new Date()
    };

    if (siteTitle !== undefined && siteTitle !== "") updateFields.siteTitle = siteTitle;
    if (siteDescription !== undefined) updateFields.siteDescription = siteDescription;
    if (siteKeywords !== undefined) updateFields.siteKeywords = siteKeywords;
    if (siteAuthor !== undefined) updateFields.siteAuthor = siteAuthor;
    if (footerText !== undefined) updateFields.footerText = footerText;
    if (contactEmail !== undefined) updateFields.contactEmail = contactEmail;
    if (contactPhone !== undefined) updateFields.contactPhone = contactPhone;
    if (contactAddress !== undefined) updateFields.contactAddress = contactAddress;
    
    // ✅ সোশ্যাল লিংক সঠিকভাবে প্রসেস করা
    if (socialLinks !== undefined) {
      let parsedSocialLinks = socialLinks;
      
      // যদি স্ট্রিং হয়, তাহলে JSON parse করুন
      if (typeof socialLinks === 'string') {
        try {
          parsedSocialLinks = JSON.parse(socialLinks);
        } catch (e) {
          console.error("Failed to parse socialLinks string:", e);
          parsedSocialLinks = socialLinks;
        }
      }
      
      // যদি অবজেক্ট হয়, তাহলে সরাসরি ব্যবহার করুন
      if (typeof parsedSocialLinks === 'object' && parsedSocialLinks !== null) {
        updateFields.socialLinks = {
          facebook: parsedSocialLinks.facebook || "",
          twitter: parsedSocialLinks.twitter || "",
          instagram: parsedSocialLinks.instagram || "",
          linkedin: parsedSocialLinks.linkedin || "",
          github: parsedSocialLinks.github || ""
        };
      } else {
        updateFields.socialLinks = {
          facebook: "",
          twitter: "",
          instagram: "",
          linkedin: "",
          github: ""
        };
      }
    }

    // বিদ্যমান সেটিংস পাওয়া
    const existingSettings = await db.collection("settings").findOne({ type: "site_settings" });

    // Favicon আপডেট
    if (req.files && req.files.favicon && req.files.favicon.length > 0) {
      const faviconFile = req.files.favicon[0];
      if (existingSettings?.faviconPublicId) {
        try {
          await deleteFromCloudinary(existingSettings.faviconPublicId, 'image');
        } catch (err) {
          console.error("Old favicon deletion error:", err);
        }
      }
      updateFields.favicon = faviconFile.path;
      updateFields.faviconPublicId = faviconFile.filename;
    }

    // লোগো আপডেট
    if (req.files && req.files.logo && req.files.logo.length > 0) {
      const logoFile = req.files.logo[0];
      if (existingSettings?.logoPublicId) {
        try {
          await deleteFromCloudinary(existingSettings.logoPublicId, 'image');
        } catch (err) {
          console.error("Old logo deletion error:", err);
        }
      }
      updateFields.logo = logoFile.path;
      updateFields.logoPublicId = logoFile.filename;
    }

    // OG ইমেজ আপডেট
    if (req.files && req.files.ogImage && req.files.ogImage.length > 0) {
      const ogImageFile = req.files.ogImage[0];
      if (existingSettings?.ogImagePublicId) {
        try {
          await deleteFromCloudinary(existingSettings.ogImagePublicId, 'image');
        } catch (err) {
          console.error("Old OG image deletion error:", err);
        }
      }
      updateFields.ogImage = ogImageFile.path;
      updateFields.ogImagePublicId = ogImageFile.filename;
    }

    // ডাটাবেস আপডেট করা
    const result = await db.collection("settings").updateOne(
      { type: "site_settings" },
      { $set: updateFields },
      { upsert: true }
    );

    // আপডেটেড সেটিংস ফেরত দেওয়া
    const updatedSettings = await db.collection("settings").findOne({ type: "site_settings" });
    
    // ✅ রিটার্ন করার সময় socialLinks কে অবজেক্ট আকারে পাঠানো
    if (updatedSettings.socialLinks && typeof updatedSettings.socialLinks === 'string') {
      try {
        updatedSettings.socialLinks = JSON.parse(updatedSettings.socialLinks);
      } catch (e) {
        updatedSettings.socialLinks = {
          facebook: "",
          twitter: "",
          instagram: "",
          linkedin: "",
          github: ""
        };
      }
    }

    return res.status(200).json({
      success: true,
      message: "Settings updated successfully",
      data: updatedSettings
    });
  } catch (error) {
    console.error("Update settings error:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Internal server error"
    });
  }
};

// reset settings to default
export const resetSettings = async (req, res) => {
  try {
    const defaultSettings = {
      type: "site_settings",
      siteTitle: "BookShelf",
      siteDescription: "Discover and read thousands of books online. Your ultimate digital library for reading, reviewing, and sharing books.",
      siteKeywords: "books, reading, ebook, library, book review, online reading",
      siteAuthor: "BookShelf Team",
      favicon: null,
      faviconPublicId: null,
      logo: null,
      logoPublicId: null,
      ogImage: null,
      ogImagePublicId: null,
      footerText: "© 2024 BookShelf. All rights reserved.",
      contactEmail: "info@bookshelf.com",
      contactPhone: "+1 (234) 567-8900",
      contactAddress: "123 Book Street, Reading City, RC 12345",
      socialLinks: {
        facebook: "",
        twitter: "",
        instagram: "",
        linkedin: "",
        github: ""
      },
      updatedAt: new Date()
    };

    const existingSettings = await db.collection("settings").findOne({ type: "site_settings" });
    if (existingSettings) {
      if (existingSettings.faviconPublicId) {
        try { await deleteFromCloudinary(existingSettings.faviconPublicId, 'image'); } catch (err) {}
      }
      if (existingSettings.logoPublicId) {
        try { await deleteFromCloudinary(existingSettings.logoPublicId, 'image'); } catch (err) {}
      }
      if (existingSettings.ogImagePublicId) {
        try { await deleteFromCloudinary(existingSettings.ogImagePublicId, 'image'); } catch (err) {}
      }
    }

    await db.collection("settings").updateOne(
      { type: "site_settings" },
      { $set: defaultSettings },
      { upsert: true }
    );

    const updatedSettings = await db.collection("settings").findOne({ type: "site_settings" });

    return res.status(200).json({
      success: true,
      message: "Settings reset to default successfully",
      data: updatedSettings
    });
  } catch (error) {
    console.error("Reset settings error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error"
    });
  }
};