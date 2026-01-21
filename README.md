# 🎓 RVCE AI Timetable Generator

An intelligent, AI-powered automatic timetable generation system designed for R.V. College of Engineering. This system uses advanced constraint satisfaction algorithms to generate conflict-free schedules while optimizing for multiple objectives.

![Status](https://img.shields.io/badge/Status-Active-success)
![Python](https://img.shields.io/badge/Python-3.9+-blue)
![React](https://img.shields.io/badge/React-18+-61DAFB)
![FastAPI](https://img.shields.io/badge/FastAPI-0.100+-009688)
![Supabase](https://img.shields.io/badge/Database-Supabase-3ECF8E)

## ✨ Features

- **🤖 AI-Powered Scheduling**: Constraint satisfaction algorithm that handles complex scheduling requirements
- **📊 Multi-Department Support**: Supports 14 departments including CSE, ECE, ME, ISE, AIML, and more
- **🔄 Real-time Generation**: Generate timetables for any semester (Odd/Even) dynamically
- **📱 Responsive UI**: Modern React-based interface with multiple views
- **🔍 Multiple Views**: 
  - Section-wise timetable view
  - Faculty-wise schedule view
  - Room/Lab availability view
  - Department overview
- **✏️ Manual Adjustments**: Edit and adjust slots after generation
- **📤 Export Options**: Export timetables to various formats
- **🗄️ Cloud Database**: Supabase integration for persistent storage

## 🏗️ Project Structure

```
ai_timetable/
├── backend/                    # FastAPI Backend Server
│   ├── main.py                # Main API entry point
│   ├── api_timetable_v7.py    # Timetable generation API endpoints
│   ├── timetable_solver_v7.py # Core constraint satisfaction solver
│   ├── config.py              # Configuration settings
│   ├── database.py            # Database connection setup
│   ├── models.py              # SQLAlchemy/Pydantic models
│   ├── auth.py                # Authentication module
│   ├── parse_syllabus.py      # PDF syllabus parser utility
│   ├── services/
│   │   ├── supabase_service.py # Supabase REST API service
│   │   ├── engine.py          # Timetable engine service
│   │   ├── data_loader.py     # Data loading utilities
│   │   └── validate_data.py   # Data validation
│   └── utils/
│       └── load_supabase_data.py
│
├── frontend/                   # React Frontend
│   └── rvce-erp/
│       ├── src/
│       │   ├── components/    # Reusable UI components
│       │   ├── pages/         # Page components
│       │   ├── services/      # API services
│       │   └── context/       # React context providers
│       ├── package.json
│       └── vite.config.js
│
├── data/                       # Data Files
│   ├── departments.csv        # Department information
│   ├── faculty.csv            # Faculty details
│   ├── rooms_3dept.csv        # Room/Lab information
│   ├── sections_3dept.csv     # Section details
│   ├── subjects_parsed.csv    # Subject/Course data
│   └── syllabus/              # PDF syllabus files
│
├── requirements.txt            # Python dependencies
├── .gitignore
└── README.md
```

## 🚀 Quick Start

### Prerequisites

- **Python 3.9+** (recommended: 3.11)
- **Node.js 18+** and npm
- **Git**
- **Supabase Account** (for database)

### 1. Clone the Repository

```bash
git clone https://github.com/aryanchauhan-alt/RVCE-AI-Timetable-Generator.git
cd RVCE-AI-Timetable-Generator
```

### 2. Environment Setup

Create a `.env` file in the root directory:

```env
# Supabase Configuration
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key

# Backend Database (Supabase REST API)
SUPABASE_URL=your_supabase_project_url
SUPABASE_KEY=your_supabase_anon_key
```

### 3. Backend Setup

```bash
# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Start the backend server
cd backend
python api_timetable_v7.py
```

The backend API will be running at: `http://localhost:8000`

### 4. Frontend Setup

Open a **new terminal**:

```bash
cd frontend/rvce-erp

# Install dependencies
npm install

# Start development server
npm run dev
```

The frontend will be running at: `http://localhost:5173`

### 5. Access the Application

Open your browser and navigate to `http://localhost:5173`

## 📋 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v2/generate` | POST | Generate new timetable |
| `/api/v2/timetable/{section_id}` | GET | Get timetable for a section |
| `/api/v2/stats` | GET | Get generation statistics |
| `/api/v2/departments` | GET | List all departments |
| `/api/v2/sections/{dept_id}` | GET | List sections by department |
| `/api/v2/faculty` | GET | List all faculty |
| `/api/v2/rooms` | GET | List all rooms |
| `/docs` | GET | Interactive API documentation |

## 🗄️ Database Schema

The system uses Supabase with the following tables:

- **departments** - Department information (14 departments)
- **faculty** - Faculty details (228 faculty members)
- **rooms** - Room/Lab information (242 rooms)
- **sections** - Section details (330 sections)
- **subjects** - Subject/Course data (831 subjects)
- **timetable_slots** - Generated timetable slots

## 🔧 Configuration

### Backend Configuration (`backend/config.py`)

```python
CORS_ORIGINS = [
    "http://localhost:5173",
    "http://localhost:5174",
    "http://127.0.0.1:5173",
]

SLOTS_PER_DAY = 8
WORKING_DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
```

### Timetable Constraints

The solver enforces:
- No faculty conflicts (same faculty in multiple places)
- No room conflicts (same room used twice)
- Lab sessions are consecutive (2-3 hours)
- Credit hour requirements per subject
- Minimum/maximum lectures per day per section

## 🛠️ Tech Stack

### Backend
- **FastAPI** - Modern Python web framework
- **Uvicorn** - ASGI server
- **httpx** - Async HTTP client for Supabase REST API
- **Pandas** - Data manipulation
- **Pydantic** - Data validation

### Frontend
- **React 18** - UI library
- **Vite** - Build tool
- **Tailwind CSS** - Styling
- **Supabase Client** - Database client
- **React Router** - Navigation

### Database
- **Supabase** - PostgreSQL with REST API

## 📊 Statistics

Current deployment handles:
- **14 Departments**
- **330 Sections**
- **228 Faculty Members**
- **242 Rooms/Labs**
- **831 Subjects**
- **4600+ Slots per Semester**

## 🚢 Deployment

### Backend (Railway/Render/Fly.io)

1. Set environment variables in your deployment platform
2. Use the start command: `cd backend && uvicorn api_timetable_v7:app --host 0.0.0.0 --port $PORT`

### Frontend (Vercel/Netlify)

1. Set the build command: `npm run build`
2. Set the output directory: `dist`
3. Add environment variables for Supabase

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit changes (`git commit -m 'Add AmazingFeature'`)
4. Push to branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 👨‍💻 Author

**Aryan Chauhan**
- GitHub: [@aryanchauhan-alt](https://github.com/aryanchauhan-alt)

## 🙏 Acknowledgments

- R.V. College of Engineering for the project requirements
- Supabase for the excellent database platform
- FastAPI and React communities

---

<p align="center">
  Made with ❤️ for RVCE
</p>
