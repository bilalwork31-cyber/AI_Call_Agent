# AI Voice Agent System

A comprehensive AI voice agent system built for truck driver calls with configuration management, real-time testing, and data extraction capabilities.

## 🏗️ Architecture Overview

**Backend Stack:**
- FastAPI - High-performance web framework
- SQLAlchemy - Database ORM
- Supabase - PostgreSQL database and authentication
- OpenAI API - GPT-4 for intelligent conversation handling
- Retell AI - Voice agent API integration
- Ngrok - Webhook tunneling

**Frontend Stack:**
- React - User interface
- Modern JavaScript/TypeScript
- Responsive design for agent management

## 🚀 Features

- **Agent Configuration Management** - Create, edit, and manage voice agent configurations
- **Real-time Testing** - Initialize test calls to preview agent behavior
- **Truck Driver Use Cases** - Specialized handling for logistics scenarios
- **Data Extraction** - 40-minute call processing with OpenAI integration
- **Webhook Integration** - Real-time call event handling via Ngrok
- **Database Management** - Persistent storage of configurations and call data

## 📋 Prerequisites

- Python 3.12.5
- Node.js v24.4.0
- Supabase account
- OpenAI API key
- Retell AI account
- Ngrok account

## 🛠️ Setup Instructions

### 1. Environment Setup

```bash
# Create and activate Python virtual environment
python -m venv venv

# Windows
venv\Scripts\activate

# macOS/Linux  
source venv/bin/activate

# Install Python dependencies
pip install -r requirements.txt
```

### 2. Environment Configuration

```bash
# Copy example environment file
cp example.env .env

# Edit .env with your credentials (see configuration section below)
```

### 3. Database Setup

```bash
# Ensure your Supabase database is running
In your migrations/env.py, make sure to import your Base and set metadata:
from models import Base  # Base is usually declarative_base()
target_metadata = Base.metadata
# Run database migrations
alembic revision --autogenerate -m "Describe your change"
python -m alembic upgrade head

```

### 4. Ngrok Setup

```bash
# Install ngrok and authenticate
ngrok config add-authtoken YOUR_NGROK_TOKEN

# Start ngrok tunnel (run in separate terminal)
ngrok http 8000
```

### 5. Start Backend Server

```bash
# Start FastAPI server
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 6. Start Frontend Development Server

```bash
# Navigate to frontend directory
cd frontend

# Install dependencies
npm install

# Start development server
npm run dev
```

## ⚙️ Configuration

Create a `.env` file with the following configuration:

```env
# Application URLs
FRONTEND_URL=http://localhost:3000
BACKEND_URL=https://abcsdrefgi.ngrok-free.app

# Supabase Configuration
SUPABASE_URL=postgresql://postgres.somestring:password@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres

# Retell AI Configuration  
RETELL_API_KEY=key_28beradnomstring

# OpenAI Configuration
OPENAI_API_KEY=sk-proj-abcdefg...

```

## 🎯 Usage

### Agent Configuration Management

1. **Access Dashboard**: Navigate to `http://localhost:3000`
2. **Create Agent**: Use the configuration form to set up voice agent parameters
3. **Test Agent**: Initialize test calls to preview agent behavior

### Truck Driver Use Cases

The system handles specific truck driver scenarios:
- Delivery confirmations
- Route updates
- Issue reporting
- Schedule changes
- Emergency situations
- Others


## 🏗️ Design Choices

### Why FastAPI?
- **Performance**: Async support for high concurrency
- **Documentation**: Auto-generated OpenAPI docs
- **Type Safety**: Built-in Pydantic validation
- **Modern**: Python 3.6+ features and async/await

### Why Supabase?
- **Real-time**: Built-in real-time subscriptions
- **Authentication**: Integrated auth system
- **PostgreSQL**: Full SQL capabilities
- **Scalability**: Managed infrastructure

### Why Retell AI?
- **Voice Quality**: High-quality text-to-speech
- **Latency**: Low-latency voice interactions
- **Integration**: Simple API integration
- **Reliability**: Enterprise-grade uptime

### Why React?
- **Component-based**: Reusable UI components  
- **Ecosystem**: Rich library ecosystem
- **Performance**: Virtual DOM optimization
- **Developer Experience**: Hot reloading and debugging tools
- 
## 🚨 Troubleshooting

### Common Issues
- Make sure after running ngrok, paste it url in .env before doing anything
- Free Supabase plab might feels slow ( better and fast to run dockerize postgres container for local testing )

## 📚 Additional Resources

- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [Retell AI API Docs](https://docs.retellai.com/)
- [Supabase Documentation](https://supabase.com/docs)
- [OpenAI API Reference](https://platform.openai.com/docs/)


## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.
