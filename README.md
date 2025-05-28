# Holiday Chatbot 🏖️

A Node.js chatbot that uses Claude API to manage employee holidays through natural language conversations. The bot can parse user requests and interact with an in-memory database to track holiday requests.

## Features

- **Natural Language Processing**: Uses Claude API to understand user requests
- **In-Memory Database**: Fast, simple data storage for prototyping
- **Function Calling**: Claude directly interacts with database functions
- **Web Interface**: Clean, responsive chat interface
- **Real-time Updates**: See database changes in real-time

## Setup Instructions

### 1. Install Dependencies

```bash
npm install
```

### 2. Set up Environment Variables

Create a `.env` file in the root directory:

```bash
cp .env.example .env
```

Edit `.env` and add your Claude API key:

```
CLAUDE_API_KEY=your_claude_api_key_here
PORT=3000
```

### 3. Get Claude API Key

1. Visit [console.anthropic.com](https://console.anthropic.com)
2. Create an account or sign in
3. Navigate to API Keys section
4. Create a new API key
5. Copy the key to your `.env` file

### 4. Run the Application

```bash
# Development mode (with auto-reload)
npm run dev

# Production mode
npm start
```

### 5. Open in Browser

Navigate to `http://localhost:3000`

## Usage Examples

The chatbot understands natural language requests. Try these examples:

### Marking Holidays
- "Hello, user1 wants to mark day 20 and 21 of July as holiday"
- "user2 needs vacation from July 15 to July 18"
- "Mark August 1-3 as holiday for user3"

### Checking Holidays
- "Show me all holidays"
- "What holidays does user1 have?"
- "Who's on holiday in July?"
- "Show holidays between July 1 and July 31"

### Managing Holidays
- "Approve holiday #1"
- "Reject holiday #2"
- "Update holiday #3 status to approved"

## Project Structure

```
holiday-chatbot/
├── server.js           # Main server file with Claude integration
├── package.json        # Dependencies and scripts
├── .env.example        # Environment variables template
├── .env               # Your environment variables (create this)
├── public/
│   └── index.html     # Web interface
└── README.md          # This file
```

## Database Schema

### Users
```javascript
{
  'user1': { name: 'John Doe', department: 'Engineering' },
  'user2': { name: 'Jane Smith', department: 'Marketing' },
  'user3': { name: 'Bob Johnson', department: 'Sales' }
}
```

### Holidays
```javascript
{
  id: 1,
  userId: 'user1',
  startDate: '2024-07-20',
  endDate: '2024-07-21',
  reason: 'Holiday',
  status: 'pending',
  createdAt: '2024-07-15T10:30:00.000Z'
}
```

## API Endpoints

### POST /api/chat
Send a message to the chatbot
```javascript
{
  "message": "user1 wants holiday on July 20-21"
}
```

### GET /api/database
Get current database state
```javascript
{
  "holidays": [...],
  "users": {...}
}
```

## Available Functions

The Claude API can call these functions to interact with the database:

- `mark_holiday(userId, startDate, endDate, reason)` - Create new holiday
- `get_user_holidays(userId)` - Get holidays for specific user
- `get_all_holidays()` - Get all holidays
- `get_holidays_by_date(startDate, endDate)` - Get holidays in date range
- `update_holiday_status(holidayId, status)` - Update holiday status

## Customization

### Adding New Users
Edit the `holidayDatabase.users` object in `server.js`:

```javascript
const holidayDatabase = {
  users: {
    'user1': { name: 'John Doe', department: 'Engineering' },
    'user4': { name: 'Alice Brown', department: 'HR' }, // Add new user
  },
  // ...
};
```

### Adding New Functions
1. Add function to `dbFunctions` object
2. Add tool definition to `tools` array
3. Add case in the switch statement in `/api/chat` endpoint

### Styling
Edit the CSS in `public/index.html` to customize the appearance.

## Production Considerations

For production use, consider:

- **Persistent Database**: Replace in-memory storage with PostgreSQL, MongoDB, etc.
- **Authentication**: Add user authentication and authorization
- **Rate Limiting**: Implement rate limiting for API calls
- **Error Handling**: Enhanced error handling and logging
- **Validation**: Input validation and sanitization
- **Security**: HTTPS, environment variable security, etc.

## Troubleshooting

### Common Issues

1. **"Claude API key not found"**
   - Make sure `.env` file exists and contains `CLAUDE_API_KEY`
   - Verify the API key is correct

2. **"Port already in use"**
   - Change the PORT in `.env` file
   - Or stop the process using that port

3. **"Module not found"**
   - Run `npm install` to install dependencies

4. **