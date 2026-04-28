import Groq from "groq-sdk";
import { db } from "../database/db.js";
import { ObjectId } from "mongodb";
import dotenv from "dotenv";

dotenv.config();

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

// Helper: Get all books from system (for recommendations)
const getAllSystemBooks = async () => {
  try {
    const books = await db
      .collection("books")
      .find({ status: "active" })
      .limit(500)
      .toArray();
    return books;
  } catch (error) {
    console.error("Error fetching system books:", error);
    return [];
  }
};

// Helper: Get user's books
const getUserBooksData = async (userId) => {
  try {
    const books = await db
      .collection("books")
      .find({ createdBy: new ObjectId(userId), status: "active" })
      .sort({ createdAt: -1 })
      .limit(100)
      .toArray();
    return books;
  } catch (error) {
    console.error("Error fetching user books:", error);
    return [];
  }
};

// Helper: Get all categories
const getAllCategoriesData = async () => {
  try {
    const categories = await db.collection("categories").find({}).toArray();
    return categories;
  } catch (error) {
    console.error("Error fetching categories:", error);
    return [];
  }
};

// Helper: Get single book by ID
const getBookById = async (bookId) => {
  try {
    const book = await db.collection("books").findOne({
      _id: new ObjectId(bookId),
      status: "active",
    });
    return book;
  } catch (error) {
    return null;
  }
};

// Helper: Search books by keyword
const searchBooksByKeyword = async (keyword, limit = 10) => {
  try {
    const books = await db
      .collection("books")
      .find({
        status: "active",
        $or: [
          { title: { $regex: keyword, $options: "i" } },
          { authorName: { $regex: keyword, $options: "i" } },
          { "category.name": { $regex: keyword, $options: "i" } },
          { description: { $regex: keyword, $options: "i" } },
        ],
      })
      .limit(limit)
      .toArray();

    // Return books with string ID
    return books.map((book) => ({
      ...book,
      _id: book._id.toString(), // Ensure ID is string
      id: book._id.toString(), // Add both for compatibility
    }));
  } catch (error) {
    console.error("Error searching books:", error);
    return [];
  }
};

// Helper: Save chat history to database
const saveChatMessage = async (userId, role, content, metadata = {}) => {
  try {
    await db.collection("chat_history").insertOne({
      userId: new ObjectId(userId),
      role,
      content,
      metadata,
      createdAt: new Date(),
    });
  } catch (error) {
    console.error("Error saving chat message:", error);
  }
};

// Helper: Get user's chat history for context
const getUserChatHistory = async (userId, limit = 10) => {
  try {
    const history = await db
      .collection("chat_history")
      .find({ userId: new ObjectId(userId) })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();
    return history.reverse();
  } catch (error) {
    console.error("Error fetching chat history:", error);
    return [];
  }
};

// Helper: Generate book suggestions with links
const generateBookSuggestions = async (books, queryType = "general") => {
  if (!books || books.length === 0) return "";

  const baseUrl = process.env.FRONTEND_URL;
  let suggestions = "\n\n📚 Here are some books you might like:\n\n";

  books.slice(0, 5).forEach((book, index) => {
    suggestions += `${index + 1}. **${book.title}** by ${book.authorName || "Unknown"}\n`;
    suggestions += `   📖 Category: ${book.category?.name || "General"}\n`;
    if (book.rating?.average > 0) {
      suggestions += `   ⭐ Rating: ${book.rating.average}/5 (${book.rating.count} reviews)\n`;
    }
    suggestions += `   💰 Price: $${book.discountPrice || book.price}\n`;
    suggestions += `   🔗 [View Details](${baseUrl}/books/${book._id})\n\n`;
  });

  return suggestions;
};

// Main chat endpoint
export const chatWithAI = async (req, res) => {
  try {
    const { message, userId } = req.body;

    if (!message) {
      return res.status(400).json({
        success: false,
        error: "Message is required",
      });
    }

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "User ID is required",
      });
    }

    // Save user message
    await saveChatMessage(userId, "user", message, { timestamp: new Date() });

    // Get user's books and chat history
    const userBooks = await getUserBooksData(userId);
    const allBooks = await getAllSystemBooks();
    const categories = await getAllCategoriesData();
    const chatHistory = await getUserChatHistory(userId, 5);

    // Detect if user is asking for book search/recommendation
    const searchKeywords = [
      "find",
      "search",
      "look for",
      "suggest",
      "recommend",
      "fiction",
      "non-fiction",
      "self-help",
      "fantasy",
      "adventure",
    ];
    const isAskingForBooks = searchKeywords.some((keyword) =>
      message.toLowerCase().includes(keyword),
    );

    let bookSearchResults = [];
    let bookSuggestionsText = "";

    // If user is asking for book recommendations, search the database
    if (isAskingForBooks) {
      // Extract category or genre from message
      const categoriesList = categories.map((c) => c.name.toLowerCase());
      const mentionedCategory = categoriesList.find((cat) =>
        message.toLowerCase().includes(cat),
      );

      if (mentionedCategory) {
        bookSearchResults = await searchBooksByKeyword(mentionedCategory, 5);
      } else {
        // Extract potential book title or author
        const words = message.split(" ");
        for (const word of words) {
          if (word.length > 3) {
            const results = await searchBooksByKeyword(word, 3);
            if (results.length > 0) {
              bookSearchResults = [...bookSearchResults, ...results];
              break;
            }
          }
        }
      }

      // If no specific search, get random popular books
      if (bookSearchResults.length === 0) {
        bookSearchResults = allBooks.slice(0, 5);
      }

      bookSuggestionsText = await generateBookSuggestions(
        bookSearchResults,
        "search",
      );
    }

    const systemPrompt = `You are "BookShelf AI", a professional and helpful assistant for a book management platform.

ABOUT THE USER:
- User ID: ${userId}
- Books in their collection: ${userBooks.length}
- Favorite categories: ${[...new Set(userBooks.map((b) => b.category?.name).filter(Boolean))].join(", ") || "None yet"}

RECENT CONVERSATION:
${chatHistory.map((h) => `${h.role === "user" ? "User" : "Assistant"}: ${h.content}`).join("\n")}

AVAILABLE SYSTEM DATA:
- Total books in system: ${allBooks.length}
- Available categories: ${categories.map((c) => c.name).join(", ")}

YOUR CAPABILITIES:
1. Recommend books from the system database (not just user's collection)
2. Search for books by title, author, category, or genre
3. Answer questions about any book in the system
4. Help users discover new books based on their interests
5. Provide reading suggestions and insights
6. Handle both English and Bengali language queries naturally

${bookSearchResults.length > 0 ? `BOOK SEARCH RESULTS (from our database):\n${bookSearchResults.map((b) => `- "${b.title}" by ${b.authorName} [${b.category?.name}]`).join("\n")}\n` : ""}

RULES:
- ALWAYS provide book links in your responses when recommending books
- Use Markdown format for links: [Book Title](https://client-bookshelf.vercel.app/books/{bookId})
- Be professional, friendly, and helpful
- If user speaks Bengali, respond in Bengali
- If user speaks English, respond in English
- Don't make up books that don't exist
- If a book isn't found, suggest similar alternatives
- Provide personalized recommendations based on user's reading history
- Encourage users to explore new genres and categories

Now respond to the user's message naturally and helpfully. If books were found, they will be shown as clickable suggestion cards — do NOT write any markdown links or URLs in your response.`;

    const completion = await groq.chat.completions.create({
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: message },
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.7,
      max_tokens: 1500,
    });

    let aiResponse =
      completion.choices[0]?.message?.content ||
      "Sorry, I could not generate a response.";

    // Add book suggestions if found and not already in response
    if (
      bookSearchResults.length > 0 &&
      !aiResponse.includes(`${process.env.FRONTEND_URL}/books`)
    ) {
      aiResponse += bookSuggestionsText;
    }

    // Save assistant message
    await saveChatMessage(userId, "assistant", aiResponse, {
      timestamp: new Date(),
      suggestions: bookSearchResults.length,
    });

    res.status(200).json({
      success: true,
      response: aiResponse,
      suggestions:
        bookSearchResults.length > 0 ? bookSearchResults.slice(0, 5) : [],
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Groq API Error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to process your request",
      details: error.message,
    });
  }
};

// Get book recommendations based on user's reading history
export const getBookRecommendations = async (req, res) => {
  try {
    const { userId, bookId, limit = 5 } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "User ID is required",
      });
    }

    const userBooks = await getUserBooksData(userId);
    const allBooks = await getAllSystemBooks();

    // Filter out books user already has
    const userBookIds = new Set(userBooks.map((b) => b._id.toString()));
    const availableBooks = allBooks.filter(
      (b) => !userBookIds.has(b._id.toString()),
    );

    let currentBook = null;
    let recommendations = [];

    if (bookId) {
      currentBook = await getBookById(bookId);
    }

    // If user has books, recommend based on their preferences
    if (userBooks.length > 0 && !currentBook) {
      // Get user's favorite categories
      const categoryPreference = {};
      userBooks.forEach((book) => {
        const cat = book.category?.name;
        if (cat) categoryPreference[cat] = (categoryPreference[cat] || 0) + 1;
      });

      const favoriteCategories = Object.entries(categoryPreference)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([cat]) => cat);

      // Find books in favorite categories
      favoriteCategories.forEach((cat) => {
        const catBooks = availableBooks.filter((b) => b.category?.name === cat);
        recommendations.push(...catBooks);
      });
    }

    // If we have a specific book, find similar ones
    if (currentBook && recommendations.length < limit) {
      const similarBooks = availableBooks.filter(
        (b) =>
          b.category?.name === currentBook.category?.name ||
          b.authorName === currentBook.authorName,
      );
      recommendations.push(...similarBooks);
    }

    // Remove duplicates and limit
    recommendations = [
      ...new Map(recommendations.map((b) => [b._id.toString(), b])).values(),
    ].slice(0, limit);

    // If still not enough, add popular books
    if (recommendations.length < limit) {
      const popularBooks = availableBooks
        .sort((a, b) => (b.rating?.count || 0) - (a.rating?.count || 0))
        .slice(0, limit - recommendations.length);
      recommendations.push(...popularBooks);
    }

    const formattedRecommendations = recommendations.map((book) => ({
      id: book._id,
      title: book.title,
      author: book.authorName,
      category: book.category?.name,
      price: book.discountPrice || book.price,
      rating: book.rating?.average,
      thumbnail: book.thumbnail,
      link: `${process.env.FRONTEND_URL}/books/${book._id}`,
      reason: `Based on your interest in ${book.category?.name || "books"}`,
    }));

    res.status(200).json({
      success: true,
      recommendations: formattedRecommendations,
      totalAvailable: availableBooks.length,
      userPreferences: {
        totalBooks: userBooks.length,
        favoriteCategories: [
          ...new Set(userBooks.map((b) => b.category?.name).filter(Boolean)),
        ],
        readingDiversity:
          recommendations.length > 0 ? "Good" : "Explore more genres",
      },
    });
  } catch (error) {
    console.error("Recommendation error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get recommendations",
    });
  }
};

// Smart book search using natural language
export const smartBookSearch = async (req, res) => {
  try {
    const { userId, query } = req.body;

    if (!userId || !query) {
      return res.status(400).json({
        success: false,
        error: "User ID and query are required",
      });
    }

    // Direct database search first
    const searchResults = await searchBooksByKeyword(query, 10);

    let aiEnhancedResults = searchResults;

    // Use AI for enhanced understanding if needed
    if (searchResults.length === 0) {
      const completion = await groq.chat.completions.create({
        messages: [
          {
            role: "system",
            content: `You are a book search assistant. Convert natural language queries into search keywords.
            Return ONLY the search keywords as a comma-separated string, no other text.`,
          },
          {
            role: "user",
            content: `What books should I search for based on: "${query}"`,
          },
        ],
        model: "llama-3.1-8b-instant",
        temperature: 0.3,
        max_tokens: 50,
      });

      const keywords = completion.choices[0]?.message?.content || query;
      const keywordSearch = await searchBooksByKeyword(keywords, 10);
      if (keywordSearch.length > 0) {
        aiEnhancedResults = keywordSearch;
      }
    }

    const formattedResults = aiEnhancedResults.map((book) => ({
      id: book._id,
      title: book.title,
      author: book.authorName,
      category: book.category?.name,
      price: book.discountPrice || book.price,
      rating: book.rating?.average,
      thumbnail: book.thumbnail,
      link: `${FRONTEND_URL}/books/${book._id}`,
      description: book.description?.substring(0, 150),
    }));

    res.status(200).json({
      success: true,
      query: query,
      results: formattedResults,
      totalFound: formattedResults.length,
      message:
        formattedResults.length > 0
          ? `Found ${formattedResults.length} books matching your search`
          : "No books found matching your search",
    });
  } catch (error) {
    console.error("Smart search error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to process search",
    });
  }
};

// Get reading insights and analytics
export const getReadingInsights = async (req, res) => {
  try {
    const { userId } = req.params;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: "User ID is required",
      });
    }

    const userBooks = await getUserBooksData(userId);
    const chatHistory = await getUserChatHistory(userId, 20);

    // Calculate statistics
    const categoryStats = {};
    const authorStats = {};
    const priceStats = { total: 0, avg: 0 };

    userBooks.forEach((book) => {
      const cat = book.category?.name || "Uncategorized";
      categoryStats[cat] = (categoryStats[cat] || 0) + 1;

      if (book.authorName) {
        authorStats[book.authorName] = (authorStats[book.authorName] || 0) + 1;
      }

      priceStats.total += book.discountPrice || book.price || 0;
    });

    priceStats.avg =
      userBooks.length > 0 ? priceStats.total / userBooks.length : 0;

    const topAuthors = Object.entries(authorStats)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const topCategories = Object.entries(categoryStats)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `You are a reading insights generator. Analyze the user's data and provide encouraging, personalized insights.
          
          USER STATISTICS:
          - Total books: ${userBooks.length}
          - Favorite categories: ${topCategories.map(([c]) => c).join(", ")}
          - Favorite authors: ${topAuthors.map(([a]) => a).join(", ")}
          - Average book price: $${priceStats.avg.toFixed(2)}
          
          Chat interaction count: ${chatHistory.length}
          
          Provide 3-4 insights about their reading habits, suggest new genres they might enjoy, and encourage them to explore.`,
        },
        {
          role: "user",
          content: "What insights can you give me about my reading habits?",
        },
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.6,
      max_tokens: 500,
    });

    res.status(200).json({
      success: true,
      insights: completion.choices[0]?.message?.content,
      statistics: {
        totalBooks: userBooks.length,
        uniqueCategories: Object.keys(categoryStats).length,
        uniqueAuthors: Object.keys(authorStats).length,
        topCategories: topCategories.map(([name, count]) => ({ name, count })),
        topAuthors: topAuthors.map(([name, count]) => ({ name, count })),
        averagePrice: priceStats.avg,
        totalSpent: priceStats.total,
      },
      chatActivity: {
        totalInteractions: chatHistory.length,
        lastInteraction: chatHistory[chatHistory.length - 1]?.createdAt || null,
      },
    });
  } catch (error) {
    console.error("Insights error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to generate insights",
    });
  }
};

// Generate book summary
export const generateBookSummary = async (req, res) => {
  try {
    const { bookId } = req.params;

    const book = await getBookById(bookId);

    if (!book) {
      return res.status(404).json({
        success: false,
        error: "Book not found",
      });
    }

    let summary = "";

    if (book.description && book.description.length > 50) {
      summary = book.description;
    } else {
      const completion = await groq.chat.completions.create({
        messages: [
          {
            role: "system",
            content:
              "You are a literary expert. Create a concise, engaging summary of the book (100-150 words).",
          },
          {
            role: "user",
            content: `Write a brief summary for "${book.title}" by ${book.authorName || "Unknown author"}.`,
          },
        ],
        model: "llama-3.1-8b-instant",
        temperature: 0.5,
        max_tokens: 300,
      });
      summary =
        completion.choices[0]?.message?.content || "Summary not available";
    }

    res.status(200).json({
      success: true,
      bookId: book._id,
      title: book.title,
      author: book.authorName,
      summary: summary,
      category: book.category?.name,
      rating: book.rating?.average,
      link: `${process.env.FRONTEND_URL}/books/${book._id}`,
    });
  } catch (error) {
    console.error("Summary error:", error);
    res.status(500).json({
      success: false,
      error: "Failed to generate summary",
    });
  }
};
