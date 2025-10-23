/**
 * FileUpload Component
 * Handles PDF file upload and displays parsed results from Flask backend
 */

import React, { useState } from 'react';
import { Upload, FileText, CheckCircle, AlertCircle, XCircle, Loader2 } from 'lucide-react';
import { parseStatement, ParseResponse } from '../services/api';

interface FileUploadProps {
  onParseComplete?: (result: ParseResponse) => void;
}

const FileUpload: React.FC<FileUploadProps> = ({ onParseComplete }) => {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ParseResponse | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const droppedFile = e.dataTransfer.files[0];
      if (droppedFile.type === 'application/pdf') {
        setFile(droppedFile);
        setResult(null);
      } else {
        alert('Please upload a PDF file');
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      if (selectedFile.type === 'application/pdf') {
        setFile(selectedFile);
        setResult(null);
      } else {
        alert('Please upload a PDF file');
      }
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setLoading(true);
    setResult(null);

    try {
      const response = await parseStatement(file);
      setResult(response);
      if (onParseComplete) {
        onParseComplete(response);
      }
    } catch (error) {
      setResult({
        success: false,
        error: 'Upload failed',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setFile(null);
    setResult(null);
  };

  const formatCurrency = (amount: number | null) => {
    if (amount === null) return 'N/A';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD'
    }).format(amount);
  };

  const formatDate = (date: string | null) => {
    if (!date) return 'N/A';
    try {
      return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    } catch {
      return date;
    }
  };

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Upload Area */}
      <div
        className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-300 ${
          dragActive
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
            : 'border-gray-300 dark:border-gray-600 hover:border-gray-400'
        }`}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
      >
        <input
          type="file"
          id="file-upload"
          accept=".pdf"
          onChange={handleChange}
          className="hidden"
        />
        
        <label htmlFor="file-upload" className="cursor-pointer">
          <div className="space-y-4">
            <div className="flex justify-center">
              <Upload className="w-16 h-16 text-blue-500" />
            </div>
            <div>
              <p className="text-xl font-semibold text-gray-700 dark:text-gray-200">
                Drop your PDF here or click to browse
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
                Supported: Bank of America, Chase Bank, and Commonwealth Bank statements
              </p>
            </div>
          </div>
        </label>

        {file && (
          <div className="mt-6 p-4 bg-gray-100 dark:bg-gray-800 rounded-lg inline-flex items-center gap-3">
            <FileText className="w-5 h-5 text-blue-500" />
            <span className="font-medium text-gray-700 dark:text-gray-200">
              {file.name}
            </span>
            <button
              onClick={handleReset}
              className="ml-2 text-red-500 hover:text-red-700"
              aria-label="Remove file"
            >
              <XCircle className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>

      {/* Upload Button */}
      {file && !result && (
        <button
          onClick={handleUpload}
          disabled={loading}
          className="w-full py-4 px-6 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white rounded-xl font-semibold text-lg transition-all duration-300 flex items-center justify-center gap-3"
        >
          {loading ? (
            <>
              <Loader2 className="w-6 h-6 animate-spin" />
              Parsing Statement...
            </>
          ) : (
            <>
              <Upload className="w-6 h-6" />
              Parse Statement
            </>
          )}
        </button>
      )}

      {/* Results Display */}
      {result && (
        <div className="space-y-4">
          {/* Status Banner */}
          <div
            className={`p-6 rounded-xl flex items-start gap-4 ${
              result.success
                ? 'bg-green-50 dark:bg-green-900/20 border-2 border-green-200 dark:border-green-800'
                : 'bg-red-50 dark:bg-red-900/20 border-2 border-red-200 dark:border-red-800'
            }`}
          >
            <div className="flex-shrink-0">
              {result.success ? (
                <CheckCircle className="w-8 h-8 text-green-600" />
              ) : (
                <AlertCircle className="w-8 h-8 text-red-600" />
              )}
            </div>
            <div className="flex-1">
              <h3
                className={`text-xl font-bold mb-2 ${
                  result.success ? 'text-green-800 dark:text-green-200' : 'text-red-800 dark:text-red-200'
                }`}
              >
                {result.success ? 'Statement Parsed Successfully!' : 'Parsing Failed'}
              </h3>
              {result.bank && (
                <p className="text-gray-700 dark:text-gray-300 mb-1">
                  <strong>Bank:</strong> {result.bank}
                </p>
              )}
              {result.method && (
                <p className="text-gray-700 dark:text-gray-300 mb-1">
                  <strong>Method:</strong> {result.method === 'text-based' ? 'Text-based extraction' : 'OCR extraction'}
                </p>
              )}
              {result.error && (
                <p className="text-red-700 dark:text-red-300 mt-2">
                  <strong>Error:</strong> {result.error}
                </p>
              )}
              {result.message && (
                <p className="text-gray-600 dark:text-gray-400 mt-1">
                  {result.message}
                </p>
              )}
            </div>
          </div>

          {/* Warnings */}
          {result.warnings && result.warnings.length > 0 && (
            <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-200 dark:border-yellow-800 rounded-xl">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-semibold text-yellow-800 dark:text-yellow-200 mb-2">
                    Warnings:
                  </h4>
                  <ul className="list-disc list-inside space-y-1">
                    {result.warnings.map((warning, index) => (
                      <li key={index} className="text-yellow-700 dark:text-yellow-300">
                        {warning}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          )}

          {/* Extracted Data */}
          {result.success && result.data && (
            <div className="bg-white dark:bg-gray-800 rounded-xl border-2 border-gray-200 dark:border-gray-700 overflow-hidden">
              <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-4">
                <h3 className="text-xl font-bold text-white">Extracted Data</h3>
              </div>
              <div className="p-6 space-y-4">
                {/* Account Number */}
                {result.data.account_number !== undefined && (
                  <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <span className="font-semibold text-gray-700 dark:text-gray-300">
                      Account Number:
                    </span>
                    <span className={`text-lg font-medium ${
                      result.data.account_number 
                        ? 'text-gray-900 dark:text-gray-100'
                        : 'text-gray-400 dark:text-gray-600'
                    }`}>
                      {result.data.account_number || 'N/A'}
                    </span>
                  </div>
                )}

                {/* Statement Date */}
                {result.data.statement_date !== undefined && (
                  <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <span className="font-semibold text-gray-700 dark:text-gray-300">
                      Statement Date:
                    </span>
                    <span className={`text-lg font-medium ${
                      result.data.statement_date 
                        ? 'text-gray-900 dark:text-gray-100'
                        : 'text-gray-400 dark:text-gray-600'
                    }`}>
                      {formatDate(result.data.statement_date)}
                    </span>
                  </div>
                )}

                {/* Payment Due Date */}
                {result.data.payment_due_date !== undefined && (
                  <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <span className="font-semibold text-gray-700 dark:text-gray-300">
                      Payment Due Date:
                    </span>
                    <span className={`text-lg font-medium ${
                      result.data.payment_due_date 
                        ? 'text-red-600 dark:text-red-400 font-bold'
                        : 'text-gray-400 dark:text-gray-600'
                    }`}>
                      {formatDate(result.data.payment_due_date)}
                    </span>
                  </div>
                )}

                {/* New Balance */}
                {result.data.new_balance !== undefined && (
                  <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border-2 border-blue-200 dark:border-blue-800">
                    <span className="font-semibold text-blue-800 dark:text-blue-300">
                      Current Balance:
                    </span>
                    <span className={`text-xl font-bold ${
                      result.data.new_balance 
                        ? 'text-blue-900 dark:text-blue-100'
                        : 'text-gray-400 dark:text-gray-600'
                    }`}>
                      {formatCurrency(result.data.new_balance)}
                    </span>
                  </div>
                )}

                {/* Minimum Payment Due */}
                {result.data.minimum_payment_due !== undefined && (
                  <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <span className="font-semibold text-gray-700 dark:text-gray-300">
                      Minimum Payment Due:
                    </span>
                    <span className={`text-lg font-medium ${
                      result.data.minimum_payment_due 
                        ? 'text-gray-900 dark:text-gray-100'
                        : 'text-gray-400 dark:text-gray-600'
                    }`}>
                      {formatCurrency(result.data.minimum_payment_due)}
                    </span>
                  </div>
                )}

                {/* Available Credit */}
                {result.data.available_credit !== undefined && (
                  <div className="flex items-center justify-between p-4 bg-green-50 dark:bg-green-900/20 rounded-lg border-2 border-green-200 dark:border-green-800">
                    <span className="font-semibold text-green-800 dark:text-green-300">
                      Available Credit:
                    </span>
                    <span className={`text-xl font-bold ${
                      result.data.available_credit 
                        ? 'text-green-900 dark:text-green-100'
                        : 'text-gray-400 dark:text-gray-600'
                    }`}>
                      {formatCurrency(result.data.available_credit)}
                    </span>
                  </div>
                )}

                {/* Credit Limit */}
                {result.data.credit_limit !== undefined && (
                  <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg">
                    <span className="font-semibold text-gray-700 dark:text-gray-300">
                      Credit Limit:
                    </span>
                    <span className={`text-lg font-medium ${
                      result.data.credit_limit 
                        ? 'text-gray-900 dark:text-gray-100'
                        : 'text-gray-400 dark:text-gray-600'
                    }`}>
                      {formatCurrency(result.data.credit_limit)}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Try Again Button */}
          <button
            onClick={handleReset}
            className="w-full py-3 px-6 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-gray-200 rounded-xl font-semibold transition-all duration-300"
          >
            Parse Another Statement
          </button>
        </div>
      )}
    </div>
  );
};

export default FileUpload;
