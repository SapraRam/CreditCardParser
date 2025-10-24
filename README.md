# Backend-Frontend Guide

## API Endpoints

### 1. Health Check
- **URL**: `GET /health`
- **Response**:
  ```json
  {
    "status": "healthy",
    "service": "Credit Card Parser API",
    "version": "1.0.0",
    "parser_module": "new"
  }
  ```

### 2. Parse Statement
- **URL**: `POST /parse`
- **Content-Type**: `multipart/form-data`
- **Body**: `file` (PDF file)
- **Response**: See response format above

### 3. Supported Banks
- **URL**: `GET /banks`
- **Response**:
  ```json
  {
    "success": true,
    "banks": [
      {"id": "boa", "name": "Bank of America", "status": "active"},
      {"id": "chase", "name": "Chase", "status": "active"},
      {"id": "citi", "name": "Citibank", "status": "active"},
      {"id": "amex", "name": "American Express", "status": "active"},
      {"id": "discover", "name": "Discover", "status": "active"}
    ]
  }
  ```

## How to Run

### Start Backend (Terminal: py)
```bash
cd backend
py -m venv
source venv/Scrips/activate
python app.py
```
The Flask server will start on `http://localhost:5000`

### Start Frontend (Terminal: bash)
```bash
cd frontEnd
npm run dev
```
The Vite dev server will start on `http://localhost:5173`

## Environment Variables

### Frontend (.env)
```properties
VITE_API_URL=http://localhost:5000
```

## Data Flow

1. User uploads PDF file through FileUpload component
2. Frontend sends file via POST to `/parse` endpoint
3. Backend processes PDF using OCR (new.py module)
4. Backend extracts: card_provider, available_credit, payment_due_date, new_balance, credit_limit
5. Backend returns standardized JSON response
6. Frontend displays extracted data with formatted values

## Features

### Extracted Fields
- **Account Number**: Masked account number (if available)
- **Statement Date**: Date when statement was generated
- **Payment Due Date**: When payment is due (highlighted in red)
- **Current Balance**: Total amount owed (highlighted in blue)
- **Minimum Payment Due**: Minimum amount to pay
- **Available Credit**: Remaining credit available (highlighted in green)
- **Credit Limit**: Total credit limit

### UI Features
- Drag & drop file upload
- PDF validation
- Loading state with spinner
- Success/error status banners
- Color-coded important fields
- Formatted currency and dates
- Warning messages display
- "Parse Another Statement" button

## Supported Banks
Currently supported:
- Bank of America
- Chase
- Citibank
- American Express
- Discover

## Notes
- OCR processing may take 30-60 seconds for complex PDFs
- Frontend timeout set to 60 seconds
- CORS configured for local development
- All currency values formatted as USD
- Dates formatted in long format (e.g., "November 15, 2025")
