#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';

import lancedb from '@lancedb/lancedb';
import { pipeline, env } from '@xenova/transformers';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { parseOfficeAsync } from 'officeparser';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure pipeline to allow both local and remote models with fallback mechanisms
env.allowLocalModels = true;
env.allowRemoteModels = true;
env.localModelPath = path.join(__dirname, '..', 'models');
env.cacheDir = path.join(__dirname, '..', 'cache');

// Model download configuration
const MODEL_DOWNLOAD_TIMEOUT = 300000; // 5 minutes
const MAX_DOWNLOAD_RETRIES = 3;

// Configuration
const DB_PATH = process.env.LANCEDB_PATH || path.join(__dirname, '..', 'lancedb');
const EMBEDDING_MODEL = process.env.EMBEDDING_MODEL || 'Xenova/all-MiniLM-L6-v2';

let db;
let embedder;
let sourcesTable;

const RAG_SOURCES_TABLE_NAME = 'rag_sources';
const RAG_CHUNKS_TABLE_NAME = 'rag_chunks';

// --- Helper Functions ---

function generateId(data) {
  return crypto.createHash('sha256').update(data).digest('hex');
}

async function updateSourceStatus(sourceId, status, errorMessage = null, chunkCount = null) {
  try {
    // LanceDB doesn't have direct update, so we need to:
    // 1. Get the existing record
    // 2. Delete the old record
    // 3. Insert updated record
    const existingSources = await sourcesTable.query().where(`id = '${sourceId}'`).limit(1).toArray();

    if (existingSources.length > 0) {
      const source = existingSources[0];
      await sourcesTable.delete(`id = "${sourceId}"`);

      const updatedSource = {
        ...source,
        status,
        updated_at: new Date().toISOString(),
        ...(errorMessage && { error_message: errorMessage }),
        ...(chunkCount !== null && { chunk_count: chunkCount })
      };

      await sourcesTable.add([updatedSource]);
      console.error(`Updated source ${sourceId} status to: ${status}`);
    }
  } catch (error) {
    console.error(`Failed to update source ${sourceId} status:`, error);
  }
}

async function initializeEmbedder() {
  let retryCount = 0;

  while (retryCount < MAX_DOWNLOAD_RETRIES) {
    try {
      console.error(`Initializing embedding model: ${EMBEDDING_MODEL} (attempt ${retryCount + 1}/${MAX_DOWNLOAD_RETRIES})`);

      // Check if model exists locally first
      const localModelPath = path.join(env.localModelPath, EMBEDDING_MODEL.replace('/', '_'));
      let modelExists = false;
      try {
        await fs.access(localModelPath);
        modelExists = true;
        console.error(`Found local model at: ${localModelPath}`);
      } catch (e) {
        console.error(`No local model found, will download from remote: ${EMBEDDING_MODEL}`);
      }

      // Initialize with timeout and progress logging
      const initPromise = pipeline('feature-extraction', EMBEDDING_MODEL, {
        quantized: true,
        cache_dir: env.cacheDir,
        local_files_only: false, // Allow remote downloads
        progress_callback: (progress) => {
          if (progress.status === 'downloading') {
            console.error(`Downloading model: ${Math.round(progress.progress || 0)}%`);
          } else if (progress.status === 'loading') {
            console.error('Loading model into memory...');
          }
        }
      });

      // Add timeout to prevent hanging
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Model initialization timeout')), MODEL_DOWNLOAD_TIMEOUT);
      });

      embedder = await Promise.race([initPromise, timeoutPromise]);
      console.error('Embedding model initialized successfully.');

      // Test the embedder with a simple query
      const testEmbedding = await getEmbedding("test");
      if (!testEmbedding || testEmbedding.length === 0) {
        throw new Error('Model test failed - no embedding generated');
      }
      console.error(`Model test successful. Embedding dimension: ${testEmbedding.length}`);

      return; // Success, exit retry loop

    } catch (error) {
      retryCount++;
      console.error(`Failed to initialize embedding model (attempt ${retryCount}):`, error.message);

      if (retryCount >= MAX_DOWNLOAD_RETRIES) {
        console.error('All retry attempts failed. RAG functionality will be disabled.');
        embedder = null;

        // Log fallback options
        console.error('Fallback options:');
        console.error('1. Check internet connection for model download');
        console.error('2. Manually download model to:', path.join(env.localModelPath, EMBEDDING_MODEL.replace('/', '_')));
        console.error('3. Use a different embedding model by setting EMBEDDING_MODEL environment variable');
        return;
      }

      // Wait before retry with exponential backoff
      const waitTime = Math.min(1000 * Math.pow(2, retryCount - 1), 10000);
      console.error(`Retrying in ${waitTime}ms...`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
  }
}

async function getEmbedding(text) {
  if (!embedder) {
    throw new Error('Embedder not initialized.');
  }
  const result = await embedder(text, { pooling: 'mean', normalize: true });
  return Array.from(result.data);
}

async function chunkText(text, chunkSize = 256, overlap = 50) {
  const chunks = [];
  let i = 0;
  while (i < text.length) {
    chunks.push(text.substring(i, i + chunkSize));
    i += chunkSize - overlap;
    if (i + chunkSize > text.length && i < text.length) {
      chunks.push(text.substring(i));
      break;
    }
  }
  return chunks.filter(chunk => chunk.trim() !== '');
}

async function processDocument(filePath, sourceId, sourceType) {
  let textContent;
  const fileExtension = path.extname(filePath).toLowerCase();

  // Define supported file types
  const plainTextFiles = ['.txt', '.md', '.json', '.js', '.ts', '.py', '.html', '.css', '.csv', '.rs', '.xml', '.yaml', '.yml'];
  const officeFiles = ['.pdf', '.docx', '.pptx', '.xlsx', '.odt', '.odp', '.ods'];
  const supportedFiles = [...plainTextFiles, ...officeFiles];

  if (supportedFiles.includes(fileExtension)) {
    if (officeFiles.includes(fileExtension)) {
      // Use officeparser for all office file formats (pdf, docx, pptx, xlsx, odt, odp, ods)
      try {
        const data = await parseOfficeAsync(filePath);
        textContent = data;
        console.error(`Extracted text from ${fileExtension.toUpperCase()} file: ${filePath}`);
      } catch (error) {
        console.error(`Failed to process ${fileExtension.toUpperCase()} file:`, error);
        throw new Error(`Failed to extract text from ${fileExtension.toUpperCase()} file: ${error.message}. Please ensure officeparser is installed: npm install officeparser`);
      }
    } else if (fileExtension === '.csv') {
      // For CSV files, read and convert to structured text
      textContent = await fs.readFile(filePath, 'utf-8');
      // Add some structure to CSV for better chunking
      const lines = textContent.split('\n');
      if (lines.length > 0) {
        const header = lines[0];
        textContent = `CSV Data with columns: ${header}\n\n${textContent}`;
      }
    } else {
      // For all other supported text files (.txt, .md, .json, .js, .ts, .py, .html, .css, .rs, .xml, .yaml, .yml)
      textContent = await fs.readFile(filePath, 'utf-8');
    }
  } else {
    throw new Error(`Unsupported file type: ${fileExtension}. Supported types: .txt, .md, .json, .js, .ts, .py, .html, .css, .csv, .rs, .xml, .yaml, .yml, .pdf, .docx, .pptx, .xlsx, .odt, .odp, .ods`);
  }

  const chunks = await chunkText(textContent);
  const chunkEmbeddings = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const embedding = await getEmbedding(chunk);
    chunkEmbeddings.push({
      id: generateId(`${sourceId}_chunk_${i}`),
      source_id: sourceId,
      text_chunk: chunk,
      vector: embedding,
      original_document_path: filePath,
      document_type: sourceType,
      chunk_order: i
    });
  }
  return chunkEmbeddings;
}

// --- Database Initialization ---

async function initializeDatabase() {
  try {
    // Ensure directories exist
    await fs.mkdir(DB_PATH, { recursive: true });
    await fs.mkdir(path.join(__dirname, '..', 'models'), { recursive: true });
    await fs.mkdir(path.join(__dirname, '..', 'cache'), { recursive: true });

    db = await lancedb.connect(DB_PATH);
    console.error(`Connected to LanceDB at ${DB_PATH}`);

    // Initialize embedder
    await initializeEmbedder();

    // Create rag_sources table if it doesn't exist
    try {
      sourcesTable = await db.openTable(RAG_SOURCES_TABLE_NAME);
      console.error(`Opened existing table: ${RAG_SOURCES_TABLE_NAME}`);
    } catch (e) {
      const dummySourceData = [{
        id: 'init',
        source_id: 'init',
        type: 'system',
        name: 'init',
        path: 'system',
        filename: 'init',
        file_type: 'system',
        status: 'system',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        added_at: new Date().toISOString(),
        metadata: '{}',
        chunk_count: 0,
        file_size: 0
      }];
      sourcesTable = await db.createTable(RAG_SOURCES_TABLE_NAME, dummySourceData);
      await sourcesTable.delete("id = 'init'");
      console.error(`Created table: ${RAG_SOURCES_TABLE_NAME}`);
    }

    // Create rag_chunks table if it doesn't exist
    try {
      const chunksTbl = await db.openTable(RAG_CHUNKS_TABLE_NAME);
      console.error(`Opened existing table: ${RAG_CHUNKS_TABLE_NAME}`);
    } catch (e) {
      if (embedder) {
        const dummyEmbedding = await getEmbedding("init");
        const dummyChunkData = [{
          id: 'init_chunk',
          source_id: 'init',
          text_chunk: 'Initial chunk',
          vector: dummyEmbedding,
          original_document_path: 'system',
          document_type: 'system',
          chunk_order: 0
        }];
        await db.createTable(RAG_CHUNKS_TABLE_NAME, dummyChunkData);
        const chunksTbl = await db.openTable(RAG_CHUNKS_TABLE_NAME);
        await chunksTbl.delete("id = 'init_chunk'");
        console.error(`Created table: ${RAG_CHUNKS_TABLE_NAME}`);
      }
    }

    console.error('Database initialized successfully');
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
}

// --- MCP Server Implementation ---

class RAGMCPServer {
  constructor() {
    this.server = new Server(
      {
        name: 'rag-mcp-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  setupErrorHandling() {
    this.server.onerror = (error) => {
      console.error('[MCP Error]', error);
    };

    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  setupToolHandlers() {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          {
            name: 'rag_add_data_source',
            description: 'Adds a new data source (e.g., file, URL) to the RAG system for processing and indexing.',
            inputSchema: {
              type: 'object',
              properties: {
                source_type: {
                  type: 'string',
                  enum: ['file', 'url'],
                  description: 'Type of the data source.'
                },
                path_or_url: {
                  type: 'string',
                  description: 'Absolute path to the local file or the URL of the data source.'
                },
                metadata: {
                  type: 'object',
                  description: 'Optional metadata to associate with the source.'
                }
              },
              required: ['source_type', 'path_or_url']
            }
          },
          {
            name: 'rag_list_data_sources',
            description: 'Lists all available data sources currently managed by the RAG system.',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          },
          {
            name: 'rag_remove_data_source',
            description: 'Removes a data source and all its associated indexed data from the RAG system.',
            inputSchema: {
              type: 'object',
              properties: {
                source_id: {
                  type: 'string',
                  description: 'The unique identifier of the data source to remove.'
                }
              },
              required: ['source_id']
            }
          },
          {
            name: 'rag_query_documents',
            description: 'Queries the RAG system with a given text to retrieve relevant document chunks/contexts.',
            inputSchema: {
              type: 'object',
              properties: {
                query_text: {
                  type: 'string',
                  description: 'The query text to search for.'
                },
                top_k: {
                  type: 'integer',
                  minimum: 1,
                  default: 3,
                  description: 'Number of top relevant chunks to retrieve.'
                },
                filters: {
                  type: 'object',
                  properties: {
                    source_id: {
                      type: 'string',
                      description: 'Filter results by a specific source ID.'
                    }
                  },
                  description: 'Optional filters to apply to the search.'
                }
              },
              required: ['query_text']
            }
          },
          {
            name: 'rag_clean_all_data_sources',
            description: 'Removes all data sources and their associated indexed data from the RAG system by re-initializing the database.',
            inputSchema: {
              type: 'object',
              properties: {}
            }
          }
        ]
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        switch (name) {
          case 'rag_add_data_source':
            return await this.handleAddDataSource(args);
          case 'rag_list_data_sources':
            return await this.handleListDataSources(args);
          case 'rag_remove_data_source':
            return await this.handleRemoveDataSource(args);
          case 'rag_query_documents':
            return await this.handleQueryDocuments(args);
          case 'rag_clean_all_data_sources':
            return await this.handleCleanAllDataSources(args);
          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }
        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${error.message}`
        );
      }
    });
  }

  async handleAddDataSource(args) {
    const { source_type, path_or_url, metadata = {} } = args;

    if (!source_type || !path_or_url) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'source_type and path_or_url are required.'
      );
    }

    if (source_type !== 'file') {
      throw new McpError(
        ErrorCode.InvalidParams,
        'Only "file" source_type is currently supported.'
      );
    }

    // Declare sourceId outside try block so it's accessible in catch block
    let sourceId;

    try {
      // Check if file exists
      await fs.access(path_or_url);

      sourceId = generateId(path_or_url);
      const sourceName = path.basename(path_or_url);

      // Check if source already exists
      const existingSources = await sourcesTable.query().where(`id = '${sourceId}'`).limit(1).toArray();
      if (existingSources.length > 0) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `Data source already exists with ID: ${sourceId}`
        );
      }

      // Get file stats for additional metadata
      const stats = await fs.stat(path_or_url);
      const fileExtension = path.extname(path_or_url).toLowerCase();
      
      // Add to sources table
      await sourcesTable.add([{
        id: sourceId,
        source_id: sourceId,
        type: source_type,
        name: sourceName,
        path: path_or_url,
        filename: sourceName,
        file_type: fileExtension.slice(1) || 'unknown', // Remove the dot from extension
        status: 'processing',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        added_at: new Date().toISOString(),
        metadata: JSON.stringify(metadata),
        chunk_count: 0, // Will be updated after processing
        file_size: stats.size
      }]);

      // Process and add document chunks
      console.error(`Processing document: ${path_or_url}`);
      const chunkData = await processDocument(path_or_url, sourceId, source_type);
      if (chunkData.length > 0) {
        const chunksTable = await db.openTable(RAG_CHUNKS_TABLE_NAME);
        await chunksTable.add(chunkData);
        console.error(`Added ${chunkData.length} chunks for source ${sourceId}`);

        // Update status to 'indexed' after successful processing
        await updateSourceStatus(sourceId, 'indexed', null, chunkData.length);
        console.error(`Document processing completed successfully. ${chunkData.length} chunks indexed for source ${sourceId}`);
      } else {
        // Update status to 'error' if no chunks could be extracted
        await updateSourceStatus(sourceId, 'error', 'No chunks could be extracted from document');
        console.error(`Document processing failed: No chunks could be extracted from document ${sourceId}`);
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status: 'success',
              source_id: sourceId,
              chunk_count: chunkData.length,
              message: `Data source added and processed successfully. Added ${chunkData.length} chunks.`
            })
          }
        ]
      };
    } catch (error) {
      // Update status to 'error' when processing fails
      if (sourceId) {
        await updateSourceStatus(sourceId, 'error', error.message);
      }
      console.error(`Document processing failed for source ${sourceId}: ${error.message}`);

      if (error instanceof McpError) {
        throw error;
      }
      if (error.code === 'ENOENT') {
        throw new McpError(
          ErrorCode.InvalidParams,
          `File not found: ${path_or_url}`
        );
      }
      if (error.message && error.message.includes('Embedder not initialized')) {
        throw new McpError(
          ErrorCode.InternalError,
          'Embedding model not ready. Please wait for model initialization to complete or check server logs for embedding model issues.'
        );
      }
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to add data source: ${error.message}`
      );
    }
  }

  async handleListDataSources(args) {
    try {
      // Use toArray() to get all records without vector search
      const allSources = await sourcesTable.query().limit(1000).toArray();
      const formattedSources = allSources.map(s => ({
        id: s.id,
        source_id: s.id,
        type: s.type,
        name: s.name,
        path: s.path || s.path_or_url,
        filename: s.filename || s.path?.split('/').pop() || 'Unknown',
        file_type: s.file_type || 'unknown',
        status: s.status || 'unknown',
        created_at: s.created_at || s.added_at || new Date().toISOString(),
        updated_at: s.updated_at || s.added_at || new Date().toISOString(),
        added_at: s.added_at,
        metadata: s.metadata ? JSON.parse(s.metadata) : {},
        chunk_count: s.chunk_count,
        file_size: s.file_size,
        ...(s.error_message && { error_message: s.error_message })
      }));

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ sources: formattedSources })
          }
        ]
      };
    } catch (error) {
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to list data sources: ${error.message}`
      );
    }
  }

  async handleRemoveDataSource(args) {
    const { source_id } = args;

    if (!source_id) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'source_id is required.'
      );
    }

    try {
      // Check if source exists
      const existingSources = await sourcesTable.query().where(`id = '${source_id}'`).limit(1).toArray();
      if (existingSources.length === 0) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `Data source with id ${source_id} not found.`
        );
      }

      // Remove from sources table
      await sourcesTable.delete(`id = "${source_id}"`);

      // Remove associated chunks from chunks table
      const chunksTable = await db.openTable(RAG_CHUNKS_TABLE_NAME);
      await chunksTable.delete(`source_id = "${source_id}"`);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status: 'success',
              message: `Data source ${source_id} and its chunks removed successfully.`
            })
          }
        ]
      };
    } catch (error) {
      if (error instanceof McpError) {
        throw error;
      }
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to remove data source: ${error.message}`
      );
    }
  }

  async handleQueryDocuments(args) {
    const { query_text, top_k = 3, filters = {} } = args;

    if (!query_text) {
      throw new McpError(
        ErrorCode.InvalidParams,
        'query_text is required.'
      );
    }

    try {
      if (!embedder) {
        throw new McpError(
          ErrorCode.InternalError,
          'Embedding model not ready. Please try again later.'
        );
      }

      const queryEmbedding = await getEmbedding(query_text);
      const chunksTable = await db.openTable(RAG_CHUNKS_TABLE_NAME);

      let query = chunksTable.vectorSearch(queryEmbedding).limit(top_k);

      // Apply filters
      if (filters.source_id) {
        query = query.where(`source_id = '${filters.source_id}'`);
      }

      const results = await query.toArray();
      console.error(`[DEBUG] handleQueryDocuments: Vector search returned ${results.length} results`);

      // Convert distance to similarity score (LanceDB returns _distance, lower is better)
      // Similarity = 1 / (1 + distance) to convert distance to similarity (0-1 range)
      const retrieved_contexts = results.map(r => {
        const distance = r._distance || 0;
        const similarity = 1 / (1 + distance);

        return {
          document_id: r.source_id,
          text_chunk: r.text_chunk,
          similarity_score: Math.round(similarity * 10000) / 10000, // Round to 4 decimal places
          distance: Math.round(distance * 10000) / 10000,
          metadata: {
            original_document_path: r.original_document_path,
            document_type: r.document_type,
            chunk_order: r.chunk_order,
            source_id: r.source_id
          }
        };
      });

      // Sort by similarity score (highest first)
      retrieved_contexts.sort((a, b) => b.similarity_score - a.similarity_score);

      // Get source information for context
      const sourceIds = [...new Set(retrieved_contexts.map(ctx => ctx.document_id))];
      const sourceInfo = {};

      for (const sourceId of sourceIds) {
        try {
          const sources = await sourcesTable.query().where(`id = '${sourceId}'`).limit(1).toArray();
          if (sources.length > 0) {
            sourceInfo[sourceId] = {
              name: sources[0].name,
              type: sources[0].type,
              status: sources[0].status,
              added_at: sources[0].added_at
            };
          }
        } catch (e) {
          console.error(`Failed to get source info for ${sourceId}:`, e);
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              query: query_text,
              total_results: retrieved_contexts.length,
              retrieved_contexts,
              source_info: sourceInfo,
              query_timestamp: new Date().toISOString()
            })
          }
        ]
      };
    } catch (error) {
      if (error instanceof McpError) {
        throw error;
      }
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to query documents: ${error.message}`
      );
    }
  }

  async handleCleanAllDataSources(args) {
    try {
      console.error('Starting clean all data sources operation...');
      
      // Get count of existing sources for reporting
      let sourceCount = 0;
      let chunkCount = 0;
      
      try {
        const allSources = await sourcesTable.query().limit(10000).toArray();
        sourceCount = allSources.length;
        console.error(`Found ${sourceCount} existing data sources to clean`);
      } catch (e) {
        console.error('Could not count existing sources:', e.message);
      }

      try {
        const chunksTable = await db.openTable(RAG_CHUNKS_TABLE_NAME);
        const allChunks = await chunksTable.query().limit(100000).toArray();
        chunkCount = allChunks.length;
        console.error(`Found ${chunkCount} existing chunks to clean`);
      } catch (e) {
        console.error('Could not count existing chunks:', e.message);
      }

      // Drop existing tables to clean all data
      try {
        await db.dropTable(RAG_SOURCES_TABLE_NAME);
        console.error(`Dropped table: ${RAG_SOURCES_TABLE_NAME}`);
      } catch (e) {
        console.error(`Table ${RAG_SOURCES_TABLE_NAME} may not exist or already dropped:`, e.message);
      }

      try {
        await db.dropTable(RAG_CHUNKS_TABLE_NAME);
        console.error(`Dropped table: ${RAG_CHUNKS_TABLE_NAME}`);
      } catch (e) {
        console.error(`Table ${RAG_CHUNKS_TABLE_NAME} may not exist or already dropped:`, e.message);
      }

      // Re-initialize database to create fresh tables
      console.error('Re-initializing database with clean tables...');
      
      // Create rag_sources table
      const dummySourceData = [{
        id: 'init',
        source_id: 'init',
        type: 'system',
        name: 'init',
        path: 'system',
        filename: 'init',
        file_type: 'system',
        status: 'system',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        added_at: new Date().toISOString(),
        metadata: '{}',
        chunk_count: 0,
        file_size: 0
      }];
      sourcesTable = await db.createTable(RAG_SOURCES_TABLE_NAME, dummySourceData);
      await sourcesTable.delete("id = 'init'");
      console.error(`Created clean table: ${RAG_SOURCES_TABLE_NAME}`);

      // Create rag_chunks table
      if (embedder) {
        const dummyEmbedding = await getEmbedding("init");
        const dummyChunkData = [{
          id: 'init_chunk',
          source_id: 'init',
          text_chunk: 'Initial chunk',
          vector: dummyEmbedding,
          original_document_path: 'system',
          document_type: 'system',
          chunk_order: 0
        }];
        await db.createTable(RAG_CHUNKS_TABLE_NAME, dummyChunkData);
        const chunksTbl = await db.openTable(RAG_CHUNKS_TABLE_NAME);
        await chunksTbl.delete("id = 'init_chunk'");
        console.error(`Created clean table: ${RAG_CHUNKS_TABLE_NAME}`);
      } else {
        console.error('Warning: Embedder not available, chunks table not recreated');
      }

      console.error('Clean all data sources operation completed successfully');

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              status: 'success',
              message: `All data sources cleaned successfully. Removed ${sourceCount} sources and ${chunkCount} chunks.`,
              sources_removed: sourceCount,
              chunks_removed: chunkCount,
              timestamp: new Date().toISOString()
            })
          }
        ]
      };
    } catch (error) {
      console.error('Failed to clean all data sources:', error);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to clean all data sources: ${error.message}`
      );
    }
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('RAG MCP Server running on stdio');
  }
}

// --- Main ---

async function main() {
  try {
    await initializeDatabase();
    const server = new RAGMCPServer();
    await server.run();
  } catch (error) {
    console.error('Failed to start RAG MCP Server:', error);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}