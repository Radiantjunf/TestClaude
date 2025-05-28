const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { Anthropic } = require("@anthropic-ai/sdk");

const app = express();
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static("public"));

// Check if API key is loaded
if (!process.env.CLAUDE_API_KEY) {
  console.error("❌ CLAUDE_API_KEY not found in environment variables!");
  console.error("Please create a .env file with your Claude API key:");
  console.error("CLAUDE_API_KEY=your-api-key-here");
  process.exit(1);
}

// Initialize Claude
const anthropic = new Anthropic({
  apiKey: process.env.CLAUDE_API_KEY,
});

console.log("✅ Claude API key loaded successfully");

// In-memory database
const holidayDatabase = {
  users: {
    user1: { name: "John Doe", department: "Engineering" },
    user2: { name: "Jane Smith", department: "Marketing" },
    user3: { name: "Bob Johnson", department: "Sales" },
  },
  holidays: [],
  nextId: 1,
};

// Database functions
const dbFunctions = {
  markHoliday: (userId, startDate, endDate, reason = "Holiday") => {
    const holiday = {
      id: holidayDatabase.nextId++,
      userId: userId,
      startDate: startDate,
      endDate: endDate,
      reason: reason,
      status: "pending",
      createdAt: new Date().toISOString(),
    };

    holidayDatabase.holidays.push(holiday);
    return holiday;
  },

  getUserHolidays: (userId) => {
    return holidayDatabase.holidays.filter((h) => h.userId === userId);
  },

  getAllHolidays: () => {
    return holidayDatabase.holidays.map((h) => ({
      ...h,
      userName: holidayDatabase.users[h.userId]?.name || "Unknown User",
    }));
  },

  getHolidaysByDateRange: (startDate, endDate) => {
    return holidayDatabase.holidays
      .filter((h) => {
        return h.startDate <= endDate && h.endDate >= startDate;
      })
      .map((h) => ({
        ...h,
        userName: holidayDatabase.users[h.userId]?.name || "Unknown User",
      }));
  },

  updateHolidayStatus: (holidayId, status) => {
    const holiday = holidayDatabase.holidays.find((h) => h.id === holidayId);
    if (holiday) {
      holiday.status = status;
      return holiday;
    }
    return null;
  },

  deleteHoliday: (holidayId) => {
    const index = holidayDatabase.holidays.findIndex((h) => h.id === holidayId);
    if (index !== -1) {
      return holidayDatabase.holidays.splice(index, 1)[0];
    }
    return null;
  },
};

// Claude function definitions
const tools = [
  {
    name: "mark_holiday",
    description: "Mark holidays for a user",
    input_schema: {
      type: "object",
      properties: {
        userId: {
          type: "string",
          description: "The user ID (e.g., user1, user2)",
        },
        startDate: {
          type: "string",
          description: "Start date in YYYY-MM-DD format",
        },
        endDate: {
          type: "string",
          description: "End date in YYYY-MM-DD format",
        },
        reason: {
          type: "string",
          description: "Reason for holiday (optional)",
        },
      },
      required: ["userId", "startDate", "endDate"],
    },
  },
  {
    name: "get_user_holidays",
    description: "Get all holidays for a specific user",
    input_schema: {
      type: "object",
      properties: {
        userId: {
          type: "string",
          description: "The user ID",
        },
      },
      required: ["userId"],
    },
  },
  {
    name: "get_all_holidays",
    description: "Get all holidays for all users",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "get_holidays_by_date",
    description: "Get holidays within a specific date range",
    input_schema: {
      type: "object",
      properties: {
        startDate: {
          type: "string",
          description: "Start date in YYYY-MM-DD format",
        },
        endDate: {
          type: "string",
          description: "End date in YYYY-MM-DD format",
        },
      },
      required: ["startDate", "endDate"],
    },
  },
  {
    name: "update_holiday_status",
    description: "Update the status of a holiday (approve, reject, etc.)",
    input_schema: {
      type: "object",
      properties: {
        holidayId: {
          type: "number",
          description: "The holiday ID",
        },
        status: {
          type: "string",
          description: "New status (approved, rejected, pending)",
        },
      },
      required: ["holidayId", "status"],
    },
  },
];

// Chat endpoint
app.post("/api/chat", async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1000,
      tools: tools,
      messages: [
        {
          role: "user",
          content: `You are a helpful assistant for managing employee holidays. 
          
Available users: ${Object.entries(holidayDatabase.users)
            .map(([id, user]) => `${id} (${user.name})`)
            .join(", ")}

Current date: ${new Date().toISOString().split("T")[0]}

User message: ${message}`,
        },
      ],
    });

    let finalResponse = "";
    let toolResults = [];

    // Handle tool calls
    if (response.content.some((content) => content.type === "tool_use")) {
      for (const content of response.content) {
        if (content.type === "tool_use") {
          const { name, input } = content;
          let result;

          switch (name) {
            case "mark_holiday":
              result = dbFunctions.markHoliday(
                input.userId,
                input.startDate,
                input.endDate,
                input.reason
              );
              break;

            case "get_user_holidays":
              result = dbFunctions.getUserHolidays(input.userId);
              break;

            case "get_all_holidays":
              result = dbFunctions.getAllHolidays();
              break;

            case "get_holidays_by_date":
              result = dbFunctions.getHolidaysByDateRange(
                input.startDate,
                input.endDate
              );
              break;

            case "update_holiday_status":
              result = dbFunctions.updateHolidayStatus(
                input.holidayId,
                input.status
              );
              break;

            default:
              result = { error: "Unknown function" };
          }

          toolResults.push({
            tool_use_id: content.id,
            content: JSON.stringify(result),
          });
        }
      }

      // Get Claude's final response after tool execution
      const followUp = await anthropic.messages.create({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 1000,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `You are a helpful assistant for managing employee holidays. 

Available users: ${Object.entries(holidayDatabase.users)
                  .map(([id, user]) => `${id} (${user.name})`)
                  .join(", ")}

Current date: ${new Date().toISOString().split("T")[0]}

User message: ${message}`,
              },
            ],
          },
          {
            role: "assistant",
            content: response.content,
          },
          {
            role: "user",
            content: toolResults.map((result) => ({
              type: "tool_result",
              tool_use_id: result.tool_use_id,
              content: result.content,
            })),
          },
        ],
      });

      finalResponse = followUp.content[0].text;
    } else {
      finalResponse = response.content[0].text;
    }

    res.json({
      response: finalResponse,
      database: {
        holidays: holidayDatabase.holidays,
        users: holidayDatabase.users,
      },
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Get database state endpoint
app.get("/api/database", (req, res) => {
  res.json({
    holidays: holidayDatabase.holidays.map((h) => ({
      ...h,
      userName: holidayDatabase.users[h.userId]?.name || "Unknown User",
    })),
    users: holidayDatabase.users,
  });
});

// Start server
app.listen(port, () => {
  console.log(`Holiday Chatbot server running on http://localhost:${port}`);
  console.log("Make sure to set your CLAUDE_API_KEY in the .env file");
});
