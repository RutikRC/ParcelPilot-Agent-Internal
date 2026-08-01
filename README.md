# AI CRM Copilot

## Overview

AI CRM Copilot is an AI-powered document intelligence and retrieval system built around a Node.js backend and a Python AI service. The current repository focuses on the backend and AI integration layers, including authentication, document ingestion, semantic retrieval, chat-based question answering, and asynchronous background processing.

This project is designed to support a CRM-style assistant that can ingest documents, extract meaningful content, create embeddings, and answer user questions using retrieval-augmented generation (RAG).

## Current Project Scope

The implementation in this workspace currently includes:

- A Node.js/Express backend API for authentication, documents, chat, and search
- A Python FastAPI AI service for text extraction, chunking, embeddings, retrieval, and chat generation
- PostgreSQL with pgvector support for storing embeddings and performing similarity search
- Redis and BullMQ for background jobs and document processing workflows
- Upload handling for PDF, DOC, and DOCX files

> The frontend/UI is not implemented in this repository snapshot. The current work is centered on the backend services and AI pipeline.

## Architecture Summary

The system is composed of two main services:

1. Backend API
   - Handles user authentication and session management
   - Exposes document upload, listing, metadata update, restore, and download APIs
   - Provides chat and semantic search endpoints
   - Enqueues processing jobs for documents and workers handle the background pipeline

2. AI Service
   - Exposes FastAPI endpoints for extraction, chunking, embedding generation, retrieval, and chat generation
   - Works with Ollama/LangChain-style orchestration concepts for AI processing
   - Supports the backend’s RAG workflow

## Technology Stack

### Backend
- Node.js
- Express.js
- PostgreSQL
- Redis
- BullMQ
- JSON Web Tokens
- Multer for file uploads

### AI Service
- Python
- FastAPI
- LangChain / LangGraph style orchestration support
- Ollama-compatible inference flow
- pgvector-based semantic retrieval

## Key Features Implemented

### Authentication
- User registration
- User login
- JWT refresh token flow
- Logout and current-user profile retrieval

### Document Management
- Upload PDF, DOC, and DOCX documents
- Store document metadata
- List, download, restore, and delete documents
- Background processing for extraction and indexing

### RAG and Semantic Search
- Generate embeddings for document chunks
- Store vector embeddings in PostgreSQL using pgvector
- Perform similarity-based retrieval for document search and chat answers

### Chat Workflow
- Accept a user question
- Retrieve relevant chunks from the document index
- Send the question and context to the AI service for answer generation
- Return the response along with source references

### Background Processing
- Queue-based document processing using BullMQ
- Worker-based execution for extraction, chunking, embeddings, and indexing

## Repository Structure

```text
backend/
  src/
    app.js
    server.js
    config/
    middlewares/
    module/
    utils/
    workers/

ai-service/
  app/
    api/
    config/
    core/
    middleware/
    routers/
    services/
    tests/
```

## Backend Setup

### Prerequisites
- Node.js and npm
- PostgreSQL running locally or remotely
- Redis running locally or remotely
- Python environment for the AI service

### Install dependencies

```bash
cd backend
npm install
```

### Run the backend server

```bash
npm run dev:server
```

### Run the background workers

```bash
npm run dev:worker
```

### Start the full development stack

```bash
npm run dev
```

## AI Service Setup

### Install Python dependencies

```bash
cd ai-service
pip install -r requirements.txt
```

### Run the AI service

```bash
uvicorn app.main:app --reload
```

## Main API Endpoints

### Authentication
- POST /api/auth/register
- POST /api/auth/login
- POST /api/auth/refresh
- POST /api/auth/logout
- GET /api/auth/me

### Documents
- POST /api/documents/upload
- GET /api/documents
- GET /api/documents/:id
- GET /api/documents/:id/download
- PATCH /api/documents/:id
- PATCH /api/documents/:id/restore
- DELETE /api/documents/:id

### Chat and Search
- POST /api/v1/chat/
- POST /api/v1/search/

## Environment Configuration

The backend expects environment variables such as:

- PORT
- DATABASE_URL or DB_HOST / DB_NAME / DB_USER / DB_PASSWORD
- REDIS_HOST / REDIS_PORT
- JWT secrets and related auth settings

## Status

This repository currently contains the backend foundation and AI service integration for an enterprise CRM assistant. The core capabilities implemented are:

- secure authentication
- document upload and processing
- semantic retrieval with vector search
- chat-based RAG responses
- asynchronous processing via BullMQ workers

## Next Steps

Potential next steps for the project include:

- adding a frontend UI
- expanding the AI workflow with richer tool orchestration
- improving document processing pipelines and observability
- deploying the services with Docker and cloud infrastructure
