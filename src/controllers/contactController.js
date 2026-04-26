import { db } from "../database/db.js";
import { ObjectId } from "mongodb";
import nodemailer from "nodemailer";

export const submitContact = async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: "All fields are required",
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email address",
      });
    }

    const newMessage = {
      name,
      email,
      subject,
      message,
      status: "unread",
      ipAddress:
        req.ip ||
        req.headers["x-forwarded-for"] ||
        req.connection.remoteAddress,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const result = await db.collection("contacts").insertOne(newMessage);

    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: parseInt(process.env.SMTP_PORT) || 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const adminMailOptions = {
      from: process.env.SMTP_USER || "noreply@bookshelf.com",
      to: process.env.ADMIN_EMAIL || "admin@bookshelf.com",
      subject: `New Contact Message: ${subject}`,
      html: `
        <h2>New Contact Message</h2>
        <p><strong>Name:</strong> ${name}</p>
        <p><strong>Email:</strong> ${email}</p>
        <p><strong>Subject:</strong> ${subject}</p>
        <p><strong>Message:</strong></p>
        <p>${message.replace(/\n/g, "<br>")}</p>
        <hr>
        <p>Sent from BookShelf Contact Form</p>
      `,
    };

    const userMailOptions = {
      from: process.env.SMTP_USER || "noreply@bookshelf.com",
      to: email,
      subject: "We've received your message - BookShelf",
      html: `
        <h2>Dear ${name},</h2>
        <p>Thank you for contacting BookShelf. We have received your message and will get back to you within 24-48 hours.</p>
        <p><strong>Your Message:</strong></p>
        <p>${message.replace(/\n/g, "<br>")}</p>
        <br>
        <p>Best regards,</p>
        <p><strong>BookShelf Team</strong></p>
      `,
    };

    if (process.env.SMTP_USER && process.env.SMTP_PASS) {
      try {
        await transporter.sendMail(adminMailOptions);
        await transporter.sendMail(userMailOptions);
      } catch (emailError) {
        console.error("Email sending error:", emailError);

      }
    }

    return res.status(201).json({
      success: true,
      message:
        "Your message has been sent successfully. We'll get back to you soon!",
      data: {
        id: result.insertedId,
      },
    });
  } catch (error) {
    console.error("Contact submission error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error. Please try again later.",
    });
  }
};


export const getAllContacts = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const skip = (page - 1) * limit;
    const status = req.query.status || "";

    let searchCondition = {};
    if (status && status !== "all") {
      searchCondition.status = status;
    }

    const total = await db
      .collection("contacts")
      .countDocuments(searchCondition);

    const messages = await db
      .collection("contacts")
      .find(searchCondition)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .toArray();

    return res.status(200).json({
      success: true,
      message: "Contacts fetched successfully",
      data: messages,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalItems: total,
        itemsPerPage: limit,
      },
    });
  } catch (error) {
    console.error("Get contacts error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};


export const getContactById = async (req, res) => {
  try {
    const { id } = req.params;

    const message = await db.collection("contacts").findOne({
      _id: new ObjectId(id),
    });

    if (!message) {
      return res.status(404).json({
        success: false,
        message: "Message not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Contact fetched successfully",
      data: message,
    });
  } catch (error) {
    console.error("Get contact by id error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};


export const updateContactStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !["read", "unread", "replied"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Must be 'read', 'unread', or 'replied'",
      });
    }

    const result = await db.collection("contacts").updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          status: status,
          updatedAt: new Date(),
        },
      },
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Message not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Contact status updated successfully",
    });
  } catch (error) {
    console.error("Update contact status error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};


export const deleteContact = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await db.collection("contacts").deleteOne({
      _id: new ObjectId(id),
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        success: false,
        message: "Message not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Contact deleted successfully",
    });
  } catch (error) {
    console.error("Delete contact error:", error);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
    });
  }
};
