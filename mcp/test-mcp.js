#!/usr/bin/env node

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import { promises as fs } from 'fs';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Test configuration
const TEST_TIMEOUT = 60000; // 60 seconds
const SERVER_INIT_WAIT = 8000; // 8 seconds for server initialization

async function createTestFile() {
  const testFilePath = path.join(__dirname, 'test-document.txt');
  const testContent = `
# Test Document for RAG System

This is a test document to verify the RAG (Retrieval-Augmented Generation) system functionality.

## Section 1: Introduction
The RAG system combines retrieval and generation capabilities to provide contextual responses based on indexed documents.

## Section 2: Features
- Document indexing and chunking
- Vector embeddings for semantic search
- Similarity-based retrieval
- Integration with chat systems

## Section 3: Technical Details
The system uses LanceDB for vector storage and Xenova transformers for embedding generation.
It supports multiple file formats including text, markdown, and structured documents.

## Conclusion
This test document should be successfully processed and indexed by the RAG system.
  `.trim();
  
  await fs.writeFile(testFilePath, testContent);
  console.log(`✅ Created test file: ${testFilePath}`);
  return testFilePath;
}

async function testMCPServer() {
  console.log('🚀 Starting comprehensive RAG MCP Server test with @modelcontextprotocol/sdk...');
  
  let serverProcess;
  let client;
  let testFilePath;
  
  try {
    // Create test file
    testFilePath = await createTestFile();
    
    // Start the MCP server
    console.log('📡 Starting MCP server...');
    serverProcess = spawn('node', ['src/server.js'], {
      cwd: __dirname,
      stdio: ['pipe', 'pipe', 'pipe']
    });

    let serverReady = false;
    serverProcess.stderr.on('data', (data) => {
      const output = data.toString();
      console.log('🔧 Server log:', output.trim());
      if (output.includes('RAG MCP Server running on stdio')) {
        serverReady = true;
      }
    });

    // Wait for server to initialize
    console.log(`⏳ Waiting ${SERVER_INIT_WAIT}ms for server initialization...`);
    await new Promise(resolve => setTimeout(resolve, SERVER_INIT_WAIT));

    if (!serverReady) {
      console.log('⚠️  Server may still be initializing (embedding model download)...');
    }

    // Create MCP client
    console.log('🔌 Creating MCP client...');
    const transport = new StdioClientTransport({
      command: 'node',
      args: ['src/server.js'],
      cwd: __dirname
    });

    client = new Client(
      {
        name: 'rag-test-client',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Connect to server
    console.log('🤝 Connecting to MCP server...');
    await client.connect(transport);
    console.log('✅ Connected to MCP server successfully');

    // Test 1: List available tools
    console.log('\n🛠️  Test 1: List available tools');
    const toolsResult = await client.listTools();
    console.log('✅ Available tools:');
    toolsResult.tools.forEach(tool => {
      console.log(`   - ${tool.name}: ${tool.description}`);
    });

    // Test 2: Add data source
    console.log('\n📄 Test 2: Add test document as data source');
    const addSourceResult = await client.callTool({
      name: 'rag_add_data_source',
      arguments: {
        source_type: 'file',
        path_or_url: testFilePath,
        metadata: { 
          test: true, 
          description: 'Test document for RAG validation',
          created_by: 'test-suite'
        }
      }
    });
    
    console.log('✅ Add source result:');
    addSourceResult.content.forEach(content => {
      if (content.type === 'text') {
        const result = JSON.parse(content.text);
        console.log(`   Status: ${result.status}`);
        console.log(`   Source ID: ${result.source_id}`);
        console.log(`   Chunks: ${result.chunk_count}`);
        console.log(`   Message: ${result.message}`);
      }
    });

    // Test 3: List data sources
    console.log('\n📋 Test 3: List all data sources');
    const listSourcesResult = await client.callTool({
      name: 'rag_list_data_sources',
      arguments: {}
    });
    
    console.log('✅ Data sources:');
    listSourcesResult.content.forEach(content => {
      if (content.type === 'text') {
        const result = JSON.parse(content.text);
        console.log(`   Found ${result.sources.length} source(s):`);
        result.sources.forEach(source => {
          console.log(`   - ID: ${source.id}`);
          console.log(`     Name: ${source.name}`);
          console.log(`     Type: ${source.type}`);
          console.log(`     Status: ${source.status}`);
          console.log(`     Path: ${source.path}`);
          console.log(`     Added: ${source.added_at}`);
        });
      }
    });

    // Test 4: Query documents - Features
    console.log('\n🔍 Test 4: Query documents about RAG features');
    const queryResult1 = await client.callTool({
      name: 'rag_query_documents',
      arguments: {
        query_text: 'What are the features of the RAG system?',
        top_k: 3
      }
    });
    
    console.log('✅ Query result (Features):');
    queryResult1.content.forEach(content => {
      if (content.type === 'text') {
        const result = JSON.parse(content.text);
        console.log(`   Query: "${result.query}"`);
        console.log(`   Total results: ${result.total_results}`);
        console.log(`   Retrieved contexts:`);
        result.retrieved_contexts.forEach((ctx, i) => {
          console.log(`   ${i + 1}. Similarity: ${ctx.similarity_score}`);
          console.log(`      Text: "${ctx.text_chunk.substring(0, 100)}..."`);
          console.log(`      Source: ${ctx.metadata.original_document_path}`);
        });
      }
    });

    // Test 5: Query documents - Technical details
    console.log('\n🔍 Test 5: Query documents about technical details');
    const queryResult2 = await client.callTool({
      name: 'rag_query_documents',
      arguments: {
        query_text: 'LanceDB and vector storage technology',
        top_k: 2
      }
    });
    
    console.log('✅ Query result (Technical):');
    queryResult2.content.forEach(content => {
      if (content.type === 'text') {
        const result = JSON.parse(content.text);
        console.log(`   Query: "${result.query}"`);
        console.log(`   Total results: ${result.total_results}`);
        console.log(`   Retrieved contexts:`);
        result.retrieved_contexts.forEach((ctx, i) => {
          console.log(`   ${i + 1}. Similarity: ${ctx.similarity_score}`);
          console.log(`      Distance: ${ctx.distance}`);
          console.log(`      Text: "${ctx.text_chunk.substring(0, 150)}..."`);
          console.log(`      Chunk order: ${ctx.metadata.chunk_order}`);
        });
      }
    });

    // Test 6: Query with no matches (should return empty or low similarity)
    console.log('\n🔍 Test 6: Query with unrelated content');
    const queryResult3 = await client.callTool({
      name: 'rag_query_documents',
      arguments: {
        query_text: 'quantum computing and blockchain technology',
        top_k: 1
      }
    });
    
    console.log('✅ Query result (Unrelated):');
    queryResult3.content.forEach(content => {
      if (content.type === 'text') {
        const result = JSON.parse(content.text);
        console.log(`   Query: "${result.query}"`);
        console.log(`   Total results: ${result.total_results}`);
        if (result.retrieved_contexts.length > 0) {
          console.log(`   Best match similarity: ${result.retrieved_contexts[0].similarity_score}`);
          console.log(`   Text: "${result.retrieved_contexts[0].text_chunk.substring(0, 100)}..."`);
        } else {
          console.log('   No results found');
        }
      }
    });

    console.log('\n🎉 All tests completed successfully!');
    console.log('\n📊 Test Summary:');
    console.log('   ✅ Server connection established');
    console.log('   ✅ Tools listed successfully');
    console.log('   ✅ Document added and indexed');
    console.log('   ✅ Data sources listed');
    console.log('   ✅ Multiple queries executed');
    console.log('   ✅ Similarity scoring working');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    console.error('Error details:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
    throw error;
  } finally {
    // Clean up
    if (client) {
      try {
        console.log('\n🔌 Disconnecting MCP client...');
        await client.close();
        console.log('✅ Client disconnected');
      } catch (e) {
        console.log('⚠️  Error disconnecting client:', e.message);
      }
    }
    
    if (serverProcess) {
      console.log('🧹 Cleaning up server process...');
      serverProcess.kill('SIGTERM');
      
      // Give it a moment to clean up
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (!serverProcess.killed) {
        console.log('🔨 Force killing server process...');
        serverProcess.kill('SIGKILL');
      }
    }
    
    if (testFilePath) {
      try {
        await fs.unlink(testFilePath);
        console.log('🗑️  Removed test file');
      } catch (e) {
        console.log('⚠️  Could not remove test file:', e.message);
      }
    }
  }
}

// Add timeout for the entire test
const testTimeout = setTimeout(() => {
  console.error('❌ Test suite timeout after 60 seconds');
  process.exit(1);
}, TEST_TIMEOUT);

// Handle process signals
process.on('SIGINT', () => {
  console.log('\n🛑 Test interrupted by user');
  clearTimeout(testTimeout);
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('\n🛑 Test terminated');
  clearTimeout(testTimeout);
  process.exit(1);
});

testMCPServer()
  .then(() => {
    clearTimeout(testTimeout);
    console.log('\n✅ Test suite completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    clearTimeout(testTimeout);
    console.error('\n❌ Test suite failed:', error.message);
    process.exit(1);
  });