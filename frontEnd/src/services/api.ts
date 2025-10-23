/**
 * API Service for Credit Card Statement Parser
 * Handles all communication with the FastAPI backend
 */

import axios from 'axios';

// Backend API base URL - Flask Backend
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

// API endpoints (matching Flask backend)
const ENDPOINTS = {
  PARSE: '/parse',      // Main parsing endpoint
  HEALTH: '/health',    // Health check endpoint
  BANKS: '/banks',      // Supported banks endpoint
};

// Response types matching Flask backend

// Bank statement data returned by the Flask backend
export interface BankStatementData {
  payment_due_date: string | null;     // Payment due date (YYYY-MM-DD)
  minimum_payment_due: string | null;  // Minimum payment amount (as string like "$100.00")
  new_balance: string | null;          // Current balance (as string like "$1,234.56")
  available_credit?: string | null;    // Available credit (as string like "$8,765.44")
  credit_limit?: string | null;        // Credit limit (as string like "$10,000.00")
}

// Main parse response from Flask backend
export interface ParseResponse {
  success: boolean;
  bank?: string;                       // Bank name (e.g., "Bank of America")
  method?: 'text-based' | 'ocr';      // Extraction method used
  data?: BankStatementData;            // Extracted data
  warnings?: string[];                 // Warnings/errors if any
  error?: string;                      // Error message if failed
  message?: string;                    // Additional message
}

// Health check response
export interface HealthResponse {
  status: string;
  service: string;
  version: string;
}

// Bank information
export interface BankInfo {
  id: string;
  name: string;
  status: 'active' | 'coming_soon';
}

// Supported banks response
export interface BanksResponse {
  success: boolean;
  banks: BankInfo[];
}

// Legacy types for backward compatibility
export interface Transaction {
  date: string;
  description: string;
  amount: number;
  category?: string;
}

export interface StatementPeriod {
  start_date: string | null;
  end_date: string | null;
}

export interface StatementMeta {
  detection_confidence: number;
  ocr_used_pages: number[];
  ocr_ratio: number;
  source: string;
}

export interface Statement {
  issuer: "BOA" | "CHASE" | "CBA" | "AMEX" | "CAPITAL_ONE";
  card_last4: string | null;
  statement_period: StatementPeriod | null;
  payment_due_date: string | null;
  total_balance: number | null;
  minimum_due: number | null;
  currency: string;
  transactions: Transaction[];
  meta: StatementMeta;
}

/**
 * Parse a bank statement PDF using the Flask backend
 * @param file - PDF file to parse
 * @returns Parsed data from the statement
 */
export const parseStatement = async (file: File): Promise<ParseResponse> => {
  try {
    const formData = new FormData();
    formData.append('file', file);

    const response = await axios.post<ParseResponse>(
      `${API_BASE_URL}${ENDPOINTS.PARSE}`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 600000, // 600 seconds timeout (OCR can take time)
      }
    );

    return response.data;
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response) {
        // Server responded with error
        return error.response.data as ParseResponse;
      } else if (error.request) {
        // Request made but no response
        return {
          success: false,
          error: 'No response from server',
          message: 'Please ensure the Flask backend is running on http://localhost:5000'
        };
      }
    }
    return {
      success: false,
      error: 'Parse failed',
      message: 'Failed to parse statement. Please try again.'
    };
  }
};

/**
 * Check if the Flask backend API is healthy
 * @returns Health status
 */
export const checkHealth = async (): Promise<HealthResponse> => {
  try {
    const response = await axios.get<HealthResponse>(
      `${API_BASE_URL}${ENDPOINTS.HEALTH}`,
      { timeout: 5000 }
    );
    return response.data;
  } catch (error) {
    throw new Error('Flask backend service is not available. Please start it with: python app.py');
  }
};

/**
 * Get list of supported banks from Flask backend
 * @returns List of supported banks
 */
export const getSupportedBanks = async (): Promise<BanksResponse> => {
  try {
    const response = await axios.get<BanksResponse>(
      `${API_BASE_URL}${ENDPOINTS.BANKS}`,
      { timeout: 5000 }
    );
    return response.data;
  } catch (error) {
    throw new Error('Failed to fetch supported banks');
  }
};

// Legacy function for backward compatibility
export const getSupportedParsers = getSupportedBanks;

export default {
  parseStatement,
  checkHealth,
  getSupportedBanks,
  getSupportedParsers, // Legacy
};
