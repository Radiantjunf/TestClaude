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

// Language translations
const translations = {
  en: {
    systemPrompt: "You are a helpful assistant for managing employee holidays.",
    availableUsers: "Available users:",
    currentDate: "Current date:",
    userMessage: "User message:",
    holidayMarked: "Holiday has been marked successfully",
    noHolidaysFound: "No holidays found",
    holidayUpdated: "Holiday status updated successfully",
    holidayDeleted: "Holiday deleted successfully",
    invalidUser: "Invalid user ID",
    invalidDate: "Invalid date format",
    serverRunning: "Holiday Chatbot server running on",
    setApiKey: "Make sure to set your CLAUDE_API_KEY in the .env file"
  },
  pt: {
    systemPrompt: "És um assistente útil para gerir as férias dos funcionários.",
    availableUsers: "Utilizadores disponíveis:",
    currentDate: "Data atual:",
    userMessage: "Mensagem do utilizador:",
    holidayMarked: "Férias marcadas com sucesso",
    noHolidaysFound: "Nenhumas férias encontradas",
    holidayUpdated: "Estado das férias atualizado com sucesso",
    holidayDeleted: "Férias eliminadas com sucesso",
    invalidUser: "ID de utilizador inválido",
    invalidDate: "Formato de data inválido",
    serverRunning: "Servidor do Chatbot de Férias a funcionar em",
    setApiKey: "Certifica-te de definir a tua CLAUDE_API_KEY no ficheiro .env"
  }
};

// In-memory database
const holidayDatabase = {
  users: {
    user1: { name: "João Silva", department: "Engenharia" },
    user2: { name: "Maria Santos", department: "Marketing" },
    user3: { name: "Pedro Costa", department: "Vendas" },
  },
  holidays: [],
  nextId: 1,
};

// Database functions
const dbFunctions = {
  markHoliday: (userId, startDate, endDate, reason = "Férias") => {
    const holiday = {
      id: holidayDatabase.nextId++,
      userId: userId,
      startDate: startDate,
      endDate: endDate,
      reason: reason,
      status: "pendente",
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
      userName: holidayDatabase.users[h.userId]?.name || "Utilizador Desconhecido",
    }));
  },

  getHolidaysByDateRange: (startDate, endDate) => {
    return holidayDatabase.holidays
      .filter((h) => {
        return h.startDate <= endDate && h.endDate >= startDate;
      })
      .map((h) => ({
        ...h,
        userName: holidayDatabase.users[h.userId]?.name || "Utilizador Desconhecido",
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

// Claude function definitions (language-agnostic)
const tools = [
  {
    name: "mark_holiday",
    description: "Mark holidays for a user / Marcar férias para um utilizador",
    input_schema: {
      type: "object",
      properties: {
        userId: {
          type: "string",
          description: "The user ID (e.g., user1, user2) / ID do utilizador",
        },
        startDate: {
          type: "string",
          description: "Start date in YYYY-MM-DD format / Data de início no formato YYYY-MM-DD",
        },
        endDate: {
          type: "string",
          description: "End date in YYYY-MM-DD format / Data de fim no formato YYYY-MM-DD",
        },
        reason: {
          type: "string",
          description: "Reason for holiday (optional) / Motivo das férias (opcional)",
        },
      },
      required: ["userId", "startDate", "endDate"],
    },
  },
  {
    name: "get_user_holidays",
    description: "Get all holidays for a specific user / Obter todas as férias de um utilizador específico",
    input_schema: {
      type: "object",
      properties: {
        userId: {
          type: "string",
          description: "The user ID / ID do utilizador",
        },
      },
      required: ["userId"],
    },
  },
  {
    name: "get_all_holidays",
    description: "Get all holidays for all users / Obter todas as férias de todos os utilizadores",
    input_schema: {
      type: "object",
      properties: {},
      required: [],
    },
  },
  {
    name: "get_holidays_by_date",
    description: "Get holidays within a specific date range / Obter férias num intervalo de datas específico",
    input_schema: {
      type: "object",
      properties: {
        startDate: {
          type: "string",
          description: "Start date in YYYY-MM-DD format / Data de início no formato YYYY-MM-DD",
        },
        endDate: {
          type: "string",
          description: "End date in YYYY-MM-DD format / Data de fim no formato YYYY-MM-DD",
        },
      },
      required: ["startDate", "endDate"],
    },
  },
  {
    name: "update_holiday_status",
    description: "Update the status of a holiday / Atualizar o estado das férias",
    input_schema: {
      type: "object",
      properties: {
        holidayId: {
          type: "number",
          description: "The holiday ID / ID das férias",
        },
        status: {
          type: "string",
          description: "New status (approved/aprovado, rejected/rejeitado, pending/pendente)",
        },
      },
      required: ["holidayId", "status"],
    },
  },
];

// Language detection function
function detectLanguage(message) {
  const portugueseKeywords = [
    'férias', 'marcar', 'ver', 'consultar', 'aprovar', 'rejeitar', 'eliminar',
    'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro',
    'dia', 'semana', 'mês', 'ano', 'hoje', 'amanhã', 'ontem',
    'bom', 'boa', 'olá', 'obrigado', 'obrigada', 'por favor'
  ];
  
  const lowerMessage = message.toLowerCase();
  const portugueseMatches = portugueseKeywords.filter(keyword => 
    lowerMessage.includes(keyword)
  ).length;
  
  return portugueseMatches > 0 ? 'pt' : 'en';
}

// Chat endpoint
app.post("/api/chat", async (req, res) => {
  try {
    const { message, language } = req.body;

    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }

    // Detect language if not provided
    const lang = language || detectLanguage(message);
    const t = translations[lang] || translations.en;

    const systemPrompt = `${t.systemPrompt}
    
${t.availableUsers} ${Object.entries(holidayDatabase.users)
      .map(([id, user]) => `${id} (${user.name})`)
      .join(", ")}

${t.currentDate} ${new Date().toISOString().split("T")[0]}

${lang === 'pt' ? 
  'Responde sempre em português. Use os nomes portugueses para os estados: "pendente", "aprovado", "rejeitado".' :
  'Always respond in English. Use English status names: "pending", "approved", "rejected".'
}

${t.userMessage} ${message}`;

    const response = await anthropic.messages.create({
      model: "claude-3-5-sonnet-20241022",
      max_tokens: 1000,
      tools: tools,
      messages: [
        {
          role: "user",
          content: systemPrompt,
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
              // Translate default reason based on language
              const defaultReason = lang === 'pt' ? 'Férias' : 'Holiday';
              result = dbFunctions.markHoliday(
                input.userId,
                input.startDate,
                input.endDate,
                input.reason || defaultReason
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
              // Translate status if needed
              let status = input.status;
              if (lang === 'pt') {
                const statusTranslations = {
                  'approved': 'aprovado',
                  'rejected': 'rejeitado',
                  'pending': 'pendente'
                };
                status = statusTranslations[status] || status;
              }
              result = dbFunctions.updateHolidayStatus(
                input.holidayId,
                status
              );
              break;

            default:
              result = { error: lang === 'pt' ? 'Função desconhecida' : 'Unknown function' };
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
                text: systemPrompt,
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
      language: lang,
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
      userName: holidayDatabase.users[h.userId]?.name || "Utilizador Desconhecido",
    })),
    users: holidayDatabase.users,
  });
});

// Language endpoint
app.get("/api/languages", (req, res) => {
  res.json({
    supported: ["en", "pt"],
    translations: translations
  });
});

// Start server
app.listen(port, () => {
  console.log(`${translations.pt.serverRunning} http://localhost:${port}`);
  console.log(translations.pt.setApiKey);
});